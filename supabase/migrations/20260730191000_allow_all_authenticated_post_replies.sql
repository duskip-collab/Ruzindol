DROP POLICY IF EXISTS "Active neighbors can create replies on allowed posts" ON public.post_replies;
DROP POLICY IF EXISTS "Authenticated users can create replies on allowed posts" ON public.post_replies;

CREATE POLICY "Authenticated users can create replies on allowed posts"
  ON public.post_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND p.type = 'susedsky_zivot'
        AND p.category IN ('Otazka', 'Straty_a_nalezy', 'Info_pre_susedov')
    )
  );
