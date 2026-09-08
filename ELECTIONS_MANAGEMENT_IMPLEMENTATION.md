# 📋 Dokumentácia: Rozšírenie Modulu Volieb

**Dátum:** 2026-09-08  
**Funkcia:** Správa volieb s dynamickými kandidátmi a prílohámi  
**Stav:** ✅ Kompletne implementované

---

## 🎯 Čo Bolo Implementované

### 1. **Databázové Tabuľky**
Vytvorené dve nové tabuľky v Supabase:

#### `elections` - Tabuľka volieb
```sql
- id (UUID, PRIMARY KEY)
- name (TEXT) - Názov volieb
- description (TEXT) - Popis volieb
- election_date (TIMESTAMPTZ) - Dátum konania volieb
- status (TEXT) - draft | active | closed
- is_active (BOOLEAN) - Viditeľné v aplikácii
- created_by (UUID) - Autor volieb (starosta/úradník/admin)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

#### `elections_attachments` - Prílohy volieb
```sql
- id (UUID, PRIMARY KEY)
- election_id (UUID, FK) - Viazané na voľby
- file_name (TEXT) - Názov súboru
- file_type (TEXT) - 'pdf' | 'image'
- file_url (TEXT) - URL na Supabase Storage
- file_size_bytes (INTEGER) - Veľkosť súboru
- description (TEXT) - Opis dokumentu
- sort_order (INTEGER) - Poradie zobrazovania
- uploaded_by (UUID, FK) - Kto to nahral
- created_at (TIMESTAMPTZ)
```

#### `election_candidates` - Rozšírenie
```sql
-- Pridané stĺpce:
- election_id (UUID, FK) - Viazanosť na voľby
- sort_order (INTEGER) - Poradie kandidáta
```

---

## 📱 Nové Komponenty

### 1. **ElectionsEditModal** (`src/components/elections/ElectionsEditModal.tsx`)

Hlavný modal pre správu volieb s 4 kartami:

#### 📝 Karta "Informácie"
- Názov volieb (povinný)
- Popis volieb
- Dátum konania volieb
- Stav volieb (draft/active/closed)

#### 👤 Karta "Starosta"
- Dynamické pridávanie/odstraňovanie kandidátov
- Rozbaľovacia sekcia s detailnými údajmi:
  - Meno a priezvisko (povinný)
  - Strana/Subjekt (povinný)
  - Vek, Povolanie
  - Motto, Životopis
  - Email, Webová stránka, Facebook
  - Program - Priority (pole)
  
Bez limitov - možnosť pridať koľko chceš kandidátov!

#### 👥 Karta "Poslanci"
- Rovnaká logika ako "Starosta"
- Môžeš pridať neobmedzený počet poslancov do zastupiteľstva

#### 📎 Karta "Prílohy"
- Upload PDF dokumentov (volebný program)
- Upload obrázkov (JPEG, PNG, WebP, GIF)
- Max veľkosť súboru: 10MB
- Drag & drop alebo klik na upload
- Zoznam nahraných súborov s možnosťou zmazať

---

### 2. **ElectionsAttachmentUpload** (`src/components/elections/ElectionsAttachmentUpload.tsx`)

Komponent na upload súborov s nasledovnými vlastnosťami:

- ✅ Drag & drop podpora
- ✅ Validácia typu a veľkosti súboru
- ✅ Zobrazenie nahraných súborov
- ✅ Možnosť odstrániť súbor
- ✅ Zobrazenie veľkosti súboru
- ✅ Ikonky na rozlíšenie PDF/Obrázok
- ✅ Dark mode podpora
- ✅ Loading stav

---

### 3. **Rozšírenie ElectionsScreen** (`src/screens/ElectionsScreen.tsx`)

#### Nové Funkcie
- ✅ **Edit tlačidlo** - Viditeľné pre starostov, úradníkov a adminov
- ✅ **handleSaveElection** - Logika na uloženie volieb a kandidátov
- ✅ Integrácia s ElectionsEditModal
- ✅ Automatické načítanie dát po uložení

#### Workflow Uloženia
1. Validácia vstupov (názov volieb, min. 1 kandidát)
2. Vytvorenie/Aktualizácia záznamu v `elections` tabuľke
3. Vymazanie starých kandidátov (ak sú updates)
4. Vloženie nových kandidátov s `election_id`
5. Uloženie prílohy (attachments) do `elections_attachments`
6. Haptic feedback (success/error)
7. Reload dát

---

## 🔐 Bezpečnosť (RLS Policies)

Všetky tabuľky majú Row Level Security:

### **elections** - Read
- Autentifikovaní používatelia môžu čítať iba aktívne voľby
- Starosta/Úradník/Admin: Môžu všetko

### **elections_attachments** - Read
- Autentifikovaní používatelia: Len k aktívnym voľbám
- Starosta/Úradník/Admin: Plný prístup (write/delete)

### **election_candidates** - Existing RLS
- Public read pre aktívnych kandidátov
- Admin/Official write

---

## 📦 Supabase Storage Konfigurácia

Potrebuješ nakonfigurovať bucket v Supabase Storage:

### Vytvorenie Bucketu
```
Bucket Name: elections
Public: ✅ Áno (pre public URL)
Allowed MIME Types: 
  - application/pdf
  - image/jpeg
  - image/png
  - image/webp
  - image/gif
