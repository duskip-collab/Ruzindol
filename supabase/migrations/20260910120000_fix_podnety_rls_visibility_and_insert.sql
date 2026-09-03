-- ============================================================================
-- OPRAVA MODULU "PODNETY" (mayor_inquiries) — Zjednotenie RLS politík
-- ============================================================================
-- Pravidlá:
-- 1) INSERT (nový podnet) smie iba overený sused s aktivovaným invite kódom
--    (is_active_neighbor = true AND invite_code je nastavený) alebo
--    úradník / starosta / admin.
-- 2) SELECT verejných podnetov (is_public = true) je dostupný všetkým
--    prihláseným používateľom.
-- 3) SELECT neverejných podnetov (is_public = false) je dostupný iba
--    autorovi podnetu alebo rolám admin / uradnik / starosta.
-- 4) UPDATE (pridanie odpovede/vyjadrenia, zmena stavu) smú robiť iba
--    admin / uradnik / starosta.
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Uisti sa, že potrebné stĺpce na profiles existujú (idempotentné)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active_neighbor BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- ----------------------------------------------------------------------------
-- 1. Helper funkcia: je používateľ over./aktivovaný sused (má nárok pridávať podnet)?
--    "Overený sused s aktivovaným invite kódom" = is_active_neighbor = true
--    AND má priradený (aktivovaný) invite_code.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_verified_neighbor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.is_active_neighbor = true
      AND NULLIF(btrim(p.invite_code), '') IS NOT NULL
  )
$$;

REVOKE ALL ON FUNCTION public.is_active_verified_neighbor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_verified_neighbor(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Helper funkcia: je používateľ admin / úradník / starosta (správca podnetov)?
--    Zjednocuje viaceré historické zdroje právomoci (is_admin, is_official,
--    role stĺpec, has_role() tabuľka user_roles), aby politiky boli konzistentné.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_inquiry_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user_id
        AND (
          p.is_admin = true
          OR p.is_official = true
          OR p.role IN ('Starosta', 'Uradnik')
        )
    )
    OR public.has_role(_user_id, 'admin'::public.app_role)
$$;

REVOKE ALL ON FUNCTION public.is_inquiry_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_inquiry_manager(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Tabuľka mayor_inquiries (podnety) — indexy, RLS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mayor_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('odpad', 'cesty_chodniky', 'zelen', 'osvetlenie', 'urad_sluzby', 'ine')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_anonymous_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
  answer TEXT,
  answered_at TIMESTAMPTZ,
  answered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_user_id ON public.mayor_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_status ON public.mayor_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_category ON public.mayor_inquiries(category);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_created_at ON public.mayor_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_is_public ON public.mayor_inquiries(is_public);

ALTER TABLE public.mayor_inquiries ENABLE ROW LEVEL SECURITY;

-- SELECT: verejné podnety vidia všetci prihlásení; neverejné iba autor a
-- admin/uradnik/starosta.
DROP POLICY IF EXISTS "Authenticated users can read inquiries" ON public.mayor_inquiries;
DROP POLICY IF EXISTS "Allow select mayor_inquiries" ON public.mayor_inquiries;
CREATE POLICY "podnety_select_public_or_manager_or_author" ON public.mayor_inquiries
  FOR SELECT TO authenticated
  USING (
    is_public = true
    OR user_id = auth.uid()
    OR public.is_inquiry_manager(auth.uid())
  );

-- INSERT: iba overený sused s aktivovaným invite kódom, alebo admin/uradnik/starosta.
DROP POLICY IF EXISTS "Active neighbors and officials can create inquiries" ON public.mayor_inquiries;
DROP POLICY IF EXISTS "Allow insert active_neighbor mayor_inquiries" ON public.mayor_inquiries;
CREATE POLICY "podnety_insert_verified_neighbor_or_manager" ON public.mayor_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_active_verified_neighbor(auth.uid())
      OR public.is_inquiry_manager(auth.uid())
    )
  );

