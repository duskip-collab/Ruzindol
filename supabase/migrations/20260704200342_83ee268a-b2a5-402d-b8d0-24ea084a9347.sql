
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_old_neighbor_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH del AS (
    DELETE FROM public.posts
    WHERE type = 'susedsky_zivot'
      AND category IN ('Otazka','Straty_a_nalezy','Info_pre_susedov')
      AND created_at < now() - interval '4 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_neighbor_posts() FROM PUBLIC, anon, authenticated;

-- Zrušíme staršiu verziu jobu, ak existuje.
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-neighbor-posts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-old-neighbor-posts',
  '15 3 * * *',
  $$SELECT public.cleanup_old_neighbor_posts();$$
);
