
-- =========================================================================
-- 1. PROFILES
-- =========================================================================
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
