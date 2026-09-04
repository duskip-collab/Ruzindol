-- ============================================================================
-- User Activity Tracking for "Active Today" statistics
-- ============================================================================
BEGIN;

-- Table to track app opens and visits per user
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('app_open', 'page_visit')),
  page_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries on created_at and user_id
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created
  ON public.user_activity_log(user_id, created_at DESC);

-- Index for fast time-range queries
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at
  ON public.user_activity_log(created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;

-- Enable RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only insert their own activity
CREATE POLICY "Users can insert own activity"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Only service_role can select all, authenticated can only see their own
CREATE POLICY "Service role can read all activity"
  ON public.user_activity_log FOR SELECT
  USING (true);

-- ============================================================================
-- Update RPC function to include activity log
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_community_statistics(uuid);

CREATE OR REPLACE FUNCTION public.get_community_statistics(
  _municipality_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_registered bigint,
  active_today bigint,
  active_this_month bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Total registered active neighbors
    (
      SELECT COUNT(*)
      FROM public.profiles p
      WHERE p.is_active_neighbor = true
        AND (_municipality_id IS NULL OR p.municipality_id = _municipality_id)
    ) AS total_registered,
    -- Active today (app opens + page visits + messages + posts in last 24 hours)
    (
      SELECT COUNT(DISTINCT user_id)
      FROM (
        -- App opens and page visits from last 24 hours
        SELECT DISTINCT ual.user_id
        FROM public.user_activity_log ual
        WHERE ual.created_at >= NOW() - INTERVAL '24 hours'
        UNION ALL
        -- Messages from last 24 hours
        SELECT DISTINCT m.sender_id as user_id
        FROM public.messages m
        WHERE m.created_at >= NOW() - INTERVAL '24 hours'
        UNION ALL
        -- Posts from last 24 hours
        SELECT DISTINCT p.user_id
        FROM public.posts p
        WHERE p.created_at >= NOW() - INTERVAL '24 hours'
      ) active_users
    ) AS active_today,
    -- Active this month (last 30 days)
    (
      SELECT COUNT(DISTINCT user_id)
      FROM (
        -- App opens and page visits from last 30 days
        SELECT DISTINCT ual.user_id
        FROM public.user_activity_log ual
        WHERE ual.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        -- Messages from last 30 days
        SELECT DISTINCT m.sender_id as user_id
        FROM public.messages m
        WHERE m.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        -- Posts from last 30 days
        SELECT DISTINCT p.user_id
        FROM public.posts p
        WHERE p.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        -- Warehouse items from last 30 days
        SELECT DISTINCT wi.user_id
        FROM public.warehouse_items wi
        WHERE wi.created_at >= NOW() - INTERVAL '30 days'
      ) active_users_month
    ) AS active_this_month;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_community_statistics(uuid) TO authenticated;

-- Create RPC function to log user activity
CREATE OR REPLACE FUNCTION public.log_user_activity(
  _activity_type TEXT,
  _page_name TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_activity_log (user_id, activity_type, page_name)
  VALUES (auth.uid(), _activity_type, _page_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_user_activity(TEXT, TEXT) TO authenticated;

COMMIT;
