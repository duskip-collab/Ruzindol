-- ============================================================================
-- Pridanie notifikácií pre príspevky v "Susedský život" (susedsky_zivot)
-- ============================================================================
-- Logika: Keď používateľ vytvorí príspevok typu "susedsky_zivot", vytvoriť
-- notifikáciu pre všetkých ostatných profilov v komunite (podobne ako hlasnik).
-- 
-- Existujúce notifikácie ostávajú bez zmien:
-- - hlasnik (Obecný hlásnik) → typ "official_alert"
-- - announcements (RSS) → typ "announcement"
-- - group_announcements → typ "group_announcement"
-- - inquiry_answer (Podnety) → typ "inquiry_answer"
-- ============================================================================

BEGIN;

-- Vytvoriť trigger funkciu pre notifikácie príspevkov "Susedský život"
CREATE OR REPLACE FUNCTION public.enqueue_notifications_for_susedsky_zivot_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Filtruj len príspevky typu "susedsky_zivot"
  IF lower(COALESCE(NEW.type, '')) <> 'susedsky_zivot' THEN
    RETURN NEW;
  END IF;

  -- Vytvoriť notifikáciu pre všetkých ostatných v komunite
  INSERT INTO public.notifications (user_id, type, title, body, ref_id, url, priority, is_critical)
  SELECT
    p.id,
    'neighbor_post',
    COALESCE(NULLIF(btrim(NEW.title), ''), 'Príspevok v Susedskom živote'),
    left(COALESCE(NEW.content, ''), 240),
    NEW.id,
    '/nastenka',
    'oznam',
    false
  FROM public.profiles p
  WHERE p.id <> NEW.user_id;  -- Všetkým okrem autora

  RETURN NEW;
END;
$$;

-- Vytvoriť trigger na tabuľke "posts" pre typ "susedsky_zivot"
DROP TRIGGER IF EXISTS trg_enqueue_notifications_susedsky_zivot_posts ON public.posts;
CREATE TRIGGER trg_enqueue_notifications_susedsky_zivot_posts
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notifications_for_susedsky_zivot_posts();

COMMIT;
