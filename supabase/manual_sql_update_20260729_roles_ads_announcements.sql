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

-- 6) Validate core policies for announcements and listings exist
-- (No-op section; kept for operator awareness)
-- announcements: announcements_admin_insert/update/delete, announcements_read_all
-- warehouse_items: users_insert_own_warehouse_items/users_update_own_warehouse_items/users_delete_own_warehouse_items

COMMIT;
