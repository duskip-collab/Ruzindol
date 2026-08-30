-- Migration for push subscriptions table
-- Add unique constraint to ensure upsert works correctly
ALTER TABLE public.user_push_subscriptions 
ADD CONSTRAINT user_push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);

-- Enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.user_push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_push_subscriptions;

-- Create Policies
CREATE POLICY "Users can insert their own subscriptions" ON public.user_push_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscriptions" ON public.user_push_subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions" ON public.user_push_subscriptions
FOR DELETE USING (auth.uid() = user_id);
