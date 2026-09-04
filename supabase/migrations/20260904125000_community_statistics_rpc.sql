-- ============================================================================
-- Community Statistics RPC Functions
-- ============================================================================
BEGIN;

-- Function: Get community statistics (registered neighbors, active today, active this month)
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
    -- Active today (sent message, post, or reply in last 24 hours)
    (
      SELECT COUNT(DISTINCT user_id)
      FROM (
        -- Messages from last 24 hours
        SELECT DISTINCT m.sender_id as user_id
        FROM public.messages m
        JOIN public.chats c ON m.chat_id = c.id
        WHERE m.created_at >= NOW() - INTERVAL '24 hours'
          AND (_municipality_id IS NULL OR m.sender_id IN (
            SELECT id FROM public.profiles WHERE municipality_id = _municipality_id
          ))
        UNION
        -- Posts from last 24 hours
        SELECT DISTINCT p.user_id
        FROM public.posts p
        WHERE p.created_at >= NOW() - INTERVAL '24 hours'
          AND (_municipality_id IS NULL OR p.user_id IN (
            SELECT id FROM public.profiles WHERE municipality_id = _municipality_id
          ))
        UNION
        -- Post replies from last 24 hours
        SELECT DISTINCT pr.user_id
        FROM public.post_replies pr
        WHERE pr.created_at >= NOW() - INTERVAL '24 hours'
          AND (_municipality_id IS NULL OR pr.user_id IN (
            SELECT id FROM public.profiles WHERE municipality_id = _municipality_id
          ))
      ) active_users
    ) AS active_today,
    -- Active this month (last 30 days)
    (
      SELECT COUNT(DISTINCT user_id)
      FROM (
        -- Messages from last 30 days
        SELECT DISTINCT m.sender_id as user_id
        FROM public.messages m
        JOIN public.chats c ON m.chat_id = c.id
        WHERE m.created_at >= NOW() - INTERVAL '30 days'
          AND (_municipality_id IS NULL OR m.sender_id IN (
            SELECT id FROM public.profiles WHERE municipality_id = _municipality_id
          ))
        UNION
        -- Posts from last 30 days
        SELECT DISTINCT p.user_id
        FROM public.posts p
        WHERE p.created_at >= NOW() - INTERVAL '30 days'
          AND (_municipality_id IS NULL OR p.user_id IN (
            SELECT id FROM public.profiles WHERE municipality_id = _municipality_id
          ))
        UNION
        -- Post replies from last 30 days
        SELECT DISTINCT pr.user_id
        FROM public.post_replies pr
        WHERE pr.created_at >= NOW() - INTERVAL '30 days'
          AND (_municipality_id IS NULL OR pr.user_id IN (
            SELECT id FROM public.profiles WHERE municipality_id = _municipality_id
          ))
        UNION
        -- Warehouse items created/updated in last 30 days
        SELECT DISTINCT wi.user_id
        FROM public.warehouse_items wi
        WHERE wi.created_at >= NOW() - INTERVAL '30 days'
          AND (_municipality_id IS NULL OR wi.user_id IN (
            SELECT id FROM public.profiles WHERE municipality_id = _municipality_id
          ))
      ) active_users_month
    ) AS active_this_month;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_community_statistics(uuid) TO authenticated;

-- Create index on profiles for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_active_neighbor_municipality
ON public.profiles(is_active_neighbor, municipality_id)
WHERE is_active_neighbor = true;

-- Create index on messages for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at
ON public.messages(sender_id, created_at DESC);

-- Create index on posts for faster queries
CREATE INDEX IF NOT EXISTS idx_posts_user_created_at
ON public.posts(user_id, created_at DESC);

-- Create index on post_replies for faster queries
CREATE INDEX IF NOT EXISTS idx_post_replies_user_created_at
ON public.post_replies(user_id, created_at DESC);

COMMIT;
