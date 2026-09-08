-- ==============================================================================
-- Add Photo URL to Election Candidates
-- Allows candidates to have profile photos stored in Supabase Storage
-- ==============================================================================

BEGIN;

-- Add photo_url column to election_candidates table
ALTER TABLE public.election_candidates 
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_election_candidates_photo_url 
  ON public.election_candidates(photo_url) 
  WHERE photo_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.election_candidates.photo_url IS 
  'URL to candidate photo stored in Supabase Storage (elections/candidates/ path)';

COMMIT;
