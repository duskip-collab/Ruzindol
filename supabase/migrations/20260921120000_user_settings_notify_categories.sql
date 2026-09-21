BEGIN;

-- =============================================================================
-- Voliteľné filtre záujmov pre notifikácie (doplnok k `notifications_enabled`).
--
-- Každý stĺpec je samostatná kategória notifikácií. DEFAULT true znamená, že
-- existujúci používatelia aj nové riadky majú všetky kategórie zapnuté – teda
-- systém zasielania sa správa presne ako doteraz (100 % spätná kompatibilita).
-- Užívateľ si môže jednotlivé kategórie vypnúť v profile (ProfilScreen).
--
-- Edge Function `send-push` pred odoslaním číta tieto stĺpce; ak tabuľka/stĺpec
-- neexistuje alebo hodnota nie je `false`, notifikácia prejde štandardne.
-- Kritické notifikácie (výstraha/urgentné) sa odosielajú vždy.
-- =============================================================================

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notify_obecne BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notify_havarie BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notify_kulturne BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notify_farske BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notify_ostatne BOOLEAN NOT NULL DEFAULT true;

-- Backfill istoty pre prípad, že by niektoré riadky vznikli pred DEFAULT-om.
UPDATE public.user_settings
SET
  notify_obecne = COALESCE(notify_obecne, true),
  notify_havarie = COALESCE(notify_havarie, true),
  notify_kulturne = COALESCE(notify_kulturne, true),
  notify_farske = COALESCE(notify_farske, true),
  notify_ostatne = COALESCE(notify_ostatne, true);

-- RLS na tabuľke už je nastavené (policies user_settings_select/insert/update_own
-- z migrácie 20260804121000) – nové stĺpce nie je potrebné nijako upravovať.
-- Pre istotu len explicitne povolíme prístup pre service_role (Edge Function).
GRANT SELECT, UPDATE ON public.user_settings TO service_role;

COMMIT;