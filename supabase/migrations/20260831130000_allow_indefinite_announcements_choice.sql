-- ============================================================================
-- MIGRÁCIA PRE MOŽNOSŤ INZEROVANIA / PRÍSPEVKOV NA NEURČITO (BEZ EXPIRÁCIE)
-- ============================================================================

BEGIN;

-- Umožňuje nulovú hodnotu v stĺpci expires_at pre inzerovanie na neurčito
ALTER TABLE public.group_announcements
  ALTER COLUMN expires_at DROP NOT NULL;

-- Aktualizácia trigger funkcie, aby rešpektovala explicitnú hodnotu expires_at
-- (ak používateľ zvolí inzerovanie na neurčito, expires_at zostane NULL).
CREATE OR REPLACE FUNCTION public.set_group_announcement_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.expires_at IS NULL AND NEW.group_key = 'sluzby' THEN
      NEW.expires_at := NULL;
    ELSIF NEW.expires_at IS NOT NULL THEN
      -- Ponechá nastavený dátum expirácie
      NULL;
    ELSIF NEW.group_key = 'sluzby' THEN
      NEW.expires_at := NULL;
    ELSE
      -- Pre ostatné sekcie, ak nie je explicitne stanovené inak
      NEW.expires_at := COALESCE(NEW.created_at, now()) + interval '4 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
