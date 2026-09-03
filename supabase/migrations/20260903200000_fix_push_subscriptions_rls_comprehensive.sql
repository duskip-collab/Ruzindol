-- Fix user_push_subscriptions RLS policies for reliable upsert operations
-- Problem: INSERT and UPDATE operations are being blocked by RLS policies
-- Solution: Create permissive policies that allow all authenticated operations to own records
-- Also ensure composite UNIQUE constraint (user_id, endpoint) is in place

BEGIN;

-- Step 1: Ensure composite UNIQUE constraint on (user_id, endpoint) exists
DO $$
BEGIN
  -- Drop single-column endpoint unique constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_subscriptions_endpoint_key'
      AND conrelid = 'public.user_push_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.user_push_subscriptions
      DROP CONSTRAINT user_push_subscriptions_endpoint_key;
    RAISE NOTICE 'Dropped single-column endpoint unique constraint';
  END IF;

  -- Add composite constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_subscriptions_user_id_endpoint_key'
      AND conrelid = 'public.user_push_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.user_push_subscriptions
      ADD CONSTRAINT user_push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);
    RAISE NOTICE 'Added composite UNIQUE constraint on (user_id, endpoint)';
  ELSE
    RAISE NOTICE 'Composite UNIQUE constraint already exists';
  END IF;
END;
$$;

-- Step 2: Set REPLICA IDENTITY for Realtime
ALTER TABLE IF EXISTS public.user_push_subscriptions REPLICA IDENTITY FULL;

-- Step 3: Disable RLS temporarily to update policies cleanly
ALTER TABLE public.user_push_subscriptions DISABLE ROW LEVEL SECURITY;

-- Step 4: Drop all existing policies
DROP POLICY IF EXISTS user_push_subscriptions_select_own ON public.user_push_subscriptions;
DROP POLICY IF EXISTS user_push_subscriptions_insert_own ON public.user_push_subscriptions;
DROP POLICY IF EXISTS user_push_subscriptions_update_own ON public.user_push_subscriptions;
DROP POLICY IF EXISTS user_push_subscriptions_delete_own ON public.user_push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.user_push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.user_push_subscriptions;

-- Step 5: Re-enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Step 6: Recreate RLS policies - PERMISSIVE to allow operations

-- SELECT policy: users can see their own subscriptions
CREATE POLICY user_push_subscriptions_select_own
  ON public.user_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy: authenticated users can insert subscriptions for themselves
-- No WITH CHECK for insert-only constraint check
CREATE POLICY user_push_subscriptions_insert_own
  ON public.user_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: users can update their own subscriptions
-- Both USING and WITH CHECK to ensure user_id consistency
CREATE POLICY user_push_subscriptions_update_own
  ON public.user_push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy: users can delete their own subscriptions
CREATE POLICY user_push_subscriptions_delete_own
  ON public.user_push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 7: Ensure grants are correct
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_subscriptions TO authenticated;
GRANT ALL ON public.user_push_subscriptions TO service_role;

-- Step 8: Enable Realtime publication if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_push_subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_push_subscriptions';
    RAISE NOTICE 'Added user_push_subscriptions to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'user_push_subscriptions already in supabase_realtime publication';
  END IF;
END
$$;

COMMIT;
