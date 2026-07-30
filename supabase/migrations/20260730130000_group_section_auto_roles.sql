-- Restrict manual section admins to neighbor sections and add automatic role access.

BEGIN;

DROP POLICY IF EXISTS "group_admins_manage_by_managers" ON public.group_admins;
CREATE POLICY "group_admins_manage_by_managers"
  ON public.group_admins
  FOR ALL
  TO authenticated
  USING (
    public.can_manage_group_sections(auth.uid())
    AND group_key IN ('osk_ruzindol', 'dochodcovia', 'dhz')
  )
  WITH CHECK (
    public.can_manage_group_sections(auth.uid())
    AND group_key IN ('osk_ruzindol', 'dochodcovia', 'dhz')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = group_admins.user_id
        AND p.role = 'Sused'
        AND p.is_active_neighbor = true
        AND p.municipality_id = public.current_user_municipality()
    )
  );

DROP POLICY IF EXISTS "group_announcements_insert_managers_group_admin_farar" ON public.group_announcements;
DROP POLICY IF EXISTS "group_announcements_insert_managers_group_admin_auto_roles" ON public.group_announcements;
CREATE POLICY "group_announcements_insert_managers_group_admin_auto_roles"
  ON public.group_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.can_manage_group_sections(auth.uid())
      OR (
        group_key IN ('osk_ruzindol', 'dochodcovia', 'dhz')
        AND public.is_group_admin(auth.uid(), group_key)
      )
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
      OR (
        group_key = 'sluzby'
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'VIP_Firma'
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

COMMIT;
