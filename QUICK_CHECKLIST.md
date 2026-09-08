# 📋 VOĽBY MODUL - FINAL CHECKLIST (ONE-PAGE)

## ✅ ZMENY V KÓDE (HOTOVO)

```
✅ src/screens/ElectionsScreen.tsx
   ├─ Line 41: loadData() filtruje .eq('is_active', true)
   ├─ Line 72: handleEditElections() filtruje .eq('is_active', true) ← NOVÝ FIX
   ├─ Line 255: handleDeleteCandidate() robí soft delete ← ZMENA
   └─ Line 273: handleDeleteAttachment() robí hard delete ✅

✅ Build: SUCCESS (npm run build)
✅ Dev Server: RUNNING (http://localhost:5176)
```

---

## ⏳ DATABÁZOVÉ VYČISTENIE (ČAKÁ)

### KROK 1: Otvoriť Supabase
```
https://supabase.com/dashboard → Projekt LOvable PRO → SQL Editor
```

### KROK 2: Spustiť DIAGNOSTIKU
```sql
SELECT 
  COUNT(*) as total_candidates,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = true) as active,
  (SELECT COUNT(*) FROM election_candidates WHERE is_active = false) as inactive
FROM election_candidates;
```
**Výsledok**: Vidíte koľko je `inactive` (tie sa budú mazať)

### KROK 3: Spustiť DELETE
```sql
DELETE FROM election_candidates WHERE is_active = false;
```
**Výsledok**: "Successfully deleted X rows"

### KROK 4: Verifikácia
```sql
SELECT COUNT(*) as should_be_zero FROM election_candidates WHERE is_active = false;
```
**Výsledok**: **0** = OK ✅

### KROK 5: Refresh aplikácie
```
F5 (Refresh) na http://localhost:5176
```

---

## 🧪 TESTOVANIE

```
✅ Aplikácia: Menu → Voľby
   └─ Vidíte len aktívnych kandidátov?

✅ Edit Modal: Otvoriť edit
   └─ Vidíte len aktívnych kandidátov v gridu?

✅ Delete Test: Mazanie nového kandidáta
   ├─ Kliknúť delete
   ├─ Kandidát zmiznul? ✅
   └─ F5 Refresh: Ostane preč? ✅
```

---

## 📝 SÚBORY

| Súbor | Čo | Kedy |
|-------|---|-----|
| [SQL_CLEANUP_COMMANDS.sql](SQL_CLEANUP_COMMANDS.sql) | Copy-Paste SQL príkazy | **TERAZ** |
| [STEP_BY_STEP_CLEANUP.md](STEP_BY_STEP_CLEANUP.md) | Podrobný návod | **Ak ste v tme** |
| [FINAL_STATUS_REPORT.md](FINAL_STATUS_REPORT.md) | Technický report | **Referencia** |

---

## ⚡ QUICK REFERENCE

**Problem**: Vymazaní kandidáti sa stále zobrazujú  
**Root Cause**: Staré `is_active=false` záznamy v DB  
**Solution**: Soft delete + SQL DELETE query

**Before**: Hard delete (`.delete()`)  
**After**: Soft delete (`.update({ is_active: false })`)

---

## 🎯 FINÁLNE KROKY (V PORADÍ)

- [ ] 1. Spustiť SQL DELETE query v Supabase
- [ ] 2. Refresh aplikácie (F5)
- [ ] 3. Testovať mazanie kandidáta
- [ ] 4. F5 a overiť, že kandidát ostane preč
- [ ] 5. Deploy na production
- [ ] 6. ✅ DONE

**Čas**: ~15 minút  
**Status**: ⏳ Čaká na spustenie SQL  

---

## 📞 HELP

**Kde spustiť SQL?**  
→ https://supabase.com/dashboard → SQL Editor

**Čo keď sa zmýlim?**  
→ Máte BACKUP (spustite BACKUP query z SQL_CLEANUP_COMMANDS.sql)

**Ako vedieť, že funguje?**  
→ DELETE query vraťuje 0 na verifikácií + aplikácia zobrazuje len aktívnych

---

**CREATED**: 2025 | **STATUS**: Ready for Database Cleanup | **TIME**: ~15 min
