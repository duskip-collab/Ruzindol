-- Manual SQL update for roles, section-admin assignment, announcements and listings policies.
-- Safe to run repeatedly (idempotent where possible).

BEGIN;

-- 1) Ensure enriched group announcements schema exists
ALTER TABLE public.group_announcements
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS linked_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS post_kind TEXT,
  ADD COLUMN IF NOT EXISTS deceased_name TEXT;

UPDATE public.group_announcements
SET post_kind = COALESCE(post_kind, 'oznam')
WHERE post_kind IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'group_announcements_post_kind_check'
      AND conrelid = 'public.group_announcements'::regclass
  ) THEN
    ALTER TABLE public.group_announcements
      ADD CONSTRAINT group_announcements_post_kind_check
      CHECK (post_kind IN ('oznam', 'parte'));
  END IF;
END $$;

ALTER TABLE public.group_announcements
  ALTER COLUMN post_kind SET DEFAULT 'oznam',
  ALTER COLUMN post_kind SET NOT NULL;

CREATE INDEX IF NOT EXISTS group_announcements_event_idx
  ON public.group_announcements(linked_event_id)
  WHERE linked_event_id IS NOT NULL;

-- 2) Section manager helper role function (admin + starosta)
CREATE OR REPLACE FUNCTION public.can_manage_group_sections(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'Starosta'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = _user_id
          AND p.role = 'Starosta'
      )
$$;

REVOKE ALL ON FUNCTION public.can_manage_group_sections(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_group_sections(UUID) TO authenticated;

-- 3) Group admin policy: admin/starosta can assign registered neighbors in same municipality
DROP POLICY IF EXISTS "group_admins_manage_by_moderators" ON public.group_admins;
DROP POLICY IF EXISTS "group_admins_manage_by_managers" ON public.group_admins;
CREATE POLICY "group_admins_manage_by_managers"
  ON public.group_admins
  FOR ALL
  TO authenticated
  USING (public.can_manage_group_sections(auth.uid()))
  WITH CHECK (
    public.can_manage_group_sections(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = group_admins.user_id
        AND p.role = 'Sused'
        AND p.is_active_neighbor = true
        AND p.municipality_id = public.current_user_municipality()
    )
  );

-- 4) Group announcements insert policy (manager/group-admin/farar in farnost)
DROP POLICY IF EXISTS "group_announcements_insert_admin_or_group_admin" ON public.group_announcements;
DROP POLICY IF EXISTS "group_announcements_insert_managers_group_admin_farar" ON public.group_announcements;
CREATE POLICY "group_announcements_insert_managers_group_admin_farar"
  ON public.group_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.can_manage_group_sections(auth.uid())
      OR public.is_group_admin(auth.uid(), group_key)
      OR (
        group_key = 'farnost'
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'Farar'
            AND p.municipality_id = public.current_user_municipality()
        )
      )
    )
    AND (
      post_kind <> 'parte'
      OR (
        group_key = 'farnost'
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'Farar'
            AND p.municipality_id = public.current_user_municipality()
        )
      )
    )
  );

-- 5) Role sync hardening: mirror profile.role into user_roles if missing
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.role::public.app_role
FROM public.profiles p
WHERE p.role IN ('Sused', 'Starosta', 'Uradnik', 'Farar', 'VIP_Firma')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role::text = p.role
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- warehouse_items: users_insert_own_warehouse_items/users_update_own_warehouse_items/users_delete_own_warehouse_items


-- 7) Announcements audio upgrade: idempotent schema, storage and cleanup support
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('rss','internal')),
  external_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  audio_path TEXT,
  link TEXT,
  priority TEXT NOT NULL DEFAULT 'oznam' CHECK (priority IN ('oznam','prioritne','urgentne','vystraha')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_announcements_published_at
  ON public.announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_priority
  ON public.announcements(priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements-audio', 'announcements-audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "announcements_audio_read" ON storage.objects;
DROP POLICY IF EXISTS "announcements_audio_insert" ON storage.objects;
DROP POLICY IF EXISTS "announcements_audio_update" ON storage.objects;
DROP POLICY IF EXISTS "announcements_audio_delete" ON storage.objects;

CREATE POLICY "announcements_audio_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcements-audio');

CREATE POLICY "announcements_audio_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'announcements-audio' AND owner = auth.uid());

CREATE POLICY "announcements_audio_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'announcements-audio' AND owner = auth.uid());

CREATE POLICY "announcements_audio_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'announcements-audio' AND owner = auth.uid());

DROP POLICY IF EXISTS "announcements_read_all" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_insert" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_update" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_delete" ON public.announcements;
DROP POLICY IF EXISTS "announcements_rss_insert" ON public.announcements;
DROP POLICY IF EXISTS "announcements_cleanup_delete" ON public.announcements;

CREATE POLICY "announcements_read_all" ON public.announcements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "announcements_admin_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'internal'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik','Farar')
    )
  );

CREATE POLICY "announcements_admin_update" ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik'))
  );

CREATE POLICY "announcements_admin_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik'))
  );

CREATE POLICY "announcements_rss_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (source = 'rss' AND author_id IS NULL);

CREATE OR REPLACE FUNCTION public.cleanup_expired_announcements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_count int;
BEGIN
  IF v_uid IS NULL OR NOT public.can_moderate(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  WITH expired AS (
    SELECT id, audio_path
    FROM public.announcements
    WHERE (source = 'rss' AND published_at < now() - interval '3 days')
       OR (
         source = 'internal'
         AND COALESCE(expires_at, published_at + interval '4 days') <= now()
       )
  ),
  audio_del AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'announcements-audio'
      AND name IN (SELECT audio_path FROM expired WHERE audio_path IS NOT NULL)
  ),
  del AS (
    DELETE FROM public.announcements
     WHERE id IN (SELECT id FROM expired)
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_expired_announcements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_announcements() TO authenticated;
COMMIT;
