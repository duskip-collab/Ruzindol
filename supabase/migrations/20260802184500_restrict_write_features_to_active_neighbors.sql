-- Restrict community write actions to users with a valid invite code (active neighbors)
-- while keeping read access for authenticated users.

CREATE OR REPLACE FUNCTION public.can_write_neighbor_content(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND (
        p.is_active_neighbor = true
        OR p.role IN ('Starosta', 'Uradnik', 'Farar', 'VIP_Firma')
        OR public.has_role(_user_id, 'admin'::public.app_role)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_write_neighbor_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_neighbor_content(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

CREATE POLICY "Users can create their own posts"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

DROP POLICY IF EXISTS "Users can create their own warehouse items" ON public.warehouse_items;
DROP POLICY IF EXISTS "Users can update their own warehouse items" ON public.warehouse_items;
DROP POLICY IF EXISTS "Users can delete their own warehouse items" ON public.warehouse_items;

CREATE POLICY "Users can create their own warehouse items"
  ON public.warehouse_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

CREATE POLICY "Users can update their own warehouse items"
  ON public.warehouse_items
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

CREATE POLICY "Users can delete their own warehouse items"
  ON public.warehouse_items
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can create replies on allowed posts" ON public.post_replies;
DROP POLICY IF EXISTS "Users can update own replies" ON public.post_replies;
DROP POLICY IF EXISTS "Users can delete own replies" ON public.post_replies;

CREATE POLICY "Authenticated users can create replies on allowed posts"
  ON public.post_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.posts post
      WHERE post.id = post_id
        AND post.type = 'susedsky_zivot'
        AND post.category IN ('Otazka', 'Straty_a_nalezy', 'Info_pre_susedov')
    )
  );

CREATE POLICY "Users can update own replies"
  ON public.post_replies
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

CREATE POLICY "Users can delete own replies"
  ON public.post_replies
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

DROP POLICY IF EXISTS "Users can add their own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can remove their own likes" ON public.post_likes;

CREATE POLICY "Users can add their own likes"
  ON public.post_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

CREATE POLICY "Users can remove their own likes"
  ON public.post_likes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );

DROP POLICY IF EXISTS "Users can create their own reports" ON public.post_reports;

CREATE POLICY "Users can create their own reports"
  ON public.post_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND public.can_write_neighbor_content(auth.uid())
  );

DROP POLICY IF EXISTS "Buyers can create chats" ON public.chats;
DROP POLICY IF EXISTS "Chat participants can send messages" ON public.messages;

CREATE POLICY "Buyers can create chats"
  ON public.chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id
    AND buyer_id <> seller_id
    AND public.can_write_neighbor_content(auth.uid())
  );

CREATE POLICY "Chat participants can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.can_write_neighbor_content(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
    )
  );
