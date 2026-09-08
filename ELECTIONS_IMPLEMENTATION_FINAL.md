# Rozšírenie sekcie Voľby - Finálna dokumentácia

## ✅ Vykonané zmeny

### 1. **ElectionsScreen.tsx** - Rozšírenie o prílohy
   
#### Pridané:
- **Type `Attachment`** - Typ pre prílohy z databázy
- **State `attachments`** - Stav na uloženie načítaných prílohy
- **Funkcia `handleEditElections()`** - Načítava existujúce voľby, kandidátov a prílohy
- **Sekcia na zobrazenie prílohi** - Grid na zobrazenie obrázkov a PDF dokumentov
- **Edit tlačítko** - Zmeny na zavolanie `handleEditElections()`

#### Prílohy Sekcia:
```
- Zobrazuje prílohy ako grid (1 stĺpec na mobiloch, 2 na desktop)
- Obrázky: Náhľad s aspect-ratio 16:9
- PDF: Placeholder s ikonou PDF
- Download link pri každej prílohe
- Informácie o súbore: názov, popis, veľkosť
```

### 2. **ElectionsScreen.tsx** - Oprava uloženia prílohy

#### Zmena v `handleSaveElection()`:
- Všetky prílohy s `file_url` sa upsertujú do `elections_attachments` tabuľky
- Dôvodejšej logiky: Filtroval sa iba prílohy bez ID začínajúceho 'new' (ktoré nikdy nie sú vytvárané)
- Nová logika: Všetky prílohy s URL sa vložia do databázy

### 3. **Databáza - RLS a štruktúra**

#### Existujúce tabuľky (bez zmien):
- `elections` - Voľby (id, name, description, election_date, status, created_by, created_at, updated_at)
- `election_candidates` - Kandidáti (election_id, sort_order)
- `elections_attachments` - Prílohy (election_id, file_name, file_type, file_url, file_size_bytes, description, sort_order, uploaded_by)

#### RLS Politiky:
- **Čítanie**: Všetci autentifikovaní môžu čítať aktívne voľby a prílohy
- **Písanie**: Iba admin, starosta a úradník (is_admin=true, is_official=true)

## 🧪 Testovací plán

### Test 1: Vytvorenie novej voľby s prílohou
1. Prejdite na "Aktuality" → "Voľby"
2. Kliknite na Edit ikonu (iba ak ste admin/starosta/úradník)
3. Vyplňte základné informácie (názov, popis, dátum)
4. Pridajte starostu a poslancov
5. Prejdite na záložku "Prílohy"
6. Nahrajte PDF a obrázok
7. Uložte zmeny
8. **Očakávané**: Prílohy sa zobrazia v sekcii "Dokumenty a fotografie"

### Test 2: Editácia existujúcej voľby
1. Kliknite na Edit ikonu
2. **Očakávané**: Modal by mal obsahovať všetky existujúce kandidáty a prílohy
3. Zmene niečo (napr. názov, pridajte kandidáta)
4. Uložte zmeny
5. **Očakávané**: Všetky zmeny by mali byť uložené

### Test 3: Zobrazenie prílohy pre susedov
1. Prejdite na "Aktuality" → "Voľby" (ako normálny sused bez práv na úpravu)
2. **Očakávané**: Vidíte kandidátov a prílohy
3. Kliknite na prílohu (obrázok alebo PDF)
4. **Očakávané**: Súbor sa otvorí v novej záložke

### Test 4: Mazanie prílohy
1. Otvrite Edit modál (ako admin/starosta/úradník)
2. Prejdite na "Prílohy"
3. Nájdite prílohu v zozname
4. Kliknite na ikonku koša vedľa prílohy
5. **Očakávané**: Príloha sa odstráni z formulára
6. Uložte zmeny
7. **Očakávané**: Príloha je vymazaná z databázy a v Voľby sekcie

### Test 5: Mazanie kandidátov
1. Otvrite Edit modál
2. Prejdite na "Starosta" alebo "Poslanci"
3. Kliknite na ikonku koša vedľa kandidáta
4. **Očakávané**: Kandidát sa odstráni
5. Uložte zmeny
6. **Očakávané**: Kandidát je vymazaný z databázy

### Test 6: Mobilný responsive
1. Otvorte aplikáciu na mobilnom zariadení (390px - iPhone 12)
2. Prejdite na "Voľby"
3. **Očakávané**: Prílohy sa zobrazia ako 1-stĺpcový grid
4. Otvorte Edit modál
5. **Očakávané**: Všetky sekcie sú dostupné a scrollovateľné
6. Tlačítka "Uložiť" a "Zavrieť" sú viditeľné

## 📊 Štruktúra súborov

### Zmenené súbory:
```
src/screens/ElectionsScreen.tsx
├── Importy: +FileText, +Image, +Download
├── Type: +Attachment
├── State: +attachments
├── Funkcia: +handleEditElections()
├── Helper: +emptyElectionCandidate()
├── loadData(): +prílohy loading
├── handleSaveElection(): +opravená logika prílohy
└── Render: +prílohy sekcia + zmena edit tlačítka
```

### Nezmenené súbory:
```
src/components/elections/ElectionsEditModal.tsx ✓
src/components/elections/ElectionsAttachmentUpload.tsx ✓
src/components/elections/CandidateCard.tsx ✓
src/components/elections/CandidateModal.tsx ✓
src/screens/AktualityScreen.tsx ✓
src/components/AnimatedModal.tsx ✓
```

## 🔧 Technické detaily

### API Volania:

**Načítanie prílohy volieb:**
```javascript
const { data: aData } = await supabase
  .from('elections_attachments')
  .select('*')
  .order('sort_order', { ascending: true });
```

**Uloženie prílohy volieb:**
```javascript
const { error: attachError } = await supabase
  .from('elections_attachments')
  .upsert(attachmentsToUpsert); // Všetky s file_url
```

**Načítanie existujúcej voľby na edit:**
```javascript
const { data: electionsData } = await supabase
  .from('elections')
  .select('*')
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(1);
```

### CSS Tailwind Triedy:

```
grid grid-cols-1 md:grid-cols-2 - Responsive grid
aspect-video - Pomer 16:9 pre obrázky
group-hover:scale-105 - Zoom efekt pri hover
flex flex-col h-full - Fullheight flex card
border border-slate-200 dark:border-slate-700 - Bordery
transition-all transition-transform - Animácie
```

## 🐛 Známe obmedzenia

1. **Mazanie jednotlivých prílohy** - Tlačítko na vymazanie jednotlivej prílohy sa zobrazuje len v Edit mode
2. **PDF Viewer** - PDF sa otvorí v novej záložke Supabase viewer, nie v aplikácií
3. **Obrázky** - Prílohy sú maximálne 10MB (limit ElectionsAttachmentUpload)
4. **Sortovanie** - Prílohy sa sorting po `sort_order`, ale UI na zmenu poradia nie je dostupné

## 🚀 Budúce zlepšenia

1. [  ] Súčasný PDF viewer v aplikácii (bez novej záložky)
2. [  ] Image gallery s zoom a fullscreen
3. [  ] Drag & drop reorder prílohy
4. [  ] Súbor prílohy ako ZIP download
5. [  ] Tagging prílohy (napr. "Kandidáti", "Info", atď.)
6. [  ] Komentáre na prílohy
7. [  ] Verzia histórie prílohy

## ✨ Záverečné poznámky

- Všetky zmeny sú späť kompatibilné
- Databázová schéma ostala zachovaná
- RLS politiky sú bez zmien
- Mobile-first prístup na zobrazenie prílohy
- Aplikácia je pripravená na produkciu

