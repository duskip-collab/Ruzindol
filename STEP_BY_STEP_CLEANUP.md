# 🚀 KROK-ZA-KROKOM NÁVOD NA VYČISTENIE DATABÁZY

## 📌 SITUÁCIA

Máte v databáze:
- ✅ Aktívne voľby a kandidátov
- ❌ Staré záznamy kandidátov s `is_active=false` (ktoré sa majú ignorovať)

## 🎯 CIEĽ

Vyčistiť databázu tak, aby:
1. Zostali len aktívni kandidáti
2. Staré neaktívne záznamy sú vymazané
3. Aplikácia zobrazuje len správne dáta

---

## ⚙️ KROKY K IMPLEMENTÁCII

### 1️⃣ DIAGNOSTIKA - Overite, čo je v databáze

**Kde**: Supabase Dashboard → SQL Editor

1. Otvoriť: https://supabase.com/dashboard
2. Vybrať projekt: **LOvable PRO**
3. Kliknúť: **SQL Editor** (ľavý panel)
4. Kliknúť: **Nový Query** (+ New Query)
5. Kopírovať tento SQL:

```sql
-- DIAGNOSTIKA: Koľko je aktívnych a neaktívnych kandidátov?
SELECT 
  COUNT(*) as total_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = true) as active_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = false) as inactive_candidates
FROM election_candidates;
```

6. Kliknúť: **RUN** (alebo Ctrl+Enter)
7. ✅ Vidíte výsledky:
   - `total_candidates`: Celkový počet
   - `active_candidates`: Ostaní (CHCEME TIETO)
   - `inactive_candidates`: Budú vymazaní (CHCEME VYMAZAŤ TIETO)

---

### 2️⃣ PREDTÝM AKO VYMAŽETE - BACKUP (VOLITEĽNÉ)

Ak chcete mať zálohu starých záznamov:

```sql
-- BACKUP: Vytvor tabuľku s históriou vymazaných kandidátov
CREATE TABLE IF NOT EXISTS election_candidates_deleted_log (
    id UUID PRIMARY KEY,
    full_name TEXT,
    position_type TEXT,
    election_id UUID,
    deleted_at TIMESTAMPTZ DEFAULT now()
);

-- BACKUP: Skopíruj všetkých neaktívnych kandidátov do log tabuľky
INSERT INTO election_candidates_deleted_log (id, full_name, position_type, election_id)
SELECT id, full_name, position_type, election_id
FROM election_candidates
WHERE is_active = false;

-- OVERENIE: Koľko bolo skopírovaných?
SELECT COUNT(*) as backed_up_records
FROM election_candidates_deleted_log;
```

**Výsledok**: 
- ✅ Vytvorí sa tabuľka `election_candidates_deleted_log` 
- ✅ Staré záznamy sú skopírované do log tabuľky
- ✅ Máte zálohu pred mazaním

---

### 3️⃣ VYMAZANIE NEAKTÍVNYCH KANDIDÁTOV

```sql
-- DELETE: Vymaž všetkých neaktívnych kandidátov
DELETE FROM election_candidates
WHERE is_active = false;

-- VERIFIKÁCIA: Skontroluj, že ostal len 0 neaktívnych kandidátov
SELECT COUNT(*) as remaining_inactive_candidates
FROM election_candidates
WHERE is_active = false;
```

**Výsledok**: 
- ✅ Všetci neaktívni kandidáti sú vymazaní
- ✅ `remaining_inactive_candidates` by mal byť **0**

---

### 4️⃣ FINÁLNA VERIFIKÁCIA

```sql
-- Skontroluj stav databázy
SELECT 
  'election_candidates' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_records,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_records
FROM election_candidates;

-- Výpis všetkých zvyšajúcich sa kandidátov
SELECT id, full_name, position_type, election_id, is_active, created_at
FROM election_candidates
ORDER BY created_at DESC;
```

**Výsledok**:
- `total_records`: Počet zvyšajúcich sa kandidátov (bez neaktívnych)
- `active_records`: Všetci by mali byť aktívni (= total_records)
- `inactive_records`: **0** (bez výnimok!)

---

## 🔍 PODROBNÝ PRÍKLAD

### Situácia pred vymažaním:
```
TABUĽKA: election_candidates
┌──────────┬───────────────┬─────────┬──────────┐
│ id       │ full_name     │ is_active │ note   │
├──────────┼───────────────┼─────────┼──────────┤
│ id1      │ Peter Nováč   │ true    │ ✅      │
│ id2      │ Jana Tichá    │ true    │ ✅      │
│ id3      │ Ján Kováčik   │ false   │ ❌ vymazať│
│ id4      │ Mária Dlhá    │ false   │ ❌ vymazať│
│ id5      │ Anton Krátky  │ true    │ ✅      │
└──────────┴───────────────┴─────────┴──────────┘

ŠTATISTIKA:
- total_candidates: 5
- active_candidates: 3  ← ZOSTANÚ
- inactive_candidates: 2 ← BUDÚ VYMAZANÉ
```

