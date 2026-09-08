-- ============================================================================
-- SQL SKRIPT: VYČISTENIE STARÝCH NEAKTÍVNYCH KANDIDÁTOV
-- ============================================================================

-- 1. Najprv si pozri koľko je starých/neaktívnych kandidátov
SELECT COUNT(*) as total_all,
       SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive
FROM election_candidates;

-- 2. Pozri si konkrétne neaktívnych kandidátov
SELECT id, full_name, position_type, is_active, election_id, created_at 
FROM election_candidates 
WHERE is_active = false
ORDER BY created_at DESC;

-- 3. Vymaž všetky neaktívnych kandidátov
DELETE FROM election_candidates 
WHERE is_active = false;

-- 4. Verifikácia - teraz by mali byť len aktívni
SELECT COUNT(*) as remaining_candidates 
FROM election_candidates 
WHERE is_active = true;

-- 5. Taktiež vyčisti neaktívne prílohy (ak existujú)
DELETE FROM elections_attachments 
WHERE created_at < now() - interval '1 day' 
  AND file_url IS NULL;
