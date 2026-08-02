
-- 1) posts: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts viewable by authenticated"
  ON public.posts FOR SELECT
  TO authenticated
  USING (true);

-- 2) warehouse_items: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Warehouse items are viewable by everyone" ON public.warehouse_items;
CREATE POLICY "Warehouse items viewable by authenticated"
  ON public.warehouse_items FOR SELECT
  TO authenticated
  USING (true);

-- 3) profiles: replace blanket SELECT with scoped policy (own / same municipality / admin)
CREATE OR REPLACE FUNCTION public.current_user_municipality()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT municipality_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.current_user_municipality() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_municipality() TO authenticated;

DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles scoped read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      municipality_id IS NOT NULL
      AND municipality_id = public.current_user_municipality()
    )
  );

-- 4) announcements: remove the "any authenticated user can delete expired" policy
DROP POLICY IF EXISTS "announcements_cleanup_delete" ON public.announcements;

CREATE OR REPLACE FUNCTION public.cleanup_expired_announcements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_count int;
BEGIN
  IF v_uid IS NULL OR NOT public.can_moderate(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  WITH expired AS (
    SELECT id, audio_path
    FROM public.announcements
    WHERE (source = 'rss' AND published_at < now() - interval '3 days')
       OR (
         source = 'internal'
         AND COALESCE(expires_at, published_at + interval '4 days') <= now()
       )
  ),
  audio_del AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'announcements-audio'
      AND name IN (SELECT audio_path FROM expired WHERE audio_path IS NOT NULL)
  ),
  del AS (
    DELETE FROM public.announcements
     WHERE id IN (SELECT id FROM expired)
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_expired_announcements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_announcements() TO authenticated;

-- 5) invite_codes: add a scoped SELECT policy so a user can read only the code they redeemed
CREATE POLICY "Users can read own redeemed invite code"
  ON public.invite_codes FOR SELECT
  TO authenticated
  USING (used_by = auth.uid());

-- 6) SECURITY DEFINER functions: revoke execute on internal helper/trigger/cron functions
-- (keep user-facing RPCs callable: has_role, is_banned, can_moderate, redeem_invite_code,
--  ban_neighbor, unban_neighbor, delete_neighbor, current_user_municipality, cleanup_expired_announcements)
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_message_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_used_invite_codes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_used_invite_codes() TO service_role;
REVOKE ALL ON FUNCTION public.cleanup_old_neighbor_posts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_neighbor_posts() TO service_role;
