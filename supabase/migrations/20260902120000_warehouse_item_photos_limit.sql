BEGIN;

ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS image_url_2 TEXT,
  ADD COLUMN IF NOT EXISTS image_url_3 TEXT,
  ADD COLUMN IF NOT EXISTS image_url_4 TEXT,
  ADD COLUMN IF NOT EXISTS image_path_2 TEXT,
  ADD COLUMN IF NOT EXISTS image_path_3 TEXT,
  ADD COLUMN IF NOT EXISTS image_path_4 TEXT;

ALTER TABLE public.warehouse_items
  DROP CONSTRAINT IF EXISTS warehouse_items_max_four_photos;

ALTER TABLE public.warehouse_items
  ADD CONSTRAINT warehouse_items_max_four_photos CHECK (
    (CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN image_url_2 IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN image_url_3 IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN image_url_4 IS NOT NULL THEN 1 ELSE 0 END) <= 4
  );

CREATE OR REPLACE FUNCTION public.cleanup_expired_warehouse_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    SELECT id, image_path, image_path_2, image_path_3, image_path_4
    FROM public.warehouse_items
    WHERE COALESCE(
      expires_at,
      CASE
        WHEN type IN ('trh', 'darovanie') THEN created_at + interval '30 days'
        WHEN type = 'sklad_ponuka' THEN created_at + interval '14 days'
        WHEN type = 'sklad_dopyt' THEN created_at + interval '24 hours'
        ELSE created_at + interval '14 days'
      END
    ) <= now()
  ), storage_del AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'warehouse'
      AND name IN (
        SELECT path
        FROM expired
        CROSS JOIN LATERAL unnest(ARRAY[image_path, image_path_2, image_path_3, image_path_4]) AS paths(path)
        WHERE path IS NOT NULL AND path <> ''
      )
  ), deleted AS (
    DELETE FROM public.warehouse_items
    WHERE id IN (SELECT id FROM expired)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM deleted;
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMIT;