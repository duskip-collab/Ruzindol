# 🎯 SUPABASE SQL - FOTOGRAFIE KANDIDÁTOV

## 📋 KROK PO KROKU

### KROK 1: Otvorte Supabase SQL Editor
```
1. Prihláste sa do Supabase Dashboard
2. Vyberte váš projekt (Ruzindol)
3. Menu → SQL Editor
4. Kliknite "New Query"
```

---

## 🔧 SQL MIGRÁCIA - PRIDAŤ PHOTO_URL POLE

**Skopírujte a spustite v SQL Editor:**

```sql
-- ==============================================================================
-- Add Photo URL to Election Candidates
-- Allows candidates to have profile photos stored in Supabase Storage
-- ==============================================================================

BEGIN;

-- Step 1: Add photo_url column to election_candidates table
ALTER TABLE public.election_candidates 
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Step 2: Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_election_candidates_photo_url 
  ON public.election_candidates(photo_url) 
  WHERE photo_url IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN public.election_candidates.photo_url IS 
  'URL to candidate photo stored in Supabase Storage (elections/candidates/ path)';

COMMIT;
```

**Očakávaný výsledok:**
```
✅ ALTER TABLE ... executed successfully
✅ CREATE INDEX ... executed successfully
✅ COMMENT ON COLUMN ... executed successfully
```

---

## ✅ VERIFIKÁCIA - SKONTROLUJTE ČI STĹPEC EXISTUJE

**Spustite túto query:**

```sql
-- Check if photo_url column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'election_candidates'
  AND column_name = 'photo_url';
```

**Očakávaný výsledok:**
```
column_name    | data_type | is_nullable
---------------+-----------+------------
photo_url      | text      | YES
```

**Ak je prázdny výsledok:**
- ❌ Stĺpec neexistuje
- ✅ Spustite SQL migráciu vyššie

---

## 🗂️ SKONTROLUJTE VŠETKÝCH KANDIDÁTOV

**Zobrazte všetkých kandidátov s fotkami:**

```sql
SELECT 
  id,
  full_name,
  position_type,
  party_or_independent,
  photo_url,
  is_active,
  created_at
FROM public.election_candidates
ORDER BY created_at DESC;
```

**Čo budete vidieť:**
- `id` - ID kandidáta
- `full_name` - Meno kandidáta
- `position_type` - 'starosta' alebo 'poslanec'
- `photo_url` - URL fotky (NULL ak nemá)
- `is_active` - TRUE = aktívny, FALSE = vymazaný
- `created_at` - Kedy bol vytvorený

---

## 📸 SKONTROLUJTE FOTKY

**Kandidáti S FOTKOU:**

```sql
SELECT 
  full_name,
  photo_url,
  position_type
FROM public.election_candidates
WHERE photo_url IS NOT NULL
  AND is_active = true
ORDER BY full_name;
```

**Kandidáti BEZ FOTKY:**

```sql
SELECT 
  full_name,
  position_type
FROM public.election_candidates
WHERE photo_url IS NULL
  AND is_active = true
ORDER BY full_name;
```

---

## 🗑️ ČIŠTENIE (Ak je potrebné)

### Odstránenie fotiek (soft delete - iba v DB)

```sql
-- Set photo_url to NULL (remove photo but keep candidate)
UPDATE public.election_candidates
SET photo_url = NULL
WHERE id = 'CANDIDATE_ID_HERE';
```

### Vymazanie kandidáta (hard delete)

```sql
-- Delete candidate permanently
DELETE FROM public.election_candidates
WHERE id = 'CANDIDATE_ID_HERE';
```

---

## 🔍 DIAGNOSTIKA

### Koľko kandidátov má fotku?

```sql
SELECT 
  COUNT(*) as total_candidates,
  COUNT(photo_url) as with_photos,
  COUNT(CASE WHEN photo_url IS NULL THEN 1 END) as without_photos
FROM public.election_candidates
WHERE is_active = true;
```

### Zoznam volieb s počtom kandidátov

```sql
SELECT 
  e.id,
  e.name,
  (SELECT COUNT(*) FROM election_candidates WHERE election_id = e.id AND is_active = true) as active_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE election_id = e.id AND is_active = true AND photo_url IS NOT NULL) as candidates_with_photos
FROM public.elections e
ORDER BY e.created_at DESC;
```

