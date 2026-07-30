CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  municipality_id UUID REFERENCES public.municipalities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  type TEXT NOT NULL DEFAULT 'Samosprava' CHECK (type IN ('Samosprava', 'Kostol')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events (starts_at ASC);
CREATE INDEX IF NOT EXISTS events_municipality_id_idx ON public.events (municipality_id);

GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_all ON public.events;
CREATE POLICY events_select_all ON public.events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS events_update_owner_or_admin ON public.events;
CREATE POLICY events_update_owner_or_admin ON public.events
  FOR UPDATE USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS events_delete_owner_or_admin ON public.events;
CREATE POLICY events_delete_owner_or_admin ON public.events
  FOR DELETE USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS events_insert_privileged ON public.events;
CREATE POLICY events_insert_privileged ON public.events
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'Starosta'::public.app_role)
      OR public.has_role(auth.uid(), 'Uradnik'::public.app_role)
      OR public.has_role(auth.uid(), 'Farar'::public.app_role)
    )
  );

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();