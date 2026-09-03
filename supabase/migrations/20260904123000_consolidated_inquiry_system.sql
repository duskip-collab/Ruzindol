-- Konsolidovaný migračný skript pre modul Podnety
BEGIN;

-- 1. Uistíme sa, že tabuľka notifikácií existuje
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  ref_id UUID,
  url TEXT,
  priority TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Trigger pre notifikáciu pri odpovedi na podnet
CREATE OR REPLACE FUNCTION public.handle_inquiry_answer_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger iba ak sa odpoveď zmenila a nie je prázdna
  IF (OLD.answer IS DISTINCT FROM NEW.answer) AND NEW.answer IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      ref_id,
      is_read
    )
    VALUES (
      NEW.user_id,
      'inquiry_answer',
      'Odpoveď na podnet',
      'Váš podnet "' || LEFT(NEW.title, 20) || '..." bol zodpovedaný.',
      NEW.id,
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_inquiry_answer_update ON public.mayor_inquiries;
CREATE TRIGGER on_inquiry_answer_update
AFTER UPDATE ON public.mayor_inquiries
FOR EACH ROW EXECUTE FUNCTION public.handle_inquiry_answer_update();

-- 3. RLS pre notifikácie
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
