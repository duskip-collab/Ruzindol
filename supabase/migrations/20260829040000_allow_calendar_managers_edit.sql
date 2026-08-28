DROP POLICY IF EXISTS events_update_owner_or_admin ON public.events;

CREATE POLICY events_update_owner_or_calendar_manager ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Starosta', 'Uradnik')
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Starosta', 'Uradnik')
    )
  );