-- UPDATE: autor môže upraviť vlastný podnet (napr. zrušiť); odpovede/stav
-- (answer, status, answered_at, answered_by) menia iba admin/uradnik/starosta.
-- Kontrola konkrétnych stĺpcov sa vynucuje na frontende + triggerom nižšie,
-- RLS zabezpečuje, že cudzí podnet nemôže upravovať bežný sused.
DROP POLICY IF EXISTS "Admins and officials can update inquiries" ON public.mayor_inquiries;
DROP POLICY IF EXISTS "Allow update admin/official mayor_inquiries" ON public.mayor_inquiries;
CREATE POLICY "podnety_update_author_or_manager" ON public.mayor_inquiries
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_inquiry_manager(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_inquiry_manager(auth.uid())
  );

-- DELETE: iba admin/uradnik/starosta.
DROP POLICY IF EXISTS "Only admins can delete inquiries" ON public.mayor_inquiries;
CREATE POLICY "podnety_delete_manager_only" ON public.mayor_inquiries
  FOR DELETE TO authenticated
  USING (public.is_inquiry_manager(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. Trigger: zabrániť tomu, aby bežný (nie manažér) používateľ zapisoval
--    do polí answer/status/answered_at/answered_by mimo vlastného pôvodného insertu.
--    Toto dopĺňa RLS o ochranu na úrovni stĺpcov (RLS v Postgrese nerozlišuje
--    stĺpce v rámci jedného UPDATE policy).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_inquiry_answer_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_inquiry_manager(auth.uid()) THEN
    -- Bežný autor smie meniť iba svoje vlastné údaje o podnete (napr. is_public),
    -- nie výsledok vybavenia zo strany úradu.
    NEW.answer := OLD.answer;
    NEW.status := OLD.status;
    NEW.answered_at := OLD.answered_at;
    NEW.answered_by := OLD.answered_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_inquiry_answer_columns_trigger ON public.mayor_inquiries;
CREATE TRIGGER guard_inquiry_answer_columns_trigger
BEFORE UPDATE ON public.mayor_inquiries
FOR EACH ROW EXECUTE FUNCTION public.guard_inquiry_answer_columns();

-- ----------------------------------------------------------------------------
-- 5. (Voliteľné rozšírenie) Samostatná tabuľka odpovedí podnety_odpovede,
--    ak by bolo v budúcnosti potrebné viacero odpovedí na jeden podnet
--    (vlákno komunikácie). Aktuálne UI používa jedno pole `answer` priamo
--    na mayor_inquiries, táto tabuľka je pripravená pre budúce rozšírenie
--    a nemá vplyv na existujúce dáta.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.podnety_odpovede (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.mayor_inquiries(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podnety_odpovede_inquiry_id ON public.podnety_odpovede(inquiry_id);

ALTER TABLE public.podnety_odpovede ENABLE ROW LEVEL SECURITY;

-- SELECT: kto vidí podnet (viditeľnosť dedí z mayor_inquiries), vidí aj odpovede.
DROP POLICY IF EXISTS "podnety_odpovede_select" ON public.podnety_odpovede;
CREATE POLICY "podnety_odpovede_select" ON public.podnety_odpovede
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mayor_inquiries mi
      WHERE mi.id = podnety_odpovede.inquiry_id
        AND (
          mi.is_public = true
          OR mi.user_id = auth.uid()
          OR public.is_inquiry_manager(auth.uid())
        )
    )
  );

-- INSERT: iba admin/uradnik/starosta môžu pridávať odpovede/vyjadrenia.
DROP POLICY IF EXISTS "podnety_odpovede_insert_manager_only" ON public.podnety_odpovede;
CREATE POLICY "podnety_odpovede_insert_manager_only" ON public.podnety_odpovede
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_inquiry_manager(auth.uid())
  );

-- UPDATE/DELETE vlastnej odpovede: iba autor odpovede (manažér) alebo admin.
DROP POLICY IF EXISTS "podnety_odpovede_update_own" ON public.podnety_odpovede;
CREATE POLICY "podnety_odpovede_update_own" ON public.podnety_odpovede
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.is_inquiry_manager(auth.uid()))
  WITH CHECK (author_id = auth.uid() AND public.is_inquiry_manager(auth.uid()));

DROP POLICY IF EXISTS "podnety_odpovede_delete_own_or_admin" ON public.podnety_odpovede;
CREATE POLICY "podnety_odpovede_delete_own_or_admin" ON public.podnety_odpovede
  FOR DELETE TO authenticated
  USING (
    (author_id = auth.uid() AND public.is_inquiry_manager(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

COMMIT;
