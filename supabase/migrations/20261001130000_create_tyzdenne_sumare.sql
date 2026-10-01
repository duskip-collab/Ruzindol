-- =============================================================================
--  Modul "Ružindolské noviny"  —  NOVÁ, IZOLOVANÁ tabuľka public.tyzdenne_sumare.
--
--  Uchováva týždenné komunitné súhrny generované AI agentom (Edge Function
--  "generuj-tyzdenny-sumar").  Existujúce tabuľky, stĺpce ani politiky sa NEMENIA.
--
--  RLS: verejné čítanie pre všetkých; zápis (insert) vykonáva výhradne Edge
--  Function cez service_role kľúč (obchádza RLS). Z aplikácie sa zapisovať nedá.
--
--  Spustenie: Supabase Dashboard -> SQL Editor (alebo `supabase db push`).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tyzdenne_sumare (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulok    TEXT        NOT NULL,
  obsah      TEXT        NOT NULL,
  obdobie    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zoradenie pre "najnovšie vydanie".
CREATE INDEX IF NOT EXISTS tyzdenne_sumare_created_at_idx
  ON public.tyzdenne_sumare (created_at DESC);

-- Jedno vydanie na týždeň (idempotentný týždenný beh, žiadne duplicity).
CREATE UNIQUE INDEX IF NOT EXISTS tyzdenne_sumare_obdobie_unique
  ON public.tyzdenne_sumare (obdobie)
  WHERE obdobie IS NOT NULL;

-- Prístupové práva (rovnako ako pri ostatných verejných tabuľkách).
GRANT SELECT ON public.tyzdenne_sumare TO anon, authenticated;
GRANT ALL    ON public.tyzdenne_sumare TO service_role;

-- Row Level Security — verejné čítanie, žiadny zápis z klienta.
ALTER TABLE public.tyzdenne_sumare ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tyzdenne_sumare_select_public ON public.tyzdenne_sumare;
CREATE POLICY tyzdenne_sumare_select_public ON public.tyzdenne_sumare
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Poznámka: zámerne NEVYTVÁRAME INSERT/UPDATE/DELETE politiku,
-- takže bežný klient nemá oprávnenie na zápis do tejto tabuľky.
