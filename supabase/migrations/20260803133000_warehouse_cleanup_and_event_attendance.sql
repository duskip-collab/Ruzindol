BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.warehouse_items
SET expires_at = CASE
  WHEN type IN ('trh', 'darovanie') THEN created_at + interval '30 days'
  WHEN type = 'sklad_ponuka' THEN created_at + interval '14 days'
  WHEN type = 'sklad_dopyt' THEN created_at + interval '24 hours'
  ELSE created_at + interval '14 days'
END
WHERE expires_at IS NULL;

ALTER TABLE public.warehouse_items
  ALTER COLUMN expires_at SET DEFAULT now() + interval '30 days';

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
    SELECT id, image_path
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
        SELECT image_path
        FROM expired
        WHERE image_path IS NOT NULL AND image_path <> ''
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

REVOKE ALL ON FUNCTION public.cleanup_expired_warehouse_items() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_warehouse_items() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-warehouse-items');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-warehouse-items',
  '25 * * * *',
  $$SELECT public.cleanup_expired_warehouse_items();$$
);

CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.event_attendees TO authenticated;
GRANT ALL ON public.event_attendees TO service_role;

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_attendees_select_all ON public.event_attendees;
CREATE POLICY event_attendees_select_all ON public.event_attendees
  FOR SELECT USING (true);

DROP POLICY IF EXISTS event_attendees_insert_own ON public.event_attendees;
CREATE POLICY event_attendees_insert_own ON public.event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS event_attendees_delete_own ON public.event_attendees;
CREATE POLICY event_attendees_delete_own ON public.event_attendees
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMIT;