
-- 1. Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS is_active_neighbor boolean NOT NULL DEFAULT false;

-- 2. Backfill: elevated roles are treated as active by default
UPDATE public.profiles p
   SET is_active_neighbor = true
 WHERE p.role IN ('Starosta','Uradnik','Farar','VIP_Firma')
    OR EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = p.id AND ur.role = 'admin');

-- 3. Update redeem_invite_code to also set is_active_neighbor + invite_code,
--    and to accept the special ADMI.DP.77 bypass.
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.invite_codes%ROWTYPE;
  v_norm text := upper(btrim(_code));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Bypass code: only flip the active flag; do not change role/municipality.
  IF v_norm = 'ADMI.DP.77' THEN
    UPDATE public.profiles
       SET is_active_neighbor = true,
           invite_code = v_norm
     WHERE id = v_uid;
    RETURN TRUE;
  END IF;

  SELECT * INTO v_row FROM public.invite_codes WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Neplatný pozývací kód' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.used_by IS NOT NULL THEN
    RAISE EXCEPTION 'Kód už bol použitý' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.invite_codes
     SET used_by = v_uid, used_at = now()
   WHERE id = v_row.id;

  UPDATE public.profiles
     SET role = v_row.role,
         municipality_id = COALESCE(v_row.municipality_id, municipality_id),
         is_active_neighbor = true,
         invite_code = _code
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
