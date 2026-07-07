
-- 1. Add 'admin' to app_role enum (create enum if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'Sused', 'Starosta', 'Uradnik', 'Farar', 'VIP_Firma');
  ELSE
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END$$;

-- 2. user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Municipalities
CREATE TABLE IF NOT EXISTS public.municipalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.municipalities TO authenticated, anon;
GRANT ALL ON public.municipalities TO service_role;

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read municipalities" ON public.municipalities;
CREATE POLICY "anyone read municipalities" ON public.municipalities
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admins manage municipalities" ON public.municipalities;
CREATE POLICY "admins manage municipalities" ON public.municipalities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.municipalities (slug, name, region)
VALUES ('ruzindol', 'Ružindol', 'Trnavský kraj')
ON CONFLICT (slug) DO NOTHING;

-- 4. Add municipality to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES public.municipalities(id);

UPDATE public.profiles
SET municipality_id = (SELECT id FROM public.municipalities WHERE slug = 'ruzindol')
WHERE municipality_id IS NULL;

-- 5. Reset all existing profile roles to 'Sused'
UPDATE public.profiles SET role = 'Sused';

-- 6. Invite codes (single-use)
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  municipality_id UUID REFERENCES public.municipalities(id),
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.invite_codes TO authenticated;
GRANT ALL ON public.invite_codes TO service_role;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage invite codes" ON public.invite_codes;
CREATE POLICY "admins manage invite codes" ON public.invite_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users read own invite" ON public.invite_codes;
CREATE POLICY "users read own invite" ON public.invite_codes
  FOR SELECT TO authenticated
  USING (used_by = auth.uid() OR created_by = auth.uid());

-- Redeem function: validates + marks single-use atomically
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code TEXT)
RETURNS BOOLEAN
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

  -- bypass code
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

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;

-- 7. Update handle_new_user: always assign Sused role via user_roles + default profile role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_muni UUID;
BEGIN
  SELECT id INTO v_muni FROM public.municipalities WHERE slug = 'ruzindol' LIMIT 1;

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

  -- Bootstrap admin
  IF NEW.email = 'duskip@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 8. If duskip@gmail.com already exists, grant admin now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'duskip@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also ensure existing users have base Sused role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'Sused'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;
