-- ============================================================================
-- SUPABASE SQL EDITOR - COPY & PASTE PRÍKAZY NA VYČISTENIE
-- ============================================================================
-- Navštívte: https://supabase.com/dashboard → SQL Editor
-- Kopírujte tieto príkazy jeden po jednom a spustite (RUN alebo Ctrl+Enter)

-- ============================================================================
-- 1️⃣ DIAGNOSTIKA - PRED MAZANÍM
-- ============================================================================
-- Spustite TENTO PRÍKAZ PRVÝ, aby viete koľko neaktívnych kandidátov je v DB

SELECT 
  COUNT(*) as total_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = true) as active_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = false) as inactive_candidates_TO_DELETE
FROM election_candidates;

-- OČAKÁVANÝ VÝSTUP:
-- total_candidates    | active_candidates | inactive_candidates_TO_DELETE
-- 10                  | 7                 | 3
-- (Čísla sa líšia podľa vašej databázy)
-- Ak inactive_candidates_TO_DELETE > 0, pokračujte na STEP 3

-- ============================================================================
-- 2️⃣ VOLITEĽNÉ - BACKUP (AK CHCETE ZÁLOHU)
-- ============================================================================
-- Ak chcete mať historický záznam, spustite tieto príkazy:

-- Vytvor backup tabuľku
CREATE TABLE IF NOT EXISTS election_candidates_deleted_log (
    id UUID PRIMARY KEY,
    full_name TEXT,
    position_type TEXT,
    election_id UUID,
    deleted_at TIMESTAMPTZ DEFAULT now()
);

-- Skopíruj všetkých neaktívnych do backupu
INSERT INTO election_candidates_deleted_log (id, full_name, position_type, election_id)
SELECT id, full_name, position_type, election_id
FROM election_candidates
WHERE is_active = false;

-- Skontroluj koľko bolo skopírovaných
SELECT COUNT(*) as backed_up_records
FROM election_candidates_deleted_log;

-- ============================================================================
-- 3️⃣ VYMAZANIE NEAKTÍVNYCH KANDIDÁTOV (HLAVNÝ KROK)
-- ============================================================================
-- POZOR: Tento príkaz je PERMANENTNÝ (alebo máte BACKUP vyššie)

DELETE FROM election_candidates
WHERE is_active = false;

-- VÝSTUP: "Successfully deleted N rows"

-- ============================================================================
-- 4️⃣ VERIFIKÁCIA - KONTROLA ČE VYMAZANIE FUNGUVALO
-- ============================================================================
-- Spustite TENTO PRÍKAZ, aby viete či je všetko OK

SELECT COUNT(*) as remaining_inactive_candidates
FROM election_candidates
WHERE is_active = false;

-- OČAKÁVANÝ VÝSTUP:
-- remaining_inactive_candidates
-- 0
-- ✅ Ak je 0, vyčistenie funguje!

-- ============================================================================
-- 5️⃣ FINÁLNY PREHĽAD STAVU
-- ============================================================================
-- Skontroluj stav databázy po vyčistení

SELECT 
  'ELECTIONS_CANDIDATES' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_only,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_count
FROM election_candidates;

-- OČAKÁVANÝ VÝSTUP:
-- table_name              | total_records | active_only | inactive_count
-- ELECTIONS_CANDIDATES    | 7             | 7           | 0
-- ✅ Ak inactive_count = 0, všetko je OK

-- ============================================================================
-- 6️⃣ BONUS - ZOZNAM VŠETKÝCH ZOSTÁVAJÚCICH KANDIDÁTOV
-- ============================================================================
-- Voliteľný výpis - vidíte všetkých aktívnych kandidátov

SELECT 
  id,
  full_name,
  position_type,
  election_id,
  is_active,
  created_at
FROM election_candidates
WHERE is_active = true
ORDER BY election_id, created_at DESC;

-- ============================================================================
-- ZHRNUTIE KROKOV
-- ============================================================================
-- 1. Spustite Step 1️⃣ (Diagnostika) - vidíte koľko je neaktívnych
-- 2. (VOLITEĽNÉ) Spustite Step 2️⃣ (Backup) - vytvorí zalohu
-- 3. Spustite Step 3️⃣ (DELETE) - vymaže všetkých neaktívnych
-- 4. Spustite Step 4️⃣ (Verifikácia) - vidíte že inactive = 0
-- 5. Spustite Step 5️⃣ (Prehľad) - vidíte finálny stav
-- 6. (VOLITEĽNÉ) Spustite Step 6️⃣ (Zoznam) - vidíte všetkých zvyšajúcich sa

-- ============================================================================
-- PO SPUSTENÍ - TESTOVANIE V APLIKÁCII
-- ============================================================================
-- 1. Otvoriť aplikáciu: http://localhost:5176
-- 2. Refresh: F5
-- 3. Prejsť na: Menu → Voľby
-- 4. ✅ Vidíte len aktívnych kandidátov
-- 5. Test mazania: Edit → Pridať kandidáta → Vymazať
-- 6. F5 (Refresh)
-- 7. ✅ Vymazaný kandidát ostane preč

-- ============================================================================
-- CHYBOVANIE? VŠETKO JE OK
-- ============================================================================
-- Ak ste spustili BACKUP (Step 2), možete obnovi:
--
-- INSERT INTO election_candidates (id, full_name, position_type, election_id, is_active)
-- SELECT id, full_name, position_type, election_id, false 
-- FROM election_candidates_deleted_log;
--
-- ALEBO skontaktujte sa na support
