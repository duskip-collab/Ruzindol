-- Allow Starosta to manage user roles for users in the same municipality.

BEGIN;

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "managers manage roles" ON public.user_roles;

CREATE POLICY "managers manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.can_moderate(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.municipality_id = public.current_user_municipality()
    )
  )
  WITH CHECK (
    public.can_moderate(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.municipality_id = public.current_user_municipality()
    )
  );

COMMIT;
