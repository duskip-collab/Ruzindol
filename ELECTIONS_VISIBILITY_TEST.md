# ✅ VOĽBY MODUL - VIDITEĽNOSŤ PRE SUSEDOV (TESTOVANIE)

## 📋 KONTROLNÝ LIST

### 🔍 KOMPONENTY OVERENIA

| Komponenta | Súbor | Status |
|------------|-------|--------|
| ElectionsScreen | src/screens/ElectionsScreen.tsx | ✅ Logika OK |
| AdminElectionsToggle | src/components/admin/AdminElectionsToggle.tsx | ✅ Toggle OK |
| AppSettingsContext | src/context/AppSettingsContext.tsx | ✅ Context OK |
| Database (app_settings) | migrations/20260831120000 | ✅ Table OK |

---

## 🧪 LOGIKA VIDITEĽNOSTI

### Aktálna implementácia:

```typescript
// ElectionsScreen.tsx (Line 291)
if (!electionsEnabled && !isOfficial) {
  return <div>Modul volieb nie je aktívny</div>;
}
```

### Čo to znamená:

```
Prípad 1: electionsEnabled=TRUE
  ├─ Sused: ✅ Vidí Voľby
  ├─ Admin: ✅ Vidí Voľby + Edit
  └─ Starosta: ✅ Vidí Voľby + Edit

Prípad 2: electionsEnabled=FALSE
  ├─ Sused: ❌ Vidí "Modul volieb nie je aktívny"
  ├─ Admin: ✅ Vidí Voľby + Edit
  └─ Starosta: ✅ Vidí Voľby + Edit
```

---

## 🚀 TESTOVACÍ SZENÁR

### Pre Admin/Starosta:

#### KROK 1: Otvoriť Admin Panel
```
1. Login ako Admin/Starosta
2. Menu → Admin Panel (ak vidíte)
3. Vidíte "Komunálne voľby" s togglem
```

#### KROK 2: Skontrolovať aktuálny stav
```
1. Vidíte toggle?
   ✅ ANO: Voľby sú {"Aktívne v PWA" | "Skryté pre obyvateľov"}
   ❌ NIE: Skontrolujte role
```

#### KROK 3: Zapnúť Voľby
```
1. Kliknúť na toggle
2. Vidíte "Aktívne v PWA" ✅
3. Vidíte checkmark v togglei
```

#### KROK 4: Refresh a overenie
```
1. F5 (Refresh stránku)
2. Menu → Voľby
3. ✅ Vidíte Voľby + Edit + Kandidáti
```

### Pre Sused:

#### KROK 1: Kedy sú Voľby viditeľné?
```
PRED (electionsEnabled=FALSE):
  Menu → Voľby
  ✅ Vidíte: "Modul volieb nie je aktívny"

PO (electionsEnabled=TRUE):
  Menu → Voľby
  ✅ Vidíte: Kandidáti + Voľby

NEMA Edit tlačítka (iba si čita)
```

#### KROK 2: Nie je viditeľný Edit
```
Ako Sused v Voľby sekcii:
  ❌ Edit button by NEMAL byť viditeľný
  ✅ Iba "Detail kandidáta" button
```

---

## 🔄 REALTIME AKTUALIZÁCIA

### Ako funguje:

```
Admin: Zapne toggle v AdminPanel
  ↓
Toggle zavolá setElectionsEnabled(true)
  ↓
AppSettings UPSERT do app_settings tabuľky
  ↓
Supabase Realtime:
  ├─ AppSettingsContext si načíta zmenu
  ├─ electionsEnabled = true
  └─ Všetci Users dostanú UPDATE (okamžitá zmena)
  ↓
ElectionsScreen: if (!electionsEnabled && !isOfficial)
  ├─ FALSE && FALSE = FALSE → Zobraz Voľby ✅
  ├─ Všetci Suedia vidíme Voľby
  └─ Bez refreshu (realtime update)
```

---

## 📊 OČAKÁVANÉ VÝSLEDKY

### Test 1: Toggle v Admin Panel
```
Status: ⏳ PENDING
Steps:
  1. Login: Admin
  2. Admin Panel
  3. Vidíte "Komunálne voľby" toggle
Expected:
  ✅ Toggle viditeľný
  ✅ Stav: "Aktívne v PWA" alebo "Skryté"
  ✅ Klik na toggle spustí zmenu
```

### Test 2: Zmena viditeľnosti Susa
```
Status: ⏳ PENDING
Precondition:
  - 2 tabs: Admin Panel (Admin) + Voľby (Sused)
Steps:
  1. Admin: Toggle Voľby ON
Expected:
  ✅ Admin: "Aktívne v PWA" + checkmark
  ✅ Sused (tab 2): Voľby sa automaticky zobrazíme (bez F5)
  ✅ Vidíte kandidáti
```

