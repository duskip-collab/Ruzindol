-- Enable Realtime publication for post_replies table
-- This allows clients to receive real-time updates when replies are created

BEGIN;

-- Set REPLICA IDENTITY to FULL for proper change tracking
ALTER TABLE public.post_replies REPLICA IDENTITY FULL;

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

COMMIT;
