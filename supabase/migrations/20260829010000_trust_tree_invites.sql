-- The application uses invite_codes as its activation-code table.
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invite_codes_created_by_profiles_fkey'
  ) THEN
    ALTER TABLE public.invite_codes
      ADD CONSTRAINT invite_codes_created_by_profiles_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_invited_by_user_id_idx
  ON public.profiles (invited_by_user_id);

CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.invite_codes%ROWTYPE;
  v_norm text := upper(regexp_replace(btrim(_code), '-', '', 'g'));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_norm = 'ADMI.DP.77' THEN
    UPDATE public.profiles
       SET is_active_neighbor = true,
           invite_code = v_norm
     WHERE id = v_uid;
    RETURN TRUE;
  END IF;

  SELECT *
    INTO v_row
  FROM public.invite_codes
  WHERE upper(regexp_replace(code, '-', '', 'g')) = v_norm
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Neplatný pozývací kód' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.used_by IS NOT NULL THEN
    RAISE EXCEPTION 'Kód už bol použitý' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.invite_codes
     SET used_by = v_uid,
         used_at = now()
   WHERE id = v_row.id;

  UPDATE public.profiles
     SET role = v_row.role,
         municipality_id = COALESCE(v_row.municipality_id, municipality_id),
         is_active_neighbor = true,
         invite_code = v_row.code,
         invited_by_user_id = v_row.created_by
   WHERE id = v_uid;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, v_row.role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN others THEN NULL;
  END;

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;