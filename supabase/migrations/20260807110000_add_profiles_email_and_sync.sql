BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND p.email IS DISTINCT FROM u.email;

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_muni uuid;
  v_meta_muni text;
BEGIN
  v_meta_muni := NEW.raw_user_meta_data->>'municipality_id';

  IF v_meta_muni IS NOT NULL AND v_meta_muni <> '' THEN
    BEGIN
      SELECT id INTO v_muni
      FROM public.municipalities
      WHERE id = v_meta_muni::uuid
      LIMIT 1;
    EXCEPTION WHEN others THEN
      v_muni := NULL;
    END;
  END IF;

  IF v_muni IS NULL THEN
    SELECT id INTO v_muni
    FROM public.municipalities
    WHERE slug = 'ruzindol'
    LIMIT 1;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, name, street, role, municipality_id, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'street', ''),
      'Sused',
      v_muni,
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'handle_new_user profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'Sused')
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'handle_new_user base role insert failed for %: %', NEW.id, SQLERRM;
  END;

  IF NEW.email = 'duskip@gmail.com' THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'handle_new_user bootstrap admin insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id
    AND email IS DISTINCT FROM NEW.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email_from_auth_user();

REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth_user() FROM PUBLIC, anon, authenticated;

COMMIT;
