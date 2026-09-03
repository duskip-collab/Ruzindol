-- Enable Realtime publication for chats and messages tables
-- This allows clients to receive real-time updates for chat messages

BEGIN;

-- Set REPLICA IDENTITY to FULL for proper change tracking
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add chats to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chats'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chats';
    RAISE NOTICE 'Added chats to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'chats already in supabase_realtime publication';
  END IF;
END
$$;

-- Add messages to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    RAISE NOTICE 'Added messages to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'messages already in supabase_realtime publication';
  END IF;
END
$$;

COMMIT;
