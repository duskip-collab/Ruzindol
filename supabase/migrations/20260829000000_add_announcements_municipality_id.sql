ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES public.municipalities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS announcements_municipality_id_idx
  ON public.announcements (municipality_id);