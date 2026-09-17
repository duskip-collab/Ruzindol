-- ============================================================================
-- Alternative verification for neighbors - manual approval by admin/mayor
-- ============================================================================
BEGIN;

-- RPC Function: verify a neighbor (set is_verified = true)
-- Only admins and starostas can verify neighbors in their municipality
CREATE OR REPLACE FUNCTION public.verify_neighbor_manual(_neighbor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current_mun uuid;
  v_target_mun uuid;
BEGIN
  -- Check if authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Check if caller is admin or starosta
  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'Starosta'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden - only admin or starosta can verify' USING ERRCODE = '42501';
  END IF;

  -- Get current user's municipality
  SELECT municipality_id INTO v_current_mun
  FROM public.profiles
  WHERE id = v_uid;

  -- Get target user's municipality
  SELECT municipality_id INTO v_target_mun
  FROM public.profiles
  WHERE id = _neighbor_id;

  -- Check if both are in same municipality (unless admin)
  IF NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    IF v_current_mun IS NULL OR v_target_mun IS NULL OR v_current_mun != v_target_mun THEN
      RAISE EXCEPTION 'Target not in same municipality' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Cannot verify admins
  IF public.has_role(_neighbor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Cannot verify admin' USING ERRCODE = 'P0001';
  END IF;

  -- Update: set is_verified = true and is_active_neighbor = true
  UPDATE public.profiles
  SET is_verified = true,
      is_active_neighbor = true
  WHERE id = _neighbor_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_neighbor_manual(uuid) TO authenticated;

COMMIT;
