-- ============================================================================
-- MIGRÁCIA: VYČISTENIE STARÝCH NEAKTÍVNYCH KANDIDÁTOV
-- ============================================================================
-- Táto migrácia vymaže všetkých kandidátov kde is_active = false
-- Vytvorí sa "audit trail" pred mazaním (voliteľné)

-- 1. BACKUP: Vytvor tabuľku s históriou vymazaných kandidátov (VOLITEĽNÉ)
CREATE TABLE IF NOT EXISTS election_candidates_deleted_log (
    id UUID PRIMARY KEY,
    full_name TEXT,
    position_type TEXT,
    election_id UUID,
    deleted_at TIMESTAMPTZ DEFAULT now(),
    deleted_by UUID
);

-- 2. BACKUP: Skopíruj všetkých neaktívnych kandidátov do log tabuľky
INSERT INTO election_candidates_deleted_log (id, full_name, position_type, election_id)
SELECT id, full_name, position_type, election_id
FROM election_candidates
WHERE is_active = false;

-- 3. DELETE: Vymaž všetkých neaktívnych kandidátov
DELETE FROM election_candidates
WHERE is_active = false;

-- 4. VERIFIKÁCIA: Skontroluj, že ostal len aktívni kandidáti
-- Výsledok by mal byť 0
SELECT COUNT(*) as inactive_remaining
FROM election_candidates
WHERE is_active = false;

-- 5. VERIFIKÁCIA: Vypiš všetkých zostávajúcich kandidátov
SELECT id, full_name, position_type, election_id, is_active
FROM election_candidates
ORDER BY created_at DESC;
