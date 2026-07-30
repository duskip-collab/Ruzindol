CREATE TABLE IF NOT EXISTS public.post_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_replies_post_id_created_idx
  ON public.post_replies (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS post_replies_user_id_idx
  ON public.post_replies (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_replies TO authenticated;
GRANT ALL ON public.post_replies TO service_role;

ALTER TABLE public.post_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post replies viewable by authenticated" ON public.post_replies;
CREATE POLICY "Post replies viewable by authenticated"
  ON public.post_replies
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Active neighbors can create replies on allowed posts" ON public.post_replies;
DROP POLICY IF EXISTS "Authenticated users can create replies on allowed posts" ON public.post_replies;
CREATE POLICY "Authenticated users can create replies on allowed posts"
  ON public.post_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.posts post
      WHERE post.id = post_id
        AND post.type = 'susedsky_zivot'
        AND post.category IN ('Otazka', 'Straty_a_nalezy', 'Info_pre_susedov')
    )
  );

DROP POLICY IF EXISTS "Users can update own replies" ON public.post_replies;
CREATE POLICY "Users can update own replies"
  ON public.post_replies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own replies" ON public.post_replies;
CREATE POLICY "Users can delete own replies"
  ON public.post_replies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS post_replies_set_updated_at ON public.post_replies;
CREATE TRIGGER post_replies_set_updated_at
BEFORE UPDATE ON public.post_replies
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_official_notice_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_max_expires timestamptz := COALESCE(NEW.created_at, now()) + interval '4 days';
BEGIN
  IF NEW.type <> 'hlasnik' THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF v_role IN ('Starosta', 'Uradnik') THEN
    IF NEW.expires_at IS NULL THEN
      NEW.expires_at := v_max_expires;
    ELSIF NEW.expires_at > v_max_expires THEN
      NEW.expires_at := v_max_expires;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_official_notice_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_official_notice_expiry() TO service_role;

UPDATE public.posts p
SET expires_at = p.created_at + interval '4 days'
FROM public.profiles pr
WHERE pr.id = p.user_id
  AND p.type = 'hlasnik'
  AND pr.role IN ('Starosta', 'Uradnik')
  AND (
    p.expires_at IS NULL
    OR p.expires_at > p.created_at + interval '4 days'
  );

CREATE OR REPLACE FUNCTION public.cleanup_old_neighbor_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH del AS (
    DELETE FROM public.posts
    WHERE type = 'susedsky_zivot'
      AND category IN ('Otazka', 'Straty_a_nalezy', 'Info_pre_susedov')
      AND created_at < now() - interval '4 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_neighbor_posts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_neighbor_posts() TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_official_notices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH del AS (
    DELETE FROM public.posts p
    USING public.profiles pr
    WHERE pr.id = p.user_id
      AND p.type = 'hlasnik'
      AND pr.role IN ('Starosta', 'Uradnik')
      AND COALESCE(p.expires_at, p.created_at + interval '4 days') <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_official_notices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_official_notices() TO service_role;
