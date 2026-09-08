-- ============================================================================
-- MIGRÁCIA: VYTVORENIE STORAGE BUCKETU PRE VOĽBY
-- ============================================================================
-- Tvorí storage bucket 'elections' pre nahrávanie PDF a fotografií volieb
-- RLS Politiky pre oprávnené role: admin, Starosta, Uradnik

-- 1. VYTVORENIE BUCKETU (ak neexistuje)
-- V Supabase sa buckety vytvárajú cez SQL, nie cez API
-- Skontrolujeme či bucket existuje, ak nie, vytvoríme ho v UI

-- 2. ROW LEVEL SECURITY (RLS) POLITIKY PRE STORAGE
-- Nastavenie prístupu k súborom v elections buckete

-- Politika pre verejný prístup na čítanie
INSERT INTO storage.buckets (id, name, public)
VALUES ('elections', 'elections', true)
ON CONFLICT (id) DO NOTHING;

-- Politika pre čítanie: Všetci autentifikovaní používatelia môžu čítať
CREATE POLICY "Authenticated users can read elections files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'elections'
    AND (
      auth.role() = 'authenticated'
      OR auth.role() = 'anon'
    )
  );

-- Politika pre zápis: Iba oprávnené role (admin, Starosta, Uradnik) môžu nahrávať
CREATE POLICY "Only authorized users can upload elections files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'elections'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      bucket_id = 'elections'
      AND public.has_role(auth.uid(), 'Starosta'::public.app_role)
    )
    OR (
      bucket_id = 'elections'
      AND public.has_role(auth.uid(), 'Uradnik'::public.app_role)
    )
  );

-- Politika pre mazanie: Iba oprávnené role môžu mazať
CREATE POLICY "Only authorized users can delete elections files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'elections'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'Starosta'::public.app_role)
      OR public.has_role(auth.uid(), 'Uradnik'::public.app_role)
    )
  );

-- POZNÁMKA: Enum hodnoty musia byť presne: 'admin', 'Starosta', 'Uradnik'
-- Bucket sa musí vytvoriť manuálne v Supabase Storage UI alebo cez Supabase Management API
-- V Supabase Dashboard: Storage → "New bucket" → Name: "elections" → Public: ON
