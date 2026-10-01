-- =============================================================================
--  Modul "Správy z regiónu"  —  NOVÁ, IZOLOVANÁ tabuľka public.region_spravy.
--
--  Modul bol premenovaný zo "Ružindolské noviny" a už NEPOUŽÍVA AI agenta.
--  Obsah tvoria výhradne reálne články z RSS feedu Trnavského hlasu
--  (https://www.trnavskyhlas.sk/_rss/rss-trnavsky-hlas.php), ktoré na pozadí
--  sťahuje Edge Function "aktualizuj-region-spravy" (bez AI, bez LLM).
--  Existujúce tabuľky, stĺpce ani politiky iných modulov sa NEMENIA.
--
--  RLS: verejné čítanie pre všetkých; zápis vykonáva výhradne serverová
--  funkcia replace_region_spravy cez service_role kľúč (obchádza RLS).
--  Z aplikácie sa zapisovať nedá – používateľ modul nemôže prepísať.
--
--  Spustenie: Supabase Dashboard -> SQL Editor (alebo `supabase db push`).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.region_spravy (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guid          TEXT        NOT NULL,
  titulok       TEXT        NOT NULL,
  popis         TEXT,
  obrazok_url   TEXT,
  zdroj_url     TEXT        NOT NULL
                  CONSTRAINT region_spravy_source_url_check
                  CHECK (zdroj_url ~ '^https://(www\.)?trnavskyhlas\.sk/'),
  zdroj_nazov   TEXT        NOT NULL DEFAULT 'Trnavský Hlas',
  publikovane_at TIMESTAMPTZ NOT NULL,
  stazena       BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zoradenie pre "najnovšie správy".
CREATE INDEX IF NOT EXISTS region_spravy_publikovane_at_idx
  ON public.region_spravy (publikovane_at DESC);

-- Stabilný kľúč pre idempotentný upsert (rovnaký článok sa neukladá dvakrát).
CREATE UNIQUE INDEX IF NOT EXISTS region_spravy_guid_unique
  ON public.region_spravy (guid);

-- Prístupové práva (rovnako ako pri ostatných verejných tabuľkách).
GRANT SELECT ON public.region_spravy TO anon, authenticated;
GRANT ALL    ON public.region_spravy TO service_role;

-- Row Level Security — verejné čítanie, žiadny zápis z klienta.
ALTER TABLE public.region_spravy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS region_spravy_select_public ON public.region_spravy;
CREATE POLICY region_spravy_select_public ON public.region_spravy
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Poznámka: zámerne NEVYTVÁRAME INSERT/UPDATE/DELETE politiku,
-- takže bežný klient nemá oprávnenie na zápis do tejto tabuľky.

-- -----------------------------------------------------------------------------
--  Atomická výmena obsahu modulu (na jednu transakciu).
--  Stiahnuté články sa vložia/aktualizujú podľa guid, staré (mimo nového
--  zoznamu) sa odstránia. Priblížne nedotknuté "pripnuté" články sa zachovajú,
--  aby sa zoznam nikdy nevyprázdnil, ak je zdroj chvíľovo nedostupný.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_region_spravy(p_rows JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_guids TEXT[];
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT item.guid), '{}')
    INTO v_guids
    FROM jsonb_to_recordset(p_rows) AS item(guid TEXT);

  -- 1) Bezpečná výmena: staré a nepripnuté články mimo nového zoznamu zmiznú.
  IF array_length(v_guids, 1) IS NULL THEN
    DELETE FROM public.region_spravy WHERE stazena = false;
    RETURN;
  END IF;

  DELETE FROM public.region_spravy
   WHERE stazena = false
     AND NOT (guid = ANY (v_guids));

  -- 2) Vloženie / aktualizácia článkov z feedu.
  INSERT INTO public.region_spravy (
    guid, titulok, popis, obrazok_url, zdroj_url, zdroj_nazov, publikovane_at
  )
  SELECT
    item.guid,
    item.titulok,
    item.popis,
    item.obrazok_url,
    item.zdroj_url,
    COALESCE(NULLIF(item.zdroj_nazov, ''), 'Trnavský Hlas'),
    item.publikovane_at
  FROM jsonb_to_recordset(p_rows) AS item(
    guid TEXT,
    titulok TEXT,
    popis TEXT,
    obrazok_url TEXT,
    zdroj_url TEXT,
    zdroj_nazov TEXT,
    publikovane_at TIMESTAMPTZ
  )
  ON CONFLICT (guid) DO UPDATE
    SET titulok       = EXCLUDED.titulok,
        popis         = EXCLUDED.popis,
        obrazok_url   = EXCLUDED.obrazok_url,
        zdroj_url     = EXCLUDED.zdroj_url,
        zdroj_nazov   = EXCLUDED.zdroj_nazov,
        publikovane_at = EXCLUDED.publikovane_at;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_region_spravy(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_region_spravy(JSONB) TO service_role;

-- =============================================================================
--  Čistenie starého AI modulu "Ružindolské noviny".
--  Tabuľka public.tyzdenne_sumare patrila IBA tomuto modulu a po prechode na
--  RSS sa nepoužíva – odstraňujeme ju, aby v databáze nezostali mŕtve dáta.
-- =============================================================================
DROP TABLE IF EXISTS public.tyzdenne_sumare;

COMMIT;