-- Verification only: run in Supabase SQL Editor after applying
-- 20260826130000_keep_latest_six_rss_announcements.sql.

SELECT
  count(*) AS rss_count,
  min(published_at) AS oldest_rss,
  max(published_at) AS newest_rss
FROM public.announcements
WHERE source = 'rss';

SELECT
  id,
  external_id,
  title,
  published_at
FROM public.announcements
WHERE source = 'rss'
ORDER BY published_at DESC, id DESC
LIMIT 6;

SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.announcements'::regclass
  AND contype = 'u'
  AND pg_get_constraintdef(oid) LIKE '%source%external_id%';

-- Expected result: rss_count is 6 (or fewer only when the RSS feed itself
-- currently contains fewer than six items).
