-- Fix 403 on group sections and allow manager assignment for any municipality profile.

BEGIN;

-- RLS policies call can_moderate(); authenticated users must be able to execute it.
GRANT EXECUTE ON FUNCTION public.can_moderate(uuid) TO authenticated;

-- Keep group section manager function callable for RLS checks.
GRANT EXECUTE ON FUNCTION public.can_manage_group_sections(uuid) TO authenticated;

-- Allow section managers (admin/starosta) to assign any user profile from the same municipality.
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
        AND p.municipality_id = public.current_user_municipality()
    )
  );

COMMIT;
