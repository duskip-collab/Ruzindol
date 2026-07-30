
-- 1. Add mayor_name and logo_url to municipalities
ALTER TABLE public.municipalities
  ADD COLUMN IF NOT EXISTS mayor_name text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

UPDATE public.municipalities
SET latitude = 48.37001,
    longitude = 17.4943815
WHERE slug = 'ruzindol';

-- 2. Update handle_new_user to read municipality from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_muni UUID;
  v_meta_muni text;
BEGIN
  v_meta_muni := NEW.raw_user_meta_data->>'municipality_id';
  IF v_meta_muni IS NOT NULL AND v_meta_muni <> '' THEN
    BEGIN
      SELECT id INTO v_muni FROM public.municipalities WHERE id = v_meta_muni::uuid LIMIT 1;
    EXCEPTION WHEN others THEN v_muni := NULL;
    END;
  END IF;
  IF v_muni IS NULL THEN
    SELECT id INTO v_muni FROM public.municipalities WHERE slug = 'ruzindol' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, name, street, role, municipality_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'street', ''),
    'Sused',
    v_muni
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'Sused')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NEW.email = 'duskip@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Lock municipality_id after set (only admin can change)
CREATE OR REPLACE FUNCTION public.enforce_municipality_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.municipality_id IS NOT NULL
     AND NEW.municipality_id IS DISTINCT FROM OLD.municipality_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Obec sa nedá zmeniť po registrácii.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_municipality_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_municipality_lock ON public.profiles;
CREATE TRIGGER profiles_municipality_lock
BEFORE UPDATE OF municipality_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_municipality_lock();
