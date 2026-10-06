BEGIN;

CREATE INDEX IF NOT EXISTS events_waste_collection_starts_at_idx
  ON public.events (starts_at)
  WHERE lower(type) = 'odpad';

CREATE OR REPLACE FUNCTION public.enqueue_waste_collection_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    ref_id,
    url,
    priority,
    is_critical
  )
  SELECT
    p.id,
    'waste_collection_reminder',
    'Nezabudnite! Zajtra je zber komunálneho odpadu',
    format('Podľa kalendára: %s', e.title),
    e.id,
    '/kalendar',
    'oznam',
    false
  FROM public.events e
  CROSS JOIN public.profiles p
  WHERE lower(e.type) = 'odpad'
    AND (e.starts_at AT TIME ZONE 'Europe/Bratislava')::date =
      ((now() AT TIME ZONE 'Europe/Bratislava')::date + 1)
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = p.id
        AND n.type = 'waste_collection_reminder'
        AND n.ref_id = e.id
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_waste_collection_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_waste_collection_notifications() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('enqueue-waste-collection-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'enqueue-waste-collection-notifications',
  '0 * * * *',
  $$SELECT public.enqueue_waste_collection_notifications();$$
);

COMMIT;