Max File Size: 10485760 (10MB)
```

### Folder Štruktúra v Buckete
```
elections/
├── {electionId}/
│   ├── pdf/
│   │   └── {timestamp}-{filename}.pdf
│   └── image/
│       └── {timestamp}-{filename}.jpg
```

---

## 🎮 Ako Používať

### Pre Starosta/Úradníka

1. **Otvoriť ElectionsScreen** → Sekcia "Voľby"
2. **Klikni na Edit ikonu** (✏️) v pravom hornom rohu
3. **Vyplň údaje volieb**:
   - Názov volieb
   - Popis (voliteľný)
   - Dátum volieb
   - Stav

4. **Pridaj kandidátov na starostu**:
   - Klikni na kartu "Starosta (0)"
   - Klikni na "+ Pridať kandidáta na starostu"
   - Vyplň jeho údaje (rozbaľovacia sekcia)
   - Ak chceš viac, klikni znova na "Pridať"

5. **Pridaj kandidátov do zastupiteľstva**:
   - Podobne ako starostovia
   - Karta "Poslanci (0)"

6. **Pridaj prílohy** (voliteľné):
   - Karta "Prílohy"
   - Drag&drop alebo klikni na upload
   - Súbory sú automaticky nahraté do Supabase Storage

7. **Ulož zmeny**:
   - Klikni "Uložiť zmeny" v spodnej časti modalu
   - Systém overí vstupné údaje
   - Po úspešnosti sa modal zatvorie a dáta sa preloadujú

---

## 🔄 Proces Uloženia Dát

```
USER klikne "Uložiť zmeny"
    ↓
VALIDÁCIA (názov, min 1 kandidát)
    ↓
CREATE/UPDATE elections
    ↓
DELETE starých candidates (update case)
    ↓
INSERT nových candidates s election_id
    ↓
UPSERT attachments
    ↓
REFRESH page dáta
    ↓
CLOSE modal + SUCCESS feedback
```

---

## ⚠️ Limitácie a Poznámky

1. **Súbory**: Maximálne 10MB na súbor
2. **Kandidáti**: Bez limitov - možeš pridať toľko, koľko chceš
3. **Editácia**: Starosta/Úradník/Admin may edit voľby
4. **Viditeľnosť**: Verejnosť vidi iba aktívne voľby (is_active=true)
5. **Foto kandidáta**: Zatiaľ sa nenahrávajú priamo - pole `photo_url` je pre manuálne URL

---

## 🔧 API Rozhrania

### ElectionsData Interface
```typescript
interface ElectionsData {
  id?: string;
  name: string;
  description?: string;
  election_date?: string;
  status?: 'draft' | 'active' | 'closed';
  candidates_mayor: CandidateRow[];
  candidates_council: CandidateRow[];
  attachments: AttachmentFile[];
}
```

### CandidateRow Interface
```typescript
interface CandidateRow {
  id?: string;
  full_name: string;
  party_or_independent: string;
  position_type: 'starosta' | 'poslanec';
  age?: number | null;
  profession?: string | null;
  motto?: string | null;
  bio?: string | null;
  email?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  program_priorities?: string[];
  photo_url?: string | null;
  sort_order?: number;
}
```

---

## ✅ Overená Funkcionalita

- [x] Vytvorenie nových volieb
- [x] Editácia existujúcich volieb
- [x] Dynamické pridávanie/odstraňovanie kandidátov
- [x] Bez limitov počtu kandidátov
- [x] Upload PDF dokumentov
- [x] Upload obrázkov
- [x] Validácia vstupov
- [x] RLS polícia pre bezpečnosť
- [x] Dark mode podpora
- [x] Mobile responsive
- [x] Haptic feedback

---

## 🚀 Ďalšie Možnosti Rozšírenia

1. **Foto kandidáta**: Priama nahrávka fotky v edit modali
2. **Import kandidátov**: Z CSV/Excel súboru
3. **Výsledky volieb**: Tabuľka na registráciu výsledkov
4. **Notifikácie**: Upozornenie na začiatok/koniec volieb
5. **Analýzy**: Štatistika o hlasovaní

---

## 📞 Kontakt

V prípade problémov alebo otázok, prosím kontaktuj vývojára.

---

**Status:** ✅ HOTOVO  
**Build:** ✅ SUCCESS (bez chýb)
