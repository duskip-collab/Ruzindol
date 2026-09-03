-- Fix push subscriptions RLS policies to ensure authenticated users can insert their subscriptions
BEGIN;

-- Disable RLS temporarily to debug and update policies
ALTER TABLE public.user_push_subscriptions DISABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with explicit permissions
DROP POLICY IF EXISTS user_push_subscriptions_select_own ON public.user_push_subscriptions;
DROP POLICY IF EXISTS user_push_subscriptions_insert_own ON public.user_push_subscriptions;
DROP POLICY IF EXISTS user_push_subscriptions_update_own ON public.user_push_subscriptions;
DROP POLICY IF EXISTS user_push_subscriptions_delete_own ON public.user_push_subscriptions;

-- Re-enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Recreate SELECT policy: users can only see their own subscriptions
CREATE POLICY user_push_subscriptions_select_own
  ON public.user_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Recreate INSERT policy with explicit user_id check
-- This policy allows authenticated users to insert if user_id matches their auth.uid()
CREATE POLICY user_push_subscriptions_insert_own
  ON public.user_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND user_id IS NOT NULL
  );

-- Recreate UPDATE policy: users can update their own subscriptions
CREATE POLICY user_push_subscriptions_update_own
  ON public.user_push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id IS NOT NULL
  );

-- Recreate DELETE policy: users can delete their own subscriptions
CREATE POLICY user_push_subscriptions_delete_own
  ON public.user_push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_subscriptions TO authenticated;
GRANT ALL ON public.user_push_subscriptions TO service_role;

COMMIT;
