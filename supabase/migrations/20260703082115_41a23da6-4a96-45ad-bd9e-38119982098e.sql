
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('rss','internal')),
  external_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  priority TEXT NOT NULL DEFAULT 'oznam' CHECK (priority IN ('oznam','prioritne','urgentne','vystraha')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_announcements_published_at ON public.announcements(published_at DESC);
CREATE INDEX idx_announcements_priority ON public.announcements(priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "announcements_read_all" ON public.announcements
  FOR SELECT TO authenticated USING (true);

-- Only Starosta / Uradnik / Farar can insert internal announcements (author must be self)
CREATE POLICY "announcements_admin_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'internal'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik','Farar')
    )
  );

-- Admins can update/delete internal, and delete RSS (for cleanup)
CREATE POLICY "announcements_admin_update" ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik'))
  );

CREATE POLICY "announcements_admin_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('Starosta','Uradnik'))
  );

-- Also allow any authenticated user to insert RSS entries (client-side sync)
CREATE POLICY "announcements_rss_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (source = 'rss' AND author_id IS NULL);

-- Allow any authenticated user to delete expired entries (cleanup on sync)
CREATE POLICY "announcements_cleanup_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    (source = 'rss' AND published_at < now() - interval '3 days')
    OR (source = 'internal' AND published_at < now() - interval '4 days')
  );
