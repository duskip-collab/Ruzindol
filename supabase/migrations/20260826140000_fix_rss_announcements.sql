-- RSS Ružindol: keep only the six newest imported announcements.
-- Apply in Supabase SQL Editor or with `supabase db push`.
BEGIN;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY published_at DESC, id DESC) AS item_number
  FROM public.announcements
  WHERE source = 'rss'
)
DELETE FROM public.announcements a
USING ranked r
WHERE a.id = r.id
  AND r.item_number > 6;

-- Keep the conflict target used by the Edge Function explicit for RSS rows.
CREATE UNIQUE INDEX IF NOT EXISTS announcements_rss_external_id_uidx
  ON public.announcements (source, external_id)
  WHERE source = 'rss' AND external_id IS NOT NULL;

COMMIT;

-- Verify after the next Edge Function run:
SELECT id, external_id, title, published_at
FROM public.announcements
WHERE source = 'rss'
ORDER BY published_at DESC, id DESC
LIMIT 6;
