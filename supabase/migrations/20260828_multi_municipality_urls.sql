ALTER TABLE public.municipalities
  ADD COLUMN IF NOT EXISTS rss_url TEXT,
  ADD COLUMN IF NOT EXISTS calendar_url TEXT;

UPDATE public.municipalities
SET
  rss_url = 'https://www.ruzindol.sk/?rss=200',
  calendar_url = 'https://www.ruzindol.sk/obcan/kalendar-podujati/'
WHERE slug = 'ruzindol';