### Test 3: Vypnutie viditeľnosti
```
Status: ⏳ PENDING
Precondition:
  - electionsEnabled = TRUE
  - Sused vidí Voľby
Steps:
  1. Admin: Toggle Voľby OFF
  2. Sused: Čaká...
Expected:
  ✅ Sused: "Modul volieb nie je aktívny" (bez F5)
  ✅ Kandidáti zmiznú
```

### Test 4: Edit tlačítko viditeľnosť
```
Status: ⏳ PENDING
Steps:
  1. Login: Sused
  2. Menu → Voľby (ak je zapnuté)
Expected:
  ✅ Edit button: NIE (len Admin/Starosta vidíme)
  ✅ Iba "Detail kandidáta" button
  ✅ Žiadny "Upraviť voľby" button
```

### Test 5: Admin vždy vidí Voľby
```
Status: ⏳ PENDING
Precondition:
  - electionsEnabled = FALSE
Steps:
  1. Login: Admin
  2. Menu → Voľby
Expected:
  ✅ Admin vidí Voľby aj keď je FALSE
  ✅ Vidíte Edit button
  ✅ Vidíte možnosť editovať
```

---

## 🐛 MOŽNÉ PROBLÉMY A RIEŠENIA

### Problem: Toggle sa nezobrazuje
```
Príčina: Nie ste Admin/Starosta
Riešenie: Login ako Admin alebo Starosta
         Skontrolujte role v database
```

### Problem: Zmena viditeľnosti nefunguje realtime
```
Príčina: Realtime subscription nie je aktívna
Riešenie: Skontrolujte Supabase realtime settings
         Refresh stránku (F5)
```

### Problem: Sused stále vidí Voľby keď sú OFF
```
Príčina: Cache v aplikácii
Riešenie: Refresh (F5) alebo Ctrl+Shift+R
         Skontrolujte DevTools → Network → app_settings
```

### Problem: Edit button viditeľný pre Susa
```
Príčina: Role check nie je správny
Riešenie: Skontrolujte profile.role v DevTools
         Musí byť: 'Starosta', 'Uradnik', 'Admin', nie 'Sused'
```

---

## 🔍 DEBUG TIPS

### Ako skontrolovať aktuálne nastavenia:

1. **Browser DevTools → Console:**
```javascript
// Skontrolujte electionsEnabled
console.log('Elections enabled state')
```

2. **Browser DevTools → Application → Storage:**
```
LocalStorage: Hľadajte 'elections_enabled'
```

3. **Supabase Dashboard → SQL Editor:**
```sql
SELECT * FROM app_settings WHERE key = 'elections_enabled';
```

4. **Network tab:**
```
Hľadajte requests na app_settings tabuľku
Skontrolujte response value
```

---

## ✅ CHECKLIST PRED PRODUKCIOU

- [ ] Admin vidí toggle v Admin Panel
- [ ] Toggle zmení stav z "Skryté" na "Aktívne"
- [ ] Sused vidí/nevidí Voľby podľa stavu
- [ ] Realtime update bez refresh (optimálne)
- [ ] Edit button viditeľný len pre officials
- [ ] Database app_settings má správnu hodnotu
- [ ] RLS policy umožňuje čítanie a zápis
- [ ] ✅ VŠETKO OK - READY FOR PRODUCTION

---

## 📋 KOMPLETNÝ TEST SCENÁR (10 MINÚT)

```
⏱️  ~1 min: Admin Panel → Toggle
⏱️  ~2 min: Sused vidí Voľby (so zapnutím)
⏱️  ~2 min: Sused NEVIDÍ Voľby (s vypnutím)
⏱️  ~2 min: Edit button viditeľnosť
⏱️  ~2 min: Realtime update (bez refresh)
⏱️  ~1 min: Database verifikácia

TOTAL: ~10 MINÚT
```

---

## 📞 SUMMARY

### Co je Hotovo
- ✅ Toggle je v Admin Panel
- ✅ Logika je správna (if (!electionsEnabled && !isOfficial))
- ✅ RLS policy je nastavená
- ✅ Realtime subscription je aktívna
- ✅ Build: SUCCESS

### Co treba Testovať
- ⏳ Toggle funguje
- ⏳ Sused vidí/nevidí správne
- ⏳ Realtime update
- ⏳ Edit button viditeľnosť
- ⏳ Role check je správny

### Očakávané Výsledky
```
electionsEnabled=TRUE:
  - Všetci vidíme Voľby
  - Admin/Starosta vidíme Edit

electionsEnabled=FALSE:
  - Susedia NEVIDIA Voľby ("Modul nie je aktívny")
  - Admin/Starosta vidíme Voľby + Edit
```

---

**Status**: Ready for Testing  
**Logic**: ✅ VERIFIED  
**Implementation**: ✅ COMPLETE  
**Build**: ✅ SUCCESS
