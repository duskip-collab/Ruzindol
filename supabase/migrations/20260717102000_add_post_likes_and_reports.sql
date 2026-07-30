-- Persist likes and reports for bulletin-board posts.
CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX post_likes_post_id_idx ON public.post_likes (post_id);

GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post likes are viewable by everyone"
  ON public.post_likes FOR SELECT USING (true);

CREATE POLICY "Users can add their own likes"
  ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes"
  ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX post_reports_post_id_idx ON public.post_reports (post_id);
CREATE INDEX post_reports_reporter_id_idx ON public.post_reports (reporter_id);

GRANT SELECT ON public.post_reports TO authenticated;
GRANT INSERT ON public.post_reports TO authenticated;
GRANT ALL ON public.post_reports TO service_role;

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own reports"
  ON public.post_reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create their own reports"
  ON public.post_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
