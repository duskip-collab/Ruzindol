-- Enable Realtime publication for multiple tables
-- This allows clients to receive real-time updates for:
-- - post_replies (bulletin board comments)
-- - group_announcements (group news)
-- - group_admins (group management)
-- - announcements (fullscreen alerts)
-- - mayor_inquiries (mayor question submissions)
-- - app_settings (global application settings like elections)

BEGIN;

-- Set REPLICA IDENTITY to FULL for proper change tracking
ALTER TABLE IF EXISTS public.post_replies REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.group_announcements REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.group_admins REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.announcements REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.mayor_inquiries REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.app_settings REPLICA IDENTITY FULL;

-- Add post_replies to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'post_replies'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.post_replies';
    RAISE NOTICE 'Added post_replies to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'post_replies already in supabase_realtime publication';
  END IF;
END
$$;

-- Add group_announcements to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_announcements'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_announcements';
    RAISE NOTICE 'Added group_announcements to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'group_announcements already in supabase_realtime publication';
  END IF;
END
$$;

-- Add group_admins to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_admins'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_admins';
    RAISE NOTICE 'Added group_admins to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'group_admins already in supabase_realtime publication';
  END IF;
END
$$;

-- Add announcements to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'announcements'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements';
    RAISE NOTICE 'Added announcements to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'announcements already in supabase_realtime publication';
  END IF;
END
$$;

-- Add mayor_inquiries to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mayor_inquiries'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mayor_inquiries';
    RAISE NOTICE 'Added mayor_inquiries to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'mayor_inquiries already in supabase_realtime publication';
  END IF;
END
$$;

-- Add app_settings to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_settings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings';
    RAISE NOTICE 'Added app_settings to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'app_settings already in supabase_realtime publication';
  END IF;
END
$$;

COMMIT;
