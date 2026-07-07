-- MERGED MIGRATION
-- Generated: 2026-07-06
-- This file concatenates all individual migrations into a single deployable SQL file.

-- =========================================================================
-- From: 20260702185655_b6b9ae3a-9d47-411d-b55d-2d02613fe9bf.sql
-- =========================================================================

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  street TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Sused' CHECK (role IN ('Sused', 'Starosta')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- =========================================================================
-- 2. POSTS (Nástenka)
-- =========================================================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('hlasnik', 'susedsky_zivot')),
  category TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX posts_type_created_idx ON public.posts (type, created_at DESC);

GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT USING (true);

CREATE POLICY "Users can create their own posts"
  ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.posts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- =========================================================================
-- 3. WAREHOUSE_ITEMS (Sklad, Darovanie, Trh, Rychly dopyt)
-- =========================================================================
CREATE TABLE public.warehouse_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('trh', 'darovanie', 'sklad_ponuka', 'sklad_dopyt')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX warehouse_items_type_created_idx
  ON public.warehouse_items (type, created_at DESC);

GRANT SELECT ON public.warehouse_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_items TO authenticated;
GRANT ALL ON public.warehouse_items TO service_role;

ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Warehouse items are viewable by everyone"
  ON public.warehouse_items FOR SELECT USING (true);

CREATE POLICY "Users can create their own warehouse items"
  ON public.warehouse_items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own warehouse items"
  ON public.warehouse_items FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own warehouse items"
  ON public.warehouse_items FOR DELETE USING (auth.uid() = user_id);

-- =========================================================================
-- 4. CHATS
-- =========================================================================
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, buyer_id),
  CHECK (buyer_id <> seller_id)
);

CREATE INDEX chats_buyer_idx ON public.chats (buyer_id);
CREATE INDEX chats_seller_idx ON public.chats (seller_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view their chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = buyer_id AND buyer_id <> seller_id);

-- =========================================================================
-- 5. MESSAGES (with 4-message hard limit)
-- =========================================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_chat_created_idx ON public.messages (chat_id, created_at);

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
    )
  );

CREATE POLICY "Chat participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
    )
  );

-- ---------- 4-message hard limit at DB level ----------
CREATE OR REPLACE FUNCTION public.enforce_message_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_count INTEGER;
BEGIN
  SELECT count(*) INTO msg_count
  FROM public.messages
  WHERE chat_id = NEW.chat_id;

  IF msg_count >= 4 THEN
    RAISE EXCEPTION 'Limit 4 správ pre tento chat bol dosiahnutý.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_message_limit_trg
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_limit();

-- =========================================================================
-- SHARED: updated_at trigger + auto-profile on signup
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER warehouse_items_set_updated_at
  BEFORE UPDATE ON public.warehouse_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, street)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'street', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- From: 20260702185709_28c77f5d-dc29-4488-9e96-dcb0973831b4.sql
-- =========================================================================

REVOKE EXECUTE ON FUNCTION public.enforce_message_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- From: 20260702190312_e9848265-8f4e-44b8-85f6-823d68330788.sql
-- =========================================================================

-- Public read + authenticated write for community-images bucket
CREATE POLICY "community_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-images');

CREATE POLICY "community_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'community-images' AND owner = auth.uid());

CREATE POLICY "community_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'community-images' AND owner = auth.uid());

CREATE POLICY "community_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'community-images' AND owner = auth.uid());

-- =========================================================================
-- From: 20260703063335_534cd967-c58e-47bb-9c70-4e2d3065cc61.sql
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- =========================================================================
-- From: 20260703065148_bbe72474-1158-45ac-b3c9-c476fc3baa08.sql
-- =========================================================================

ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['Sused'::text, 'Starosta'::text, 'VIP_Firma'::text, 'Uradnik'::text, 'Farar'::text]));

-- =========================================================================
-- From: 20260703082115_41a23da6-4a96-45ad-bd9e-38119982098e.sql
-- =========================================================================

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('rss','internal')),
  external_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  priority TEXT NOT NULL DEFAULT 'oznam' CHECK (priority IN ('oznam','prioritne','urgentne','vystraha')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_announcements_published_at ON public.announcements(published_at DESC);
CREATE INDEX idx_announcements_priority ON public.announcements(priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "announcements_read_all" ON public.announcements
  FOR SELECT TO authenticated USING (true);

-- Only Starosta / Uradnik / Farar can insert internal announcements (author must be self)
CREATE POLICY "announcements_admin_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'internal'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik','Farar')
    )
  );

-- Admins can update/delete internal, and delete RSS (for cleanup)
CREATE POLICY "announcements_admin_update" ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik'))
  );

CREATE POLICY "announcements_admin_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik'))
  );

-- Also allow any authenticated user to insert RSS entries (client-side sync)
CREATE POLICY "announcements_rss_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (source = 'rss' AND author_id IS NULL);

-- Allow any authenticated user to delete expired entries (cleanup on sync)
CREATE POLICY "announcements_cleanup_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    (source = 'rss' AND published_at < now() - interval '3 days')
    OR (source = 'internal' AND published_at < now() - interval '4 days')
  );

-- =========================================================================
-- From: 20260703102254_7830c333-8596-4feb-ab95-b4008e93d1a4.sql
-- =========================================================================

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

-- =========================================================================
-- From: 20260703105607_79d0a905-2bc6-4133-a98d-e6bfdedad4db.sql
-- =========================================================================

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

-- =========================================================================
-- From: 20260703111730_36d13852-aa77-429e-9622-91ff297e0fdc.sql
-- =========================================================================

-- Enable realtime for chats and messages tables so message previews update live.
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chats'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chats';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END $$;

-- =========================================================================
-- From: 20260703113239_6e1f2fce-5ccc-47a0-b0bb-c1935ac1cc20.sql
-- =========================================================================

-- 1. Restrict profiles SELECT to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- 2. Lock down SECURITY DEFINER function execution
REVOKE ALL ON FUNCTION public.enforce_message_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_used_invite_codes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_invite_code(text) FROM PUBLIC, anon;

-- Keep needed grants
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;

-- =========================================================================
-- From: 20260703113447_38d403f7-9213-4ff5-b2fa-02c154ee3134.sql
-- =========================================================================

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
