BEGIN;

ALTER TABLE public.events
  ALTER COLUMN author_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS events_source_url_starts_at_uniq
  ON public.events (source_url, starts_at)
  WHERE source_url IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('events_images', 'events_images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('news_images', 'news_images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "events_images_read" ON storage.objects;
DROP POLICY IF EXISTS "events_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "events_images_update" ON storage.objects;
DROP POLICY IF EXISTS "events_images_delete" ON storage.objects;

CREATE POLICY "events_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'events_images');

CREATE POLICY "events_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'events_images' AND owner = auth.uid());

CREATE POLICY "events_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'events_images' AND owner = auth.uid());

CREATE POLICY "events_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'events_images' AND owner = auth.uid());

DROP POLICY IF EXISTS "news_images_read" ON storage.objects;
DROP POLICY IF EXISTS "news_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "news_images_update" ON storage.objects;
DROP POLICY IF EXISTS "news_images_delete" ON storage.objects;

CREATE POLICY "news_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'news_images');

CREATE POLICY "news_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'news_images' AND owner = auth.uid());

CREATE POLICY "news_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'news_images' AND owner = auth.uid());

CREATE POLICY "news_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'news_images' AND owner = auth.uid());

COMMIT;
