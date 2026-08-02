BEGIN;

ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shared_via TEXT;

DROP POLICY IF EXISTS "invite_codes_insert_own_or_admin" ON public.invite_codes;
CREATE POLICY "invite_codes_insert_own_or_admin" ON public.invite_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'Starosta'
    )
    OR (
      created_by = auth.uid()
      AND used_by IS NULL
      AND role = 'Sused'
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'Sused'
          AND p.is_active_neighbor = true
          AND NULLIF(btrim(p.invite_code), '') IS NOT NULL
      )
    )
  );

DROP FUNCTION IF EXISTS public.get_or_create_neighbor_invite_codes(integer);

CREATE OR REPLACE FUNCTION public.get_or_create_neighbor_invite_codes(_count integer DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  code text,
  created_at timestamptz,
  used_by uuid,
  used_at timestamptz,
  shared_at timestamptz,
  shared_via text
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
  v_role text;
  v_active boolean;
  v_invite text;
  v_limit integer;
  v_target integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT p.role, p.is_active_neighbor, NULLIF(btrim(p.invite_code), ''), p.municipality_id
    INTO v_role, v_active, v_invite, v_muni
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF public.has_role(v_uid, 'admin') OR v_role = 'Starosta' THEN
    v_limit := 50;
  ELSIF v_role = 'Sused' AND v_active = true AND v_invite IS NOT NULL THEN
    v_limit := 3;
  ELSE
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_target := LEAST(GREATEST(COALESCE(_count, v_limit), 1), v_limit);

  SELECT GREATEST(v_target - COUNT(*), 0)
    INTO v_needed
  FROM public.invite_codes ic
  WHERE ic.created_by = v_uid
    AND ic.used_by IS NULL
    AND ic.shared_at IS NULL;

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
  SELECT ic.id, ic.code, ic.created_at, ic.used_by, ic.used_at, ic.shared_at, ic.shared_via
  FROM public.invite_codes ic
  WHERE ic.created_by = v_uid
    AND ic.used_by IS NULL
    AND ic.shared_at IS NULL
  ORDER BY ic.created_at ASC
  LIMIT v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_invite_code_shared(_invite_id uuid, _via text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.invite_codes
  SET shared_at = now(),
      shared_via = COALESCE(NULLIF(btrim(_via), ''), 'manual')
  WHERE id = _invite_id
    AND created_by = v_uid
    AND used_by IS NULL
    AND shared_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_neighbor_invite_codes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_neighbor_invite_codes(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_invite_code_shared(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invite_code_shared(uuid, text) TO authenticated;

COMMIT;
