-- Fix role assignment permissions for admin panel.

BEGIN;

-- Admin panel upserts into user_roles; authenticated needs table privileges in addition to RLS.
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Moderators need to update profile.role for users in their municipality.
DROP POLICY IF EXISTS "profiles_manage_by_moderators" ON public.profiles;
CREATE POLICY "profiles_manage_by_moderators"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR (
      public.can_moderate(auth.uid())
      AND municipality_id = public.current_user_municipality()
    )
  )
  WITH CHECK (
    auth.uid() = id
    OR (
      public.can_moderate(auth.uid())
      AND municipality_id = public.current_user_municipality()
    )
  );

COMMIT;
