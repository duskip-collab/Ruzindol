-- =============================================================================
-- Modul "Akcie v okolí" (Tip na víkend)  —  NOVÁ, IZOLOVANÁ tabuľka.
--
-- Bezpečnosť / izolácia:
--   * Vytvára sa výhradne NOVÁ tabuľka public.okolite_akcie.
--   * NEMENÍ sa žiadna existujúca tabuľka, stĺpec, funkcia, trigger ani politika.
--   * RLS je zapnutá a povoľuje LEN čítanie (SELECT) pre všetkých návštevníkov
--     (anon aj authenticated).  Zápis (insert/update/delete) NEMÁ žiadnu politiku,
--     takže z aplikácie nie je možný.
--   * Dáta plní výhradne serverová Edge Function "aktualizuj-akcie" cez
--     service_role kľúč, ktorý RLS obchádza (BYPASSRLS).  Používateľ tak nikdy
--     nemôže modul prepísať ani poškodiť.
--
-- Spustenie: Supabase Dashboard -> SQL Editor (alebo `supabase db push`).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.okolite_akcie (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nazov          TEXT        NOT NULL,
  popis          TEXT,
  obec           TEXT        NOT NULL,
  vzdialenost_km NUMERIC     NOT NULL,
  kategoria      TEXT        NOT NULL
                   CHECK (kategoria IN ('trhy', 'kultura', 'sport', 'hodove', 'gastronomia')),
  datum_cas      TEXT        NOT NULL,
  miesto         TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aditívne indexy:
--   * zoradenie widgetu podľa vzdialenosti od obce,
--   * jednoznačný kľúč pre "upsert" z AI agenta (názov + obec + dátum/čas),
--     aby sa tie isté akcie neukladali opakovane.
CREATE INDEX IF NOT EXISTS okolite_akcie_vzdialenost_idx
  ON public.okolite_akcie (vzdialenost_km ASC);

CREATE UNIQUE INDEX IF NOT EXISTS okolite_akcie_unique_idx
  ON public.okolite_akcie (nazov, obec, datum_cas);

-- Prístupové práva (rovnako ako pri tabuľke public.events).
GRANT SELECT ON public.okolite_akcie TO anon, authenticated;
GRANT ALL    ON public.okolite_akcie TO service_role;

-- Row Level Security — verejné čítanie, žiadny zápis z klienta.
ALTER TABLE public.okolite_akcie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS okolite_akcie_select_public ON public.okolite_akcie;
CREATE POLICY okolite_akcie_select_public ON public.okolite_akcie
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Poznámka: zámerne NEVYTVÁRAME INSERT/UPDATE/DELETE politiku,
-- takže bežný klient nemá oprávnenie na zápis do tejto tabuľky.
