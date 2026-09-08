# 🔧 OPRAVA: MAZANIE KANDIDÁTOV - BUG FIX

## 🐛 IDENTIFIKOVANÝ PROBLÉM

Používatelia hlásili, že po kliknutí na "Vymazať všetkých" sa kandidáti nevymazali a stále sa zobrazovali v modáli.

### ROOT CAUSE (Hlavný dôvod):

1. **ElectionsEditModal.tsx** (Riadky 150-157):
   - Funkcie `clearAllMayorCandidates()` a `clearAllCouncilCandidates()` 
   - Nastavovali pole na `[emptyCandidate()]` - jeden prázdny kandidát
   - To malo problém: Keď sa formulár uložil, filter na riadku 201-202 vyfiltral prázdneho kandidáta
   - Výsledok: Žiadny delete sa neuskutočnil!

2. **Podmienka pre zobrazenie "Vymazať všetkých"**:
   - Pôvodne: `formData.candidates_mayor.some((c) => c.full_name.trim())`
   - To skrývalo tlačítko hneď ako sa zadá meno
   - Nesprávna logika: Tlačítko muselo byť viditeľné, pokiaľ je pole neprázdne

3. **ElectionsScreen.tsx** (Logika ukladaní prílohy):
   - Prílohy sa upsertovioli, ale nemazali pri úprave
   - Novej prílohy sa neukladali s správnym sort_order

---

## ✅ IMPLEMENTOVANÉ OPRAVY

### 1. **ElectionsEditModal.tsx - Oprava mazaní kandidátov**

**Zmena 1: Riadky 150-157** - Vrátenie prázdneho poľa namiesto `[emptyCandidate()]`:

```typescript
// PRED (CHYBNE):
const clearAllMayorCandidates = () => {
  setFormData(prev => ({
    ...prev,
    candidates_mayor: [emptyCandidate()]  // ❌ Vracia 1 prázdny
  }));
};

// PO (SPRÁVNE):
const clearAllMayorCandidates = () => {
  setFormData(prev => ({
    ...prev,
    candidates_mayor: []  // ✅ Vracia prázdne pole
  }));
};
```

To isté pre `clearAllCouncilCandidates()`.

---

**Zmena 2: Riadky 354 a 397** - Oprava podmienky pre zobrazenie "Vymazať všetkých":

```typescript
// PRED (CHYBNE):
{formData.candidates_mayor.some((c) => c.full_name.trim()) && (
  <button>Vymazať všetkých</button>
)}

// PO (SPRÁVNE):
{formData.candidates_mayor.length > 0 && (
  <button>Vymazať všetkých</button>
)}
```

- `formData.candidates_mayor.length > 0` znamená: Ak je v poli aspoň niečo (aj prázdni kandidáti)
- To umožní mazať všetkých bez ohľadu na to, či majú vyplnené mená

---

**Zmena 3: Riadky 179-220** - Vyčistenie validácie:

```typescript
// PRED:
if (
  (formData.candidates_mayor.length === 1 && !formData.candidates_mayor[0].full_name.trim()) &&
  (formData.candidates_council.length === 1 && !formData.candidates_council[0].full_name.trim())
) {
  setError('Pridaj aspoň jedného kandidáta');
  return;
}

// PO: Odstranená validácia (necháme prázdne voľby)
// Filter na riadku 201-202 sa postará o vymazaní
```

- Teraz môžu byť voľby bez kandidátov (napríklad len s info a prílohou)
- Filter sa stará o vyčistení prázdnych kandidátov pred savingom

---

### 2. **ElectionsScreen.tsx - Oprava logiky ukladaní prílohy**

**Zmena: Riadky 207-238** - Mazaní starých prílohy a INSERT namiesto UPSERT:

```typescript
// PRED (PROBLÉM: Prílohy sa neumazali):
if (data.attachments.length > 0) {
  const attachmentsToUpsert = data.attachments
    .filter((a) => a.file_url)
    .map((a) => ({
      id: a.id,  // ❌ ID nových prílohy nemá
      // ... ostatné polia
    }));
  
  const { error: attachError } = await supabase
    .from('elections_attachments')
    .upsert(attachmentsToUpsert);  // ❌ UPSERT bez ID = chyba
}

// PO (SPRÁVNE: Najprv vymaž, potom vlož):
// 1. Vymaž staré prílohy
if (data.id) {
  await supabase
    .from('elections_attachments')
    .delete()
    .eq('election_id', electionId);
}

// 2. Vlož nové prílohy
if (data.attachments.length > 0) {
  const attachmentsToInsert = data.attachments
    .filter((a) => a.file_url)
    .map((a, idx) => ({
      // Bez id! Databáza vygeneruje UUID
      election_id: electionId,
      file_name: a.file_name,
      file_type: a.file_type,
      file_url: a.file_url,
      file_size_bytes: a.file_size_bytes,
      description: a.description,
      sort_order: idx,  // ✅ Správny sort_order
      uploaded_by: profile?.id
    }));
  
  const { error: attachError } = await supabase
    .from('elections_attachments')
    .insert(attachmentsToInsert);  // ✅ INSERT, nie UPSERT
}
```

