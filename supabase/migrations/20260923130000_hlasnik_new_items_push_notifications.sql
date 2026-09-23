-- =============================================================================
-- Obecný hlásnik – univerzálny spúšťač push notifikácií pre NOVÉ položky
-- zobrazené na hlavnej ploche hlásnika.
--
-- Hlásnik (src/hooks/useHlasnikFeed.ts) zobrazuje tri zdroje:
--   1) `announcements` (source = 'rss')  – najnovšie RSS aktuality
--   2) `events` (type <> 'odpad')        – termíny kalendára na DNES a ZAJTRA
--   3) `events` (type  = 'odpad')        – termíny vývozu odpadu na DNES a ZAJTRA
--
-- Doteraz mali push notifikáciu iba príspevky typu `hlasnik`/`official_alert`
-- (tabuľka `posts`), interné oznamy (source = 'internal') a skupinové oznamy.
-- Táto migrácia dopĺňa presne tie dve chýbajúce vetvy:
--   * nová RSS aktualita vo `announcements`            → typ `rss_announcement`
--   * nový termín v `events` (dnes/zajtra, aj odpad)   → typ `calendar_event`
--
-- Postup je identický s existujúcim pipeline (bez zmeny ostatného kódu):
--   INSERT do zdrojovej tabuľky → trigger → public.notifications
--   → Database Webhook → Edge Function `send-push` → WebPush odberateľom.
--
-- Spúšťa sa IBA pri INSERT (nie UPDATE), takže opakovaný RSS sync / upsert
-- (ON CONFLICT DO UPDATE) nikdy nevygeneruje notifikáciu pre už známu položku.
-- Všetky zmeny sú aditívne – existujúce triggre a notifikácie ostávajú presne
-- také, aké boli.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) RSS aktuality (announcements, source = 'rss')
--    – nová položka v hlásniku nesie nadpis aktuality + krátky výňatok obsahu
--    – odkaz vedie priamo do podsekcie RSS v Aktualitách (rovnako ako kartička
--      hlásnika v src/components/ObecnyHlasnik.tsx)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_notifications_for_rss_announcements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priority TEXT;
  v_is_critical BOOLEAN;
BEGIN
  -- Iba nové RSS položky (interné oznamy majú vlastný trigger nižšie/pôvodný).
  IF lower(COALESCE(NEW.source, '')) <> 'rss' THEN
    RETURN NEW;
  END IF;

  -- Hlásnik zobrazuje RSS len 5 dní od publikovania (NEWS_MAX_AGE_MS) – položku
  -- bez dátumu publikovania alebo staršiu ako 5 dní by používateľ na hlavnej
  -- ploche vôbec nevidel, preto sa push pre ňu neposiela.
  IF NEW.published_at IS NULL OR NEW.published_at < now() - INTERVAL '5 days' THEN
    RETURN NEW;
  END IF;

  v_priority := lower(COALESCE(NULLIF(btrim(NEW.priority), ''), 'oznam'));
  v_is_critical := v_priority IN ('vystraha', 'urgentne', 'urgent', 'high');

  INSERT INTO public.notifications (user_id, type, title, body, ref_id, url, priority, is_critical)
  SELECT
    p.id,
    'rss_announcement',
    COALESCE(NULLIF(btrim(NEW.title), ''), 'Nová aktualita'),
    left(COALESCE(NEW.content, ''), 240),
    NEW.id,
    '/aktuality?tile=oznamy&sub=rss',
    v_priority,
    v_is_critical
  FROM public.profiles p;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notifications_rss_announcements ON public.announcements;
CREATE TRIGGER trg_enqueue_notifications_rss_announcements
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notifications_for_rss_announcements();

-- -----------------------------------------------------------------------------
-- 2) Termíny v kalendári (events)
--    – hlásnik zobrazuje iba termíny pripadajúce na DNES a ZAJTRA (deň vopred),
--      preto sa notifikuje výhradne pre tento časový interval (lokálny čas SR).
--      Bez tohto filtra by jednorazový sync obce (až 40 udalostí naraz) poslal
--      desiatky push správ, ktoré na hlavnej ploche ani nie sú viditeľné.
--    – zber odpadu (type = 'odpad') vedie do kalendára zberu odpadu
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_notifications_for_calendar_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_is_waste BOOLEAN;
  v_url TEXT;
BEGIN
  -- Začiatok dnešného dňa a začiatok dňa po zajtrajšku (exkluzívna hranica),
  -- v európskom lokálnom čase (rovnako ako zberový kalendár a hlásnik).
  v_day_start := date_trunc('day', (now() AT TIME ZONE 'Europe/Bratislava'))
    AT TIME ZONE 'Europe/Bratislava';
  v_day_end := (date_trunc('day', (now() AT TIME ZONE 'Europe/Bratislava')) + INTERVAL '2 days')
    AT TIME ZONE 'Europe/Bratislava';

  IF NEW.starts_at < v_day_start OR NEW.starts_at >= v_day_end THEN
    RETURN NEW;
  END IF;

  v_is_waste := lower(COALESCE(NEW.type, '')) = 'odpad';
  v_url := CASE WHEN v_is_waste THEN '/kalendar?category=odpad' ELSE '/kalendar' END;

  INSERT INTO public.notifications (user_id, type, title, body, ref_id, url, priority, is_critical)
  SELECT
    p.id,
    'calendar_event',
    COALESCE(
      NULLIF(btrim(NEW.title), ''),
      CASE WHEN v_is_waste THEN 'Nový termín vývozu odpadu' ELSE 'Nové podujatie v kalendári' END
    ),
    left(
      COALESCE(NULLIF(btrim(NEW.description), ''), NULLIF(btrim(NEW.location), ''), ''),
      240
    ),
    NEW.id,
    v_url,
    'oznam',
    false
  FROM public.profiles p
  WHERE NEW.author_id IS NULL OR p.id <> NEW.author_id
    -- Poistka proti duplicitnej notifikácii pre ten istý termín.
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = p.id
        AND n.type = 'calendar_event'
        AND n.ref_id = NEW.id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notifications_calendar_events ON public.events;
CREATE TRIGGER trg_enqueue_notifications_calendar_events
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notifications_for_calendar_events();

COMMIT;
