-- =============================================================================
--  Modul "Správy z regiónu" — ÚPLNÉ ZRUŠENIE.
--
--  Odstraňuje tabuľku, RPC funkciu, politiky a indexy modulu. Skript je
--  idempotentný (IF EXISTS), takže je bezpečný aj vtedy, ak modul nikdy
--  nebol nasadený.
-- =============================================================================
BEGIN;

DROP FUNCTION IF EXISTS public.replace_region_spravy(JSONB);

DROP TABLE IF EXISTS public.region_spravy CASCADE;

COMMIT;