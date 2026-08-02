BEGIN;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.invite_codes TO authenticated;
GRANT ALL ON public.invite_codes TO service_role;

DROP POLICY IF EXISTS "admins manage invite codes" ON public.invite_codes;
CREATE POLICY "admins manage invite codes" ON public.invite_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users read own invite" ON public.invite_codes;
DROP POLICY IF EXISTS "Users can read own redeemed invite code" ON public.invite_codes;
DROP POLICY IF EXISTS "invite_codes_read_own_or_used" ON public.invite_codes;
CREATE POLICY "invite_codes_read_own_or_used" ON public.invite_codes
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR used_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "invite_codes_insert_own_or_admin" ON public.invite_codes;
CREATE POLICY "invite_codes_insert_own_or_admin" ON public.invite_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      created_by = auth.uid()
      AND used_by IS NULL
      AND role = 'Sused'
    )
  );

CREATE OR REPLACE FUNCTION public.invite_code_random()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  out_code text := '';
  i int;
BEGIN
  FOR i IN 1..9 LOOP
    IF i = 5 THEN
      out_code := out_code || '-';
    END IF;
    out_code := out_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN out_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_neighbor_invite_codes(_count integer DEFAULT 3)
RETURNS TABLE(
  id uuid,
  code text,
  created_at timestamptz,
  used_by uuid,
  used_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_muni uuid;
  v_needed integer;
  v_code text;
  v_target integer := LEAST(GREATEST(COALESCE(_count, 3), 1), 3);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND (
        p.is_active_neighbor = true
        OR p.role IN ('Starosta','Uradnik','Farar','VIP_Firma')
        OR public.has_role(v_uid, 'admin')
      )
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT p.municipality_id
    INTO v_muni
  FROM public.profiles p
  WHERE p.id = v_uid;

  SELECT GREATEST(v_target - COUNT(*), 0)
    INTO v_needed
  FROM public.invite_codes ic
  WHERE ic.created_by = v_uid
    AND ic.used_by IS NULL;

  WHILE v_needed > 0 LOOP
    LOOP
      v_code := public.invite_code_random();
      BEGIN
        INSERT INTO public.invite_codes (code, created_by, municipality_id, role)
        VALUES (v_code, v_uid, v_muni, 'Sused');
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          NULL;
      END;
    END LOOP;

    v_needed := v_needed - 1;
  END LOOP;

  RETURN QUERY
  SELECT ic.id, ic.code, ic.created_at, ic.used_by, ic.used_at
  FROM public.invite_codes ic
  WHERE ic.created_by = v_uid
    AND ic.used_by IS NULL
  ORDER BY ic.created_at ASC
  LIMIT v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_neighbor_invite_codes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_neighbor_invite_codes(integer) TO authenticated;

COMMIT;