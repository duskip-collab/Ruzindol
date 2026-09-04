-- ============================================================================
-- Oprava helper funkcie is_active_verified_neighbor pre modul Podnety
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.is_active_verified_neighbor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND (
        p.is_active_neighbor = true
        OR p.is_admin = true
        OR p.is_official = true
        OR NULLIF(btrim(p.invite_code), '') IS NOT NULL
      )
  )
$$;

REVOKE ALL ON FUNCTION public.is_active_verified_neighbor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_verified_neighbor(uuid) TO authenticated;

COMMIT;
