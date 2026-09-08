# Plán rozšírenia sekcie Voľby

## Analýza aktuálneho stavu

### ✅ Čo už funguje:
1. **ElectionsEditModal.tsx** - Modál na úpravu volieb
   - Dynamické pridávanie kandidátov na starostu (mayor)
   - Dynamické pridávanie kandidátov do zastupiteľstva (council)
   - Mazanie jednotlivých kandidátov
   - Mazanie všetkých kandidátov
   - Nahrávanie príloh (ElectionsAttachmentUpload)
   - Prehľadné rozdelenie na záložky (info, mayor, council, files)

2. **ElectionsScreen.tsx** - Displej volieb pre susedov
   - Zobrazenie kandidátov
   - Filtrér na starostu/poslancov
   - Klikacie tlačítko na úpravu (pre admin/starosta/úradník)
   - Modál na zobrazenie detailov kandidáta
   - Ankety

3. **ElectionsAttachmentUpload.tsx** - Upload príloh
   - Drag & drop upload
   - Podpora PDF a obrázkov
   - Max 10MB
   - Zobrazenie uploadnutých súborov

4. **Databáza** - Tabuľky pre voľby
   - `elections` - Základné info volieb
   - `election_candidates` - Kandidáti
   - `elections_attachments` - Prílohy (dokumenty, fotky)
   - Rozdelenie práv (RLS) - admin/starosta/úradník môžu editovať

### ❌ Čo chýba:
1. **Zobrazenie príloh v ElectionsScreen**
   - Nevidno dokumenty a fotky pre susedov
   - Nie je sekcia na zobrazenie prílohy volieb

2. **Úprava loadData v ElectionsScreen**
   - Načítava len candidates, nie attachments
   - Potrebujeme načítať aj elections a attachments

## Implementácia - Potrebné zmeny

### 1. ElectionsScreen.tsx - Rozšírenie o prílohy
```
- Pridať stav pre voľby (elections) a prílohy (attachments)
- Rozšíriť loadData() aby načítala elections a attachments
- Přidat sekciu na zobrazenie prílohi volieb
- Displayovať prílohy ako grid obrázkov / zoznam PDF
```

### 2. ElectionsEditModal.tsx - Overenie
```
- Skontrolovať, či všetky funkcie pracujú
- Testovať mazanie kandidátov
- Testovať nahrávanie príloh
```

### 3. Nový komponent (voliteľno) - AttachmentsViewer
```
- Komponent na zobrazenie prílohi volieb
- Gallery view pre obrázky
- PDF viewer pre dokumenty
- Download možnosť
```

## Technické detaily

### Databázová štruktúra
```sql
-- elections tabuľka
CREATE TABLE elections (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    election_date TIMESTAMPTZ,
    status TEXT ('draft', 'active', 'closed'),
    is_active BOOLEAN,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- election_candidates tabuľka
ALTER TABLE election_candidates ADD COLUMN election_id UUID;
ALTER TABLE election_candidates ADD COLUMN sort_order INTEGER;

-- elections_attachments tabuľka
CREATE TABLE elections_attachments (
    id UUID PRIMARY KEY,
    election_id UUID REFERENCES elections(id),
    file_name TEXT,
    file_type TEXT ('pdf', 'image'),
    file_url TEXT,
    file_size_bytes INTEGER,
    description TEXT,
    sort_order INTEGER,
    uploaded_by UUID,
    created_at TIMESTAMPTZ
);
```

## Test plán

### 1. Vytvorenie volieb s prílohou
- [ ] Otvoriť Edit Voľby
- [ ] Vyplniť základné info (názov, popis, dátum)
- [ ] Pridať starostu a poslancov
- [ ] Nahrať dokument PDF
- [ ] Nahrať obrázok
- [ ] Uložiť zmeny

### 2. Zobrazenie príloh pre susedov
- [ ] Otvoriť Aktuality → Voľby
- [ ] Skontrolovať, že sa prílohy zobrazujú
- [ ] Skontrolovať, že sa PDF a obrázky zobrazujú správne
- [ ] Skontrolovať download funkciu

### 3. Mazanie kandidátov
- [ ] Otvoriť Edit Voľby
- [ ] Vymazať jedného kandidáta
- [ ] Vymazať všetkých kandidátov
- [ ] Skontrolovať, že sa zmeny uložili

## Ďalšie zlepšenia (budúcnosť)

1. PDF viewer s možnosťou fullscreen
2. Image gallery s možnosťou zoom
3. Download prílohi ako ZIP
4. Tagging kandidátov podľa časti obce
5. Ankety na voľby
6. Rôzne jazyky (EN/SK)
