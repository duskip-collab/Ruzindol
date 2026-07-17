DROP POLICY IF EXISTS events_insert_privileged ON public.events;
CREATE POLICY events_insert_privileged ON public.events
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'Starosta'::app_role)
      OR has_role(auth.uid(), 'Uradnik'::app_role)
      OR has_role(auth.uid(), 'Farar'::app_role)
    )
  );