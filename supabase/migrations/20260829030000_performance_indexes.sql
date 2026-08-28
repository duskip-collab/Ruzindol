BEGIN;

CREATE INDEX IF NOT EXISTS profiles_municipality_name_idx
  ON public.profiles (municipality_id, name);

CREATE INDEX IF NOT EXISTS events_municipality_starts_at_idx
  ON public.events (municipality_id, starts_at ASC);

CREATE INDEX IF NOT EXISTS announcements_source_published_at_idx
  ON public.announcements (source, published_at DESC);

COMMIT;