---

## 📊 ŠTATISTIKY

### Veľkosť fotiek

```sql
SELECT 
  COUNT(*) as total_photos,
  pg_size_pretty(SUM(octet_length(photo_url))) as total_url_size
FROM public.election_candidates
WHERE photo_url IS NOT NULL;
```

**Poznámka**: Toto je veľkosť samotných URL stringov, nie veľkosť súborov v Storage.

---

## ⚙️ RLS POLITIKY (Ak potrebujete upraviť)

### Čítanie fotiek (verejné)

Fotky sú uložené v **Supabase Storage** v buckete `elections`, nie v database.

**RLS pre storage bucket:**

```sql
-- Check existing policies (informačne, v Storage table):
SELECT policy_name, definition
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage';
```

---

## 🚀 POST-MIGRATION STEPS

### 1. Aktualizujte aplikáciu

```bash
npm run build  # (Already done)
# Deploy dist/ folder
```

### 2. Testujte upload

- Login ako Admin
- Edit Voľby
- Upload fotky kandidátov
- Skontrolujte či sa zobrazujú

### 3. Verify v Supabase Storage

```
Supabase Dashboard → Storage → elections bucket
Vidíte candidates/ folder s obrázkami?
```

---

## 📝 LOGGING

**Ak chcete vidieť všetky zmeny v photography:**

```sql
-- Create audit log table (optional)
CREATE TABLE IF NOT EXISTS election_candidates_audit (
  id BIGSERIAL PRIMARY KEY,
  candidate_id UUID NOT NULL,
  old_photo_url TEXT,
  new_photo_url TEXT,
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by UUID
);

-- Create trigger (optional)
CREATE OR REPLACE FUNCTION log_photo_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.photo_url IS DISTINCT FROM NEW.photo_url THEN
    INSERT INTO election_candidates_audit (
      candidate_id, old_photo_url, new_photo_url, changed_by
    ) VALUES (NEW.id, OLD.photo_url, NEW.photo_url, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_photo_changes
AFTER UPDATE ON public.election_candidates
FOR EACH ROW
EXECUTE FUNCTION log_photo_changes();
```

---

## ✅ COMPLETION CHECKLIST

```
[ ] SQL Migration spustená
[ ] photo_url column existuje
[ ] Index vytvorený
[ ] Comment pridaný
[ ] Build deployed
[ ] Admin vidí upload field
[ ] Fotka sa nahrá do Storage
[ ] Fotka sa zobrazí v gride
[ ] Fotka sa zobrazí v detaile
[ ] Remove fotka funguje
[ ] Delete kandidáta funguje
[ ] Sused vidí fotky
[ ] Dark mode OK
[ ] Production ready
```

---

## 📞 TROUBLESHOOTING

### Problem 1: "Column photo_url does not exist"
```
→ Spustite SQL migráciu vyššie
→ Skontrolujte či je spustená bez chýb
```

### Problem 2: Fotka sa nenahrá
```
→ Skontrolujte Supabase Storage bucket 'elections'
→ Skontrolujte RLS politiky
→ Skontrolujte DevTools → Network → Console na chyby
```

### Problem 3: Fotka sa nezobrazuje
```
→ Skontrolujte či je photo_url v database (NULL alebo URL?)
→ Skúť hard refresh: Ctrl+Shift+R
→ Skontrolujte URL v browser
```

### Problem 4: Upload máx 5MB
```
→ To je presne tak - máx veľkosť je 5MB
→ Skúte menší obrázok
```

---

## 🎊 SUMMARY

**Co urobiť:**
1. Kopírujte SQL migráciu vyššie
2. Prihláste sa do Supabase
3. Otvorte SQL Editor
4. Spustite query
5. Skontrolujte bez chýb ✅
6. Verifikujte query (check column)
7. Deploy aplikácia
8. Testujte upload fotiek
9. Done! 🎉

---

**Status**: Ready for Supabase SQL Migration  
**Time**: ~5 minutes  
**Difficulty**: Easy (copy-paste SQL)

**👉 BEGIN: Copy SQL from KROK 1 section above!**