---

## 🧪 WORKFLOW TESTOVANIA

### Test 1: Mazaní jednotlivých kandidátov

```
1. Otvorte modal volieb
2. Prejdite na záložku "Starosta"
3. Pridajte 3 kandidátov s menami
4. Kliknite na ikonku koša vedľa prvého kandidáta
5. ✅ Kandidát sa odstráni z formulára
6. Kliknite "Uložiť zmeny"
7. ✅ Kandidát je vymazaný v DB a pri obnovení nie je viditeľný
```

### Test 2: Mazaní všetkých kandidátov

```
1. Otvorte modal volieb
2. Pridajte 3 kandidátov na starostu
3. Kliknite "Vymazať všetkých"
4. Potvrdite dialog "Vymazať"
5. ✅ Všetci kandidáti sú odstránení (pole je prázdne)
6. Kliknite "Uložiť zmeny"
7. ✅ Všetci kandidáti sú vymazaní z DB
8. ✅ V sekcii Voľby sa nezobrazujú
```

### Test 3: Mazaní prílohy

```
1. Otvorte modal volieb
2. Prejdite na záložku "Prílohy"
3. Nahrajte PDF a obrázok
4. Kliknite "Vymazať všetko"
5. ✅ Všetky prílohy sú odstránené
6. Kliknite "Uložiť zmeny"
7. ✅ Prílohy sú vymazané z DB a storage
8. ✅ V sekcii "Dokumenty a fotografie" sú pryč
```

### Test 4: Editácia volieb so zmenami

```
1. Existujúce voľby majú:
   - 2 kandidátov na starostu
   - 3 kandidátov na poslanecov
   - 2 prílohy
2. Otvorte "Upraviť voľby"
3. Vymaž 1 kandidáta na starostu
4. Pridaj 1 nového kandidáta na poslanecov
5. Vymaž 1 prílohu
6. Kliknite "Uložiť zmeny"
7. ✅ Databáza má správný stav:
   - 1 kandidát na starostu
   - 4 kandidáti na poslanecov
   - 1 príloha
8. ✅ UI sa obnoví s novými dátami
```

---

## 📊 DETAILY ZMIEN

| Súbor | Riadky | Zmena | Dôvod |
|-------|--------|-------|-------|
| ElectionsEditModal.tsx | 150-157 | `[emptyCandidate()]` → `[]` | Vracia naozaj prázdne pole |
| ElectionsEditModal.tsx | 179-194 | Odstranená validácia "aspoň 1 kandidát" | Voľby bez kandidátov sú legálne |
| ElectionsEditModal.tsx | 354 | `.some()` → `.length > 0` | Správna logika pre viditeľnosť tlačítka |
| ElectionsEditModal.tsx | 397 | `.some()` → `.length > 0` | To isté pre poslanecov |
| ElectionsScreen.tsx | 207-238 | DELETE, potom INSERT | Prevzorná logika: vymaž staré, vlož nové |

---

## ✅ BUILD VALIDÁCIA

```
✓ TypeScript compilation: bez chýb
✓ Vite build: 3.07s, no errors
✓ Production bundle: 1.9 MB precache
✓ Dev server: running na http://localhost:5176
```

---

## 🚀 DEPLOYMENT

1. **Produkčný build**: `npm run build`
2. **Nasadenie**: Skopíruj obsah `dist/` na server
3. **Testing**: Preotvori všetky testovací scenáre

---

## 📝 POZNÁMKY

- Opravy sú **spätne kompatibilné** - žiaden breaking change
- Existujúce voľby s kandidátami budú fungovať bez zmien
- Nové voľby bez kandidátov budú teraz možné
- Mazaní je teraz **skutočné** - zmeny sa uchujú v DB

**Status**: ✅ HOTOVO
**Overené**: Build a dev server
**Prípravný dátum**: 8. september 2026 (v čase psania)

