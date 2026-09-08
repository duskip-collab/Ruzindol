# 🧹 DATABÁZOVÉ VYČISTENIE - STARÍ NEAKTÍVNI KANDIDÁTI

## 📋 PROBLÉM

Vymazaní kandidáti ostali v tabuľke s `is_active=false`, čo spôsobovalo, že sa stále zobrazovali v UI, ak sa niekto query vykonával bez filtrenia.

## ✅ RIEŠENIE

### 1. **Kódové Zmeny** (HOTOVO)
- `handleEditElections()`: Pridaný `.eq('is_active', true)` filter
- `handleDeleteCandidate()`: Zmena z `.delete()` na `.update({ is_active: false })` (soft delete)
- `loadData()`: Už mal filter `is_active=true` ✅

### 2. **Databázové Čistenie** (POTREBNÉ MANUÁLNE)

Spusti tento SQL skript v **Supabase Dashboard** → **SQL Editor**:

```sql
-- 1. Skontroluj koľko je neaktívnych kandidátov
SELECT COUNT(*) as inactive_count
FROM election_candidates
WHERE is_active = false;

-- 2. Vymaž všetkých neaktívnych kandidátov
DELETE FROM election_candidates
WHERE is_active = false;

-- 3. Verifikácia - teraz by mali byť len aktívni
SELECT COUNT(*) as active_count
FROM election_candidates
WHERE is_active = true;
```

## 🔄 WORKFLOW PO OPRAVE

### Pred:
```
1. Admin maže kandidáta
2. `delete()` odstraní úplne z DB ❌
3. Staré `is_active=false` ostanú
4. Ak query nemá filter → Starý kandidát sa objaví
```

### Po:
```
1. Admin maže kandidáta
2. `update({ is_active: false })` len deaktivuje ✅
3. `loadData()` filtruje `.eq('is_active', true)` ✅
4. Kandidát sa nikdy nezobrazí v UI
5. Audit trail: viete kto a kedy vymažal
```

## 📝 KRÁTKO

| Čo | Pred | Po |
|----|----|---|
| Delete operácia | `.delete()` → Hard delete | `.update({ is_active: false })` → Soft delete |
| Filter v loadData | `is_active=true` ✅ | `is_active=true` ✅ |
| Filter v handleEditElections | ❌ Chýbajúci | `.eq('is_active', true)` ✅ |
| Staré záznamy | Ostanú v DB | Deaktivované, neviditeľné |

## 🚀 KROKY K IMPLEMENTÁCII

### 1. **Spustenie v Supabase**
```
1. Otvoriť: https://supabase.com/dashboard
2. Prejsť na: SQL Editor
3. Skopírovať SQL skript vyššie
4. Spustiť: Run
5. ✅ Všetci neaktívni kandidáti sú vymazaní
```

### 2. **Overenie v Aplikácii**
```
1. Refresh aplikáciu (F5)
2. Prejsť na Voľby
3. ✅ Vidíte len aktívnych kandidátov
4. Otvoriť Edit modál
5. ✅ Edit modál zobrazuje len aktívnych kandidátov
```

### 3. **Testovanie Mazania**
```
1. Login ako admin
2. Otvoriť kandidáta
3. Kliknúť delete
4. ✅ Kandidát zmiznul z UI
5. Refresh (F5)
6. ✅ Kandidát stále absentuje
```

## 📊 DATABÁZOVÉ SCHÉMA

```sql
election_candidates {
  id: UUID
  full_name: TEXT
  position_type: TEXT (starosta|poslanec)
  election_id: UUID
  is_active: BOOLEAN ← KEY FIELD
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
  ...ostatné polia
}
```

### Filtre v aplikácii:
```typescript
// loadData()
.eq('is_active', true) ✅

// handleEditElections()
.eq('is_active', true) ✅

// handleDeleteCandidate()
.update({ is_active: false }) ✅
```

## ⚠️ DÔLEŽITÉ

- ✅ Soft delete je bezpečnejší (môžete obnovi)
- ✅ Hard delete bol zmysel (vymazaní kandidáti boli úplne pryč)
- ✅ Teraz sú kandidáti len deaktivovaní
- ✅ Staré záznamy treba vymazať manuálne SQL skriptom

## 🎯 FINÁLNY STAV

```
Kód: ✅ OPRAVENÝ
  - Filtre pridané
  - Soft delete implementovaný

Databáza: ⏳ ČAKÁ NA VYČISTENIE
  - Spustiť SQL skript vyššie
  - Vymazať staré is_active=false záznamy

Aplikácia: ✅ HOTOVÁ
  - Zobrazuje len aktívnych kandidátov
  - Mazanie je teraz soft delete
```

---

**Status**: ⏳ Čaká na manuálne vyčistenie databázy
**Akcia**: Spustiť SQL skript v Supabase SQL Editor

