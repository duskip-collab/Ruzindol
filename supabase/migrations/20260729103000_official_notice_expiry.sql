CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS posts_expires_at_idx ON public.posts (expires_at);

CREATE OR REPLACE FUNCTION public.enforce_official_notice_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_max_expires timestamptz := COALESCE(NEW.created_at, now()) + interval '5 days';
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

DROP TRIGGER IF EXISTS trg_enforce_official_notice_expiry ON public.posts;
CREATE TRIGGER trg_enforce_official_notice_expiry
BEFORE INSERT OR UPDATE OF type, user_id, expires_at, created_at ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_official_notice_expiry();

UPDATE public.posts p
SET expires_at = p.created_at + interval '5 days'
FROM public.profiles pr
WHERE pr.id = p.user_id
  AND p.type = 'hlasnik'
  AND pr.role IN ('Starosta', 'Uradnik')
  AND p.expires_at IS NULL;

UPDATE public.posts p
SET expires_at = p.created_at + interval '5 days'
FROM public.profiles pr
WHERE pr.id = p.user_id
  AND p.type = 'hlasnik'
  AND pr.role IN ('Starosta', 'Uradnik')
  AND p.expires_at > p.created_at + interval '5 days';

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
      AND COALESCE(p.expires_at, p.created_at + interval '5 days') <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_official_notices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_official_notices() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-official-notices');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-official-notices',
  '20 * * * *',
  $$SELECT public.cleanup_expired_official_notices();$$
);
