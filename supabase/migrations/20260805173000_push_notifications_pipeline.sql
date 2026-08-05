BEGIN;

-- Push subscriptions: allow multiple devices per user (iOS + Android + desktop).
CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_push_subscriptions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS endpoint TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.user_push_subscriptions
SET id = gen_random_uuid()
WHERE id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_subscriptions_pkey'
      AND conrelid = 'public.user_push_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.user_push_subscriptions
      ADD CONSTRAINT user_push_subscriptions_pkey PRIMARY KEY (id);
  END IF;
END;
$$;

UPDATE public.user_push_subscriptions
SET endpoint = COALESCE(endpoint, subscription->>'endpoint')
WHERE endpoint IS NULL;

DELETE FROM public.user_push_subscriptions
WHERE endpoint IS NULL;

DELETE FROM public.user_push_subscriptions s
USING public.user_push_subscriptions older
WHERE s.endpoint = older.endpoint
  AND s.id < older.id;

ALTER TABLE public.user_push_subscriptions
  ALTER COLUMN endpoint SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_subscriptions_endpoint_key'
      AND conrelid = 'public.user_push_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.user_push_subscriptions
      ADD CONSTRAINT user_push_subscriptions_endpoint_key UNIQUE (endpoint);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user_id
  ON public.user_push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_subscriptions TO authenticated;
GRANT ALL ON public.user_push_subscriptions TO service_role;

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_push_subscriptions_select_own ON public.user_push_subscriptions;
CREATE POLICY user_push_subscriptions_select_own
  ON public.user_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_push_subscriptions_insert_own ON public.user_push_subscriptions;
CREATE POLICY user_push_subscriptions_insert_own
  ON public.user_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_push_subscriptions_update_own ON public.user_push_subscriptions;
CREATE POLICY user_push_subscriptions_update_own
  ON public.user_push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_push_subscriptions_delete_own ON public.user_push_subscriptions;
CREATE POLICY user_push_subscriptions_delete_own
  ON public.user_push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_push_subscriptions_set_updated_at ON public.user_push_subscriptions;
CREATE TRIGGER user_push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.user_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-user notification feed consumed by in-app bell and server-side push dispatch.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  ref_id UUID,
  url TEXT,
  priority TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS ref_id UUID,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.notifications
SET
  type = COALESCE(NULLIF(btrim(type), ''), 'system'),
  body = COALESCE(body, ''),
  is_read = COALESCE(is_read, false),
  is_critical = COALESCE(is_critical, false)
WHERE type IS NULL OR btrim(type) = '' OR body IS NULL OR is_read IS NULL OR is_critical IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id, is_read);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS notifications_set_updated_at ON public.notifications;
CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enqueue_notifications_for_announcements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priority TEXT;
  v_title TEXT;
  v_body TEXT;
  v_is_critical BOOLEAN;
BEGIN
  IF NEW.source <> 'internal' THEN
    RETURN NEW;
  END IF;

  v_priority := lower(COALESCE(NEW.priority, 'oznam'));
  v_title := COALESCE(NULLIF(btrim(NEW.title), ''), 'Aktuality');
  v_body := left(COALESCE(NEW.content, ''), 240);
  v_is_critical := v_priority IN ('vystraha', 'urgentne', 'urgent', 'high');

  INSERT INTO public.notifications (user_id, type, title, body, ref_id, url, priority, is_critical)
  SELECT
    p.id,
    'announcement',
    v_title,
    v_body,
    NEW.id,
    '/aktuality',
    v_priority,
    v_is_critical
  FROM public.profiles p
  WHERE p.id <> COALESCE(NEW.author_id, p.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notifications_announcements ON public.announcements;
CREATE TRIGGER trg_enqueue_notifications_announcements
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notifications_for_announcements();

CREATE OR REPLACE FUNCTION public.enqueue_notifications_for_hlasnik_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priority TEXT;
  v_is_critical BOOLEAN;
BEGIN
  IF lower(COALESCE(NEW.type, '')) <> 'hlasnik' AND lower(COALESCE(NEW.type, '')) <> 'official_alert' THEN
    RETURN NEW;
  END IF;

  v_priority := CASE
    WHEN lower(COALESCE(NEW.category, '')) IN ('vysoka', 'výstraha', 'vystraha') THEN 'vystraha'
    WHEN lower(COALESCE(NEW.category, '')) LIKE '%havar%'
      OR lower(COALESCE(NEW.category, '')) LIKE '%núdz%'
      OR lower(COALESCE(NEW.category, '')) LIKE '%nudz%'
    THEN 'urgentne'
    ELSE 'oznam'
  END;

  v_is_critical := v_priority IN ('vystraha', 'urgentne');

  INSERT INTO public.notifications (user_id, type, title, body, ref_id, url, priority, is_critical)
  SELECT
    p.id,
    'official_alert',
    COALESCE(NULLIF(btrim(NEW.title), ''), 'Obecný hlásnik'),
    left(COALESCE(NEW.content, ''), 240),
    NEW.id,
    '/nastenka',
    v_priority,
    v_is_critical
  FROM public.profiles p
  WHERE p.id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notifications_hlasnik_posts ON public.posts;
CREATE TRIGGER trg_enqueue_notifications_hlasnik_posts
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notifications_for_hlasnik_posts();

CREATE OR REPLACE FUNCTION public.enqueue_notifications_for_group_announcements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, ref_id, url, priority, is_critical)
  SELECT
    p.id,
    'group_announcement',
    COALESCE(NULLIF(btrim(NEW.title), ''), 'Skupinový oznam'),
    left(COALESCE(NEW.content, ''), 240),
    NEW.id,
    '/aktuality',
    'oznam',
    false
  FROM public.profiles p
  WHERE p.id <> NEW.author_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notifications_group_announcements ON public.group_announcements;
CREATE TRIGGER trg_enqueue_notifications_group_announcements
  AFTER INSERT ON public.group_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notifications_for_group_announcements();

COMMIT;
