-- Keep signup resilient and ensure new profiles are sent over Supabase Realtime.

BEGIN;

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
    INSERT INTO public.profiles (id, name, street, role, municipality_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'street', ''),
      'Sused',
      v_muni
    )
    ON CONFLICT (id) DO NOTHING;
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
END
$$;

COMMIT;
