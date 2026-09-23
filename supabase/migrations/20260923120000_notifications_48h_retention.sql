-- =============================================================================
-- Notifikácie: životnosť 48 hodín (2 dni) – zobrazenie + automatické mazanie
-- 1) Používateľ smie mazať VLASTNÉ staré notifikácie (frontend cleanup pri načítaní)
-- 2) RLS DELETE politika – len vlastné riadky (cudzie osobné správy nezmazal)
-- 3) Globálne mazanie VŠETKÝCH notifikácií starších ako 48 h (pg_cron, každú hodinu)
-- =============================================================================-

-- 1) Oprávnenie na mazanie pre prihlásených používateľov (doteraz len SELECT, UPDATE)
GRANT DELETE ON public.notifications TO authenticated;

-- 2) RLS: používateľ smie zmazať len svoje notifikácie
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3) Cleanup funkcia: maže VŠETKY notifikácie staršie ako 48 hodín
CREATE OR REPLACE FUNCTION public.cleanup_notifications_retention_48h()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '48 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_notifications_retention_48h() TO service_role;

-- Okamžité vyčistenie už existujúcich starých záznamov pri nasadení migrácie
SELECT public.cleanup_notifications_retention_48h();

-- 4) Cron: každú hodinu o 17 minúte (pravidelné automatické mazanie)
DO $$
BEGIN
  PERFORM cron.unschedule('notifications-retention-48h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notifications-retention-48h',
  '17 * * * *',
  $cron$ SELECT public.cleanup_notifications_retention_48h(); $cron$
);