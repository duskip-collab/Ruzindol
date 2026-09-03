-- Konsolidovaný migračný skript pre modul Podnety od občanov
BEGIN;

-- ============================================================================
-- 1. TABUĽKA NOTIFIKÁCIÍ
-- ============================================================================
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

-- Indexy pre notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- RLS pre notifikácie
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. ROZŠÍRENIE MAYOR_INQUIRIES - INDEXY A VALIDÁCIA
-- ============================================================================

-- Indexy pre mayor_inquiries
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_user_id ON public.mayor_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_status ON public.mayor_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_category ON public.mayor_inquiries(category);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_created_at ON public.mayor_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_is_public ON public.mayor_inquiries(is_public);

-- ============================================================================
-- 3. TRIGGERY PRE PODNETY
-- ============================================================================

-- Trigger: Automatická notifikácia keď sa odpoveď vloží/zmení
CREATE OR REPLACE FUNCTION public.handle_inquiry_answer_update()
RETURNS TRIGGER AS $$
DECLARE
  v_title_snippet TEXT;
BEGIN
  -- Spustiť iba ak sa odpoveď zmenila na novú (nie NULL)
  IF (OLD.answer IS DISTINCT FROM NEW.answer) AND NEW.answer IS NOT NULL THEN
    -- Skrátiť názov podnetu na max 30 znakov
    v_title_snippet := SUBSTRING(NEW.title, 1, 30);
    IF LENGTH(NEW.title) > 30 THEN
      v_title_snippet := v_title_snippet || '...';
    END IF;

    -- Vložiť notifikáciu autorovi podnetu
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      ref_id,
      url,
      priority,
      is_critical,
      is_read
    )
    VALUES (
      NEW.user_id,
      'inquiry_answer',
      'Odpoveď na podnet: ' || v_title_snippet,
      NEW.answer,
      NEW.id,
      '/aktuality?section=inquiries&id=' || NEW.id,
      'high',
      false,
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

-- Trigger: Automatická notifikácia keď sa zmení stav na "in_progress"
CREATE OR REPLACE FUNCTION public.handle_inquiry_status_update()
RETURNS TRIGGER AS $$
DECLARE
  v_title_snippet TEXT;
  v_status_message TEXT;
BEGIN
  -- Spustiť iba ak sa stav zmenil
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_title_snippet := SUBSTRING(NEW.title, 1, 30);
    IF LENGTH(NEW.title) > 30 THEN
      v_title_snippet := v_title_snippet || '...';
    END IF;

    -- Nastavit správu podľa nového stavu
    CASE NEW.status
      WHEN 'in_progress' THEN
        v_status_message := 'Váš podnet je v riešení.';
      WHEN 'resolved' THEN
        v_status_message := 'Váš podnet bol vyriešený. Pozrite si odpoveď.';
      WHEN 'rejected' THEN
        v_status_message := 'Váš podnet bol zamietnutý.';
      ELSE
        v_status_message := 'Stav vášho podnetu sa zmenil na: ' || NEW.status;
    END CASE;

    -- Vložiť notifikáciu len ak je to zmena (nie insert)
    IF OLD.id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        ref_id,
        url,
        priority,
        is_critical,
        is_read
      )
      VALUES (
        NEW.user_id,
        'inquiry_status_update',
        'Podnet: ' || v_title_snippet,
        v_status_message,
        NEW.id,
        '/aktuality?section=inquiries&id=' || NEW.id,
        CASE WHEN NEW.status = 'resolved' THEN 'medium' ELSE 'low' END,
        false,
        false
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_inquiry_status_update ON public.mayor_inquiries;
CREATE TRIGGER on_inquiry_status_update
AFTER UPDATE ON public.mayor_inquiries
FOR EACH ROW EXECUTE FUNCTION public.handle_inquiry_status_update();

-- ============================================================================
-- 4. RLS POLITIKY PRE MAYOR_INQUIRIES
-- ============================================================================

-- Readers: Prihláseí používatelia vidia verejné podnety + svoje podnety
DROP POLICY IF EXISTS "Authenticated users can read inquiries" ON public.mayor_inquiries;
CREATE POLICY "Authenticated users can read inquiries" ON public.mayor_inquiries
  FOR SELECT TO authenticated
  USING (
    is_public = true
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_official = true OR role = 'Starosta' OR role = 'Uradnik')
    )
  );

-- Insert: Iba active_neighbor a oficialní používatelia môžu vytvoriť podnet
DROP POLICY IF EXISTS "Active neighbors and officials can create inquiries" ON public.mayor_inquiries;
CREATE POLICY "Active neighbors and officials can create inquiries" ON public.mayor_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active_neighbor = true
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR is_official = true OR role = 'Starosta' OR role = 'Uradnik')
      )
    )
  );

-- Update: Iba admin/starosta/uradnik môžu updatovať podnety
DROP POLICY IF EXISTS "Admins and officials can update inquiries" ON public.mayor_inquiries;
CREATE POLICY "Admins and officials can update inquiries" ON public.mayor_inquiries
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_official = true OR role = 'Starosta' OR role = 'Uradnik')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_official = true OR role = 'Starosta' OR role = 'Uradnik')
    )
  );

-- Delete: Iba admin môžu mazať podnety
DROP POLICY IF EXISTS "Only admins can delete inquiries" ON public.mayor_inquiries;
CREATE POLICY "Only admins can delete inquiries" ON public.mayor_inquiries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

COMMIT;
