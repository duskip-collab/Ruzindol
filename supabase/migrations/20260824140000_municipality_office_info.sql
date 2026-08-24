-- Create municipality_office_info table for office hours and contacts
CREATE TABLE IF NOT EXISTS public.municipality_office_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID REFERENCES public.municipalities(id) ON DELETE CASCADE UNIQUE,
  office_hours TEXT NOT NULL DEFAULT E'Pondelok: 8:00 - 12:00 | 12:30 - 15:30\nUtorok: nestránkový deň\nStreda: 8:00 - 12:00 | 12:30 - 17:00\nŠtvrtok: nestránkový deň\nPiatok: 8:00 - 13:00',
  address TEXT NOT NULL DEFAULT 'Obecný úrad Ružindol, 919 61 Ružindol',
  phone TEXT NOT NULL DEFAULT '033 / 5511 223',
  email TEXT NOT NULL DEFAULT 'ou@ruzindol.sk',
  mayor TEXT NOT NULL DEFAULT 'PhDr. Starosta obce',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE ON public.municipality_office_info TO authenticated, anon;
GRANT ALL ON public.municipality_office_info TO service_role;

ALTER TABLE public.municipality_office_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read municipality_office_info" ON public.municipality_office_info;
CREATE POLICY "anyone read municipality_office_info" ON public.municipality_office_info
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "officials manage municipality_office_info" ON public.municipality_office_info;
CREATE POLICY "officials manage municipality_office_info" ON public.municipality_office_info
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Starosta', 'Uradnik')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Starosta', 'Uradnik')
    )
  );

-- Seed default Ružindol info if municipalities exists
INSERT INTO public.municipality_office_info (municipality_id, office_hours, address, phone, email, mayor)
SELECT id, 
  E'Pondelok: 8:00 - 12:00 | 12:30 - 15:30\nUtorok: nestránkový deň\nStreda: 8:00 - 12:00 | 12:30 - 17:00\nŠtvrtok: nestránkový deň\nPiatok: 8:00 - 13:00',
  'Obecný úrad Ružindol, 919 61 Ružindol',
  '033 / 5511 223',
  'ou@ruzindol.sk',
  'PhDr. Starosta obce'
FROM public.municipalities
WHERE slug = 'ruzindol'
ON CONFLICT (municipality_id) DO NOTHING;
