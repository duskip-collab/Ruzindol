-- 1. Zabezpečenie potrebných stĺpcov v tabuľke announcements
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS published_at timestamptz DEFAULT now();

-- 2. Odstránenie neplatných/starých RSS záznamov pre čistý stav
DELETE FROM public.announcements WHERE source = 'rss';

-- 3. Pridanie UNIQUE constraintu pre správne fungovanie upsertu
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'announcements_source_external_id_key'
    ) THEN
        ALTER TABLE public.announcements
        ADD CONSTRAINT announcements_source_external_id_key UNIQUE (source, external_id);
    END IF;
END $$;

-- 4. Index pre rýchle zoradenie na fronte
CREATE INDEX IF NOT EXISTS idx_announcements_rss_published
ON public.announcements (source, published_at DESC)
WHERE source = 'rss';
