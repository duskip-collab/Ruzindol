-- Modul "Akcie v okolí" bol zrušený.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tazky-aktualizuj-okolite-akcie') THEN
    PERFORM cron.unschedule('tazky-aktualizuj-okolite-akcie');
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.replace_okolite_akcie(JSONB);
DROP TABLE IF EXISTS public.okolite_akcie;
