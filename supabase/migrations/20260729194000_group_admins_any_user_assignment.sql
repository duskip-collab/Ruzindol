-- Allow admin/starosta to assign section admins to any user profile within municipality.

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
