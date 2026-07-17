
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text;

-- Helper: is a user currently banned?
CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND banned_until IS NOT NULL AND banned_until > now()
  )
$$;

-- Helper: can caller moderate (admin or Starosta)?
CREATE OR REPLACE FUNCTION public.can_moderate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'Starosta'::public.app_role)
$$;

-- Ban a neighbor for N days (1..10)
CREATE OR REPLACE FUNCTION public.ban_neighbor(_target uuid, _days integer, _reason text DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.can_moderate(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF _days IS NULL OR _days < 1 OR _days > 10 THEN
    RAISE EXCEPTION 'Ban musí byť 1 až 10 dní' USING ERRCODE = 'P0001';
  END IF;
  IF _target = v_uid THEN
    RAISE EXCEPTION 'Nemôžete banovať sami seba' USING ERRCODE = 'P0001';
  END IF;
  -- Cannot ban admins
  IF public.has_role(_target, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Nemôžete banovať administrátora' USING ERRCODE = 'P0001';
  END IF;

  v_until := now() + make_interval(days => _days);

  UPDATE public.profiles
     SET banned_until = v_until,
         ban_reason = _reason,
         is_active_neighbor = false
   WHERE id = _target;

  RETURN v_until;
END;
$$;

-- Unban a neighbor
CREATE OR REPLACE FUNCTION public.unban_neighbor(_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.can_moderate(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET banned_until = NULL,
         ban_reason = NULL,
         is_active_neighbor = true
   WHERE id = _target;

  RETURN TRUE;
END;
$$;

-- Delete a neighbor entirely (profile + auth user)
CREATE OR REPLACE FUNCTION public.delete_neighbor(_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.can_moderate(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF _target = v_uid THEN
    RAISE EXCEPTION 'Nemôžete vymazať sami seba' USING ERRCODE = 'P0001';
  END IF;
  IF public.has_role(_target, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Nemôžete vymazať administrátora' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;
  DELETE FROM public.profiles WHERE id = _target;
  DELETE FROM auth.users WHERE id = _target;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_banned(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_moderate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ban_neighbor(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unban_neighbor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_neighbor(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ban_neighbor(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unban_neighbor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_neighbor(uuid) TO authenticated;
