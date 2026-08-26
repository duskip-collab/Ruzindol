-- Keep the latest six RSS announcements; internal announcements keep their expiry cleanup.
BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_expired_announcements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL OR NOT public.can_moderate(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  WITH rss_to_delete AS (
    SELECT id, audio_path
    FROM (
      SELECT id, audio_path,
        row_number() OVER (ORDER BY published_at DESC, id DESC) AS item_number
      FROM public.announcements
      WHERE source = 'rss'
    ) ranked
    WHERE item_number > 6
  ),
  internal_to_delete AS (
    SELECT id, audio_path
    FROM public.announcements
    WHERE source = 'internal'
      AND COALESCE(expires_at, published_at + interval '4 days') <= now()
  ),
  expired AS (
    SELECT id, audio_path FROM rss_to_delete
    UNION ALL
    SELECT id, audio_path FROM internal_to_delete
  ),
  audio_del AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'announcements-audio'
      AND name IN (SELECT audio_path FROM expired WHERE audio_path IS NOT NULL)
  ),
  deleted AS (
    DELETE FROM public.announcements
    WHERE id IN (SELECT id FROM expired)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_announcements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_announcements() TO authenticated;

COMMIT;
