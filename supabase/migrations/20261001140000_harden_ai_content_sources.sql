ALTER TABLE public.okolite_akcie
  ADD COLUMN IF NOT EXISTS konanie_dna DATE,
  ADD COLUMN IF NOT EXISTS zdroj_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'okolite_akcie_vzdialenost_range_check'
      AND conrelid = 'public.okolite_akcie'::regclass
  ) THEN
    ALTER TABLE public.okolite_akcie
      ADD CONSTRAINT okolite_akcie_vzdialenost_range_check
      CHECK (vzdialenost_km BETWEEN 0 AND 30);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'okolite_akcie_source_url_check'
      AND conrelid = 'public.okolite_akcie'::regclass
  ) THEN
    ALTER TABLE public.okolite_akcie
      ADD CONSTRAINT okolite_akcie_source_url_check
      CHECK (zdroj_url IS NULL OR zdroj_url ~ '^https?://');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.replace_okolite_akcie(p_rows JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  DELETE FROM public.okolite_akcie;

  INSERT INTO public.okolite_akcie (
    nazov,
    popis,
    obec,
    vzdialenost_km,
    kategoria,
    datum_cas,
    konanie_dna,
    miesto,
    zdroj_url
  )
  SELECT
    item.nazov,
    item.popis,
    item.obec,
    item.vzdialenost_km,
    item.kategoria,
    item.datum_cas,
    item.konanie_dna,
    item.miesto,
    item.zdroj_url
  FROM jsonb_to_recordset(p_rows) AS item(
    nazov TEXT,
    popis TEXT,
    obec TEXT,
    vzdialenost_km NUMERIC,
    kategoria TEXT,
    datum_cas TEXT,
    konanie_dna DATE,
    miesto TEXT,
    zdroj_url TEXT
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_okolite_akcie(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_okolite_akcie(JSONB) TO service_role;
