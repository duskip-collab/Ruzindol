-- ============================================================================
-- MIGRÁCIA PRE ROZŠÍRENIE VOLIEB: MODULY NA SPRÁVU VOLIEB A PRÍLOHA
-- ============================================================================
-- Vytvorenie tabuliek pre správu volieb a dokumentov

-- 1. TABUĽKA ELECTIONS (Vlastné voľby s metaúdajmi)
CREATE TABLE IF NOT EXISTS public.elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    election_date TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'active', 'closed')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read elections" ON public.elections;
CREATE POLICY "Allow authenticated read elections"
    ON public.elections FOR SELECT
    TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Allow admin/official write elections" ON public.elections;
CREATE POLICY "Allow admin/official write elections"
    ON public.elections FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_official = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_official = true)
        )
    );

-- 2. TABUĽKA ELECTIONS_ATTACHMENTS (Súbory k voľbám - PDF, fotky)
CREATE TABLE IF NOT EXISTS public.elections_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image')),
    file_url TEXT NOT NULL,
    file_size_bytes INTEGER,
    description TEXT,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.elections_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read elections_attachments" ON public.elections_attachments;
CREATE POLICY "Allow authenticated read elections_attachments"
    ON public.elections_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.elections
            WHERE id = election_id AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Allow admin/official write elections_attachments" ON public.elections_attachments;
CREATE POLICY "Allow admin/official write elections_attachments"
    ON public.elections_attachments FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_official = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_official = true)
        )
    );

-- 3. ROZŠÍRENIE ELECTION_CANDIDATES O ELECTIONS_ID
ALTER TABLE public.election_candidates ADD COLUMN IF NOT EXISTS election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE;
ALTER TABLE public.election_candidates ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL;

-- 4. INDEKSY PRE VÝKON
CREATE INDEX IF NOT EXISTS idx_election_candidates_election_id ON public.election_candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_elections_attachments_election_id ON public.elections_attachments(election_id);
CREATE INDEX IF NOT EXISTS idx_elections_status ON public.elections(status);
