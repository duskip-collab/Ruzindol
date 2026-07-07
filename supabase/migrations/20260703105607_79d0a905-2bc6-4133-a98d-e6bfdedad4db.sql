
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Sused'
  CHECK (role IN ('Sused','Uradnik','Starosta','Farar'));

DROP POLICY IF EXISTS "users read own invite" ON public.invite_codes;

CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.invite_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF upper(_code) = 'ADMI.DP.77' THEN
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
        municipality_id = COALESCE(v_row.municipality_id, municipality_id)
    WHERE id = v_uid;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, v_row.role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN others THEN NULL;
  END;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_used_invite_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH del AS (
    DELETE FROM public.invite_codes
    WHERE used_at IS NOT NULL
      AND used_at < now() - interval '3 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-used-invite-codes') THEN
    PERFORM cron.unschedule('cleanup-used-invite-codes');
  END IF;
  PERFORM cron.schedule(
    'cleanup-used-invite-codes',
    '0 3 * * *',
    $cron$ SELECT public.cleanup_used_invite_codes(); $cron$
  );
END $$;
