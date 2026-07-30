-- Fix section admin assignment and manager access fallback.

BEGIN;

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

COMMIT;