### Situácia po vymažaní:
```
TABUĽKA: election_candidates
┌──────────┬───────────────┬─────────┐
│ id       │ full_name     │ is_active │
├──────────┼───────────────┼─────────┤
│ id1      │ Peter Nováč   │ true    │
│ id2      │ Jana Tichá    │ true    │
│ id5      │ Anton Krátky  │ true    │
└──────────┴───────────────┴─────────┘

ŠTATISTIKA:
- total_candidates: 3
- active_candidates: 3  ✅
- inactive_candidates: 0 ✅
```

---

## 🧪 TESTOVANIE V APLIKÁCII

### Po vyčistení databázy:

1. **Otvoriť aplikáciu**
   - URL: http://localhost:5176
   - Refresh (F5)

2. **Prejsť na Voľby**
   - Kliknúť: Menu → Voľby

3. **Vidíte len aktívnych kandidátov?**
   - ✅ ANO → Veta sa vymazala ✅
   - ❌ NIE → Problém s filtrom alebo s kódom

4. **Testovať mazanie nového kandidáta**
   - Kliknúť: Edit na voľby
   - Pridať kandidáta: "Test Kandidát"
   - Kliknúť: Delete
   - ✅ Kandidát zmiznul z UI

5. **Refresh a overenie**
   - F5 (Refresh stránku)
   - ✅ Test Kandidát je stále preč

---

## 📊 SQL PRÍKAZY NA KOPÍROVANIE

### Balík 1: DIAGNOSTIKA
```sql
SELECT 
  COUNT(*) as total_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = true) as active_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = false) as inactive_candidates
FROM election_candidates;
```

### Balík 2: BACKUP (VOLITEĽNÉ)
```sql
CREATE TABLE IF NOT EXISTS election_candidates_deleted_log (
    id UUID PRIMARY KEY,
    full_name TEXT,
    position_type TEXT,
    election_id UUID,
    deleted_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO election_candidates_deleted_log (id, full_name, position_type, election_id)
SELECT id, full_name, position_type, election_id
FROM election_candidates
WHERE is_active = false;

SELECT COUNT(*) as backed_up_records FROM election_candidates_deleted_log;
```

### Balík 3: VYMAZANIE + VERIFIKÁCIA
```sql
DELETE FROM election_candidates WHERE is_active = false;

SELECT COUNT(*) as remaining_inactive_candidates
FROM election_candidates
WHERE is_active = false;
```

### Balík 4: FINÁLNY PREHĽAD
```sql
SELECT 
  COUNT(*) as total_candidates,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_candidates,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_candidates
FROM election_candidates;
```

---

## ✅ CHECKLIST

- [ ] Otvorení Supabase Dashboard
- [ ] Otvorení SQL Editor
- [ ] Spustení DIAGNOSTIKY (koľko neaktívnych)
- [ ] Spustení BACKUP (ak chcete zálohu)
- [ ] Spustení VYMAZANIA neaktívnych kandidátov
- [ ] Spustení VERIFIKÁCIE (remaining_inactive = 0)
- [ ] Refresh aplikácie (F5)
- [ ] Vidíte len aktívnych kandidátov v UI ✅
- [ ] Testovací mazanie kandidáta
- [ ] Refresh a overenie, že ostane vymazaný ✅

---

## ❓ OTÁZKY A ODPOVEDE

### Q: Kde je SQL Editor v Supabase?
**A**: Supabase Dashboard → ľavý panel → SQL Editor (alebo https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql)

### Q: Čo ak spravím chybu?
**A**: Máte BACKUP v `election_candidates_deleted_log` tabuľke. Môžete obnovi:
```sql
INSERT INTO election_candidates (id, full_name, position_type, election_id, is_active)
SELECT id, full_name, position_type, election_id, false FROM election_candidates_deleted_log;
```

### Q: Ako viem, že vymazanie funguje?
**A**: Spustite query:
```sql
SELECT COUNT(*) as should_be_zero FROM election_candidates WHERE is_active = false;
```
Ak výsledok je **0**, je to OK ✅

### Q: Čo sa stane s priloženými súbormi (PDF, fotky)?
**A**: Budú ostávať v Storage. Ich mazanie je iný proces:
```sql
DELETE FROM elections_attachments WHERE election_id NOT IN (SELECT id FROM elections);
```

---

## 🎯 ZHRNUTIE

| Krok | Čo | Príkaz |
|------|---|--------|
| 1 | Diagnostika | `SELECT COUNT(*)... WHERE is_active...` |
| 2 | Backup | `CREATE TABLE... INSERT INTO... SELECT...` |
| 3 | Vymazanie | `DELETE FROM election_candidates WHERE is_active = false` |
| 4 | Verifikácia | `SELECT COUNT(*) WHERE is_active = false` |
| 5 | Testovanie | Aplikácia → Voľby → ✅ len aktívni |

---

**Status**: ⏳ Čaká na spustenie SQL skriptov v Supabase
**Čas**: ~5 minút
**Náročnosť**: ⭐ Jednoduchá (Ctrl+C, Ctrl+V, Run)
