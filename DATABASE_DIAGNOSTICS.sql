-- ============================================================================
-- DIAGNOSTIKA DATABÁZY - VOĽBY A KANDIDÁTI
-- ============================================================================
-- Spustiť v Supabase SQL Editor

-- 1. VŠEOBECNÉ ŠTATISTIKY
SELECT 
  'TABUĽKA: elections' AS info,
  COUNT(*) as total_records
FROM elections;

SELECT 
  'TABUĽKA: election_candidates' AS info,
  COUNT(*) as total_records,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = true) as active,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = false) as inactive
FROM election_candidates;

-- 2. VŠETCI KANDIDÁTI (aktívni a neaktívni)
SELECT 
  id,
  full_name,
  position_type,
  election_id,
  is_active,
  created_at
FROM election_candidates
ORDER BY election_id, created_at DESC;

-- 3. PODĽA VOLIEB
SELECT 
  e.id,
  e.name,
  (SELECT COUNT(*) FROM election_candidates WHERE election_id = e.id AND is_active = true) as active_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE election_id = e.id AND is_active = false) as inactive_candidates,
  (SELECT COUNT(*) FROM elections_attachments WHERE election_id = e.id) as attachments
FROM elections e
ORDER BY e.created_at DESC;

-- 4. NEAKTÍVNI KANDIDÁTI (KANDIDÁTI NA VYMAZANIE)
SELECT 
  c.id,
  c.full_name,
  c.position_type,
  c.election_id,
  e.name as election_name,
  c.created_at
FROM election_candidates c
LEFT JOIN elections e ON c.election_id = e.id
WHERE c.is_active = false
ORDER BY c.created_at DESC;

-- 5. PRÍLOHY PO VOĽBÁCH
SELECT 
  ea.id,
  ea.election_id,
  e.name as election_name,
  ea.file_name,
  ea.file_type,
  ea.created_at
FROM elections_attachments ea
LEFT JOIN elections e ON ea.election_id = e.id
ORDER BY e.name, ea.created_at DESC;

-- 6. MAPU TESTOV
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM elections) > 0 THEN '✅ ELECTIONS tabuľka má dáta'
    ELSE '⚠️ ELECTIONS tabuľka je prázdna'
  END as elections_status,
  CASE 
    WHEN (SELECT COUNT(*) FROM election_candidates WHERE is_active = true) > 0 THEN '✅ Sú AKTÍVNI kandidáti'
    ELSE '⚠️ Žiadni aktívni kandidáti'
  END as active_candidates_status,
  CASE 
    WHEN (SELECT COUNT(*) FROM election_candidates WHERE is_active = false) > 0 THEN '⚠️ Sú NEAKTÍVNI kandidáti (treba vymazať)'
    ELSE '✅ Žiadni neaktívni kandidáti'
  END as cleanup_status;
