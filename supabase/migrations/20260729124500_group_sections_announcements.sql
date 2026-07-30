CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.group_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key TEXT NOT NULL CHECK (group_key IN ('osk_ruzindol', 'dochodcovia', 'dhz')),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_key, user_id)
);

CREATE INDEX IF NOT EXISTS group_admins_group_key_idx ON public.group_admins(group_key);
CREATE INDEX IF NOT EXISTS group_admins_user_id_idx ON public.group_admins(user_id);

CREATE TABLE IF NOT EXISTS public.group_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key TEXT NOT NULL CHECK (group_key IN ('osk_ruzindol', 'dochodcovia', 'dhz')),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 days')
);

CREATE INDEX IF NOT EXISTS group_announcements_group_created_idx
  ON public.group_announcements(group_key, created_at DESC);
CREATE INDEX IF NOT EXISTS group_announcements_expires_at_idx
  ON public.group_announcements(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_admins TO authenticated;
GRANT ALL ON public.group_admins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_announcements TO authenticated;
GRANT ALL ON public.group_announcements TO service_role;

ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id UUID, _group_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_admins ga
    WHERE ga.user_id = _user_id
      AND ga.group_key = _group_key
  )
$$;

REVOKE ALL ON FUNCTION public.is_group_admin(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_admin(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_group_announcement_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.expires_at := COALESCE(NEW.created_at, now()) + interval '4 days';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_announcement_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_announcement_expiry() TO service_role;

DROP TRIGGER IF EXISTS trg_set_group_announcement_expiry ON public.group_announcements;
CREATE TRIGGER trg_set_group_announcement_expiry
BEFORE INSERT ON public.group_announcements
FOR EACH ROW
EXECUTE FUNCTION public.set_group_announcement_expiry();

DROP POLICY IF EXISTS "group_admins_select_scoped" ON public.group_admins;
CREATE POLICY "group_admins_select_scoped"
  ON public.group_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = group_admins.user_id
        AND p.municipality_id = public.current_user_municipality()
    )
    OR public.can_moderate(auth.uid())
  );

DROP POLICY IF EXISTS "group_admins_manage_by_moderators" ON public.group_admins;
CREATE POLICY "group_admins_manage_by_moderators"
  ON public.group_admins
  FOR ALL
  TO authenticated
  USING (public.can_moderate(auth.uid()))
  WITH CHECK (
    public.can_moderate(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = group_admins.user_id
        AND p.role = 'Sused'
        AND p.municipality_id = public.current_user_municipality()
    )
  );

DROP POLICY IF EXISTS "group_announcements_select_scoped" ON public.group_announcements;
CREATE POLICY "group_announcements_select_scoped"
  ON public.group_announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = group_announcements.author_id
        AND p.municipality_id = public.current_user_municipality()
    )
    OR public.can_moderate(auth.uid())
  );

DROP POLICY IF EXISTS "group_announcements_insert_admin_or_group_admin" ON public.group_announcements;
CREATE POLICY "group_announcements_insert_admin_or_group_admin"
  ON public.group_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.can_moderate(auth.uid())
      OR public.is_group_admin(auth.uid(), group_key)
    )
  );

DROP POLICY IF EXISTS "group_announcements_update_owner_or_moderator" ON public.group_announcements;
CREATE POLICY "group_announcements_update_owner_or_moderator"
  ON public.group_announcements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id OR public.can_moderate(auth.uid()))
  WITH CHECK (auth.uid() = author_id OR public.can_moderate(auth.uid()));

DROP POLICY IF EXISTS "group_announcements_delete_owner_or_moderator" ON public.group_announcements;
CREATE POLICY "group_announcements_delete_owner_or_moderator"
  ON public.group_announcements
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR public.can_moderate(auth.uid()));

CREATE OR REPLACE FUNCTION public.cleanup_expired_group_announcements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH del AS (
    DELETE FROM public.group_announcements
    WHERE expires_at <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_group_announcements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_group_announcements() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-group-announcements');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-group-announcements',
  '25 * * * *',
  $$SELECT public.cleanup_expired_group_announcements();$$
);
