# 📸 VOĽBY MODUL - FOTKY KANDIDÁTOV

## ✅ ČOŽE JE HOTOVO

### 1. 📱 Upload fotiek kandidátov
```
- Pridané v ElectionsEditModal (CandidateRow)
- Max 5MB, povolené: JPEG, PNG, WebP
- Ukladá sa do Supabase Storage (elections/candidates/)
- Fotka sa automaticky zobrazuje v CandidateCard
```

### 2. 🖼️ Zobrazenie fotiek
```
- CandidateCard: Viditeľné v "Voľby pre susedov"
- CandidateModal: Viditeľné v detaily kandidáta
- Hover efekt: Fotka sa zväčší pri prechode myšou
```

### 3. 🗑️ Mazanie fotiek
```
- Remove button: Kliknúť X na fotke
- Mazanie fotky: Soft delete (fotka ostane v DB ale s photo_url=null)
- Mazanie kandidáta: Fotka sa maže s kandidátom (is_active=false)
```

---

## 🚀 WORKFLOW UPLOAD FOTKY

### Krok 1: Otvorenie EditModal
```
Voľby → Edit tlačítko → Starosta/Poslanci tab
```

### Krok 2: Rozšírenie kandidáta
```
Kliknúť na kandidáta, aby sa rozšíril
```

### Krok 3: Upload fotky
```
Kliknúť: "Vložiť fotku"
Vybrať súbor: .jpg, .png, .webp (max 5MB)
```

### Krok 4: Uloženie
```
Kliknúť: "Uložiť zmeny"
Fotka sa nahrá do Supabase Storage
Fotka sa uloží do election_candidates.photo_url
```

### Krok 5: Zobrazenie
```
Voľby → Vidíte fotky v CandidateCard gridu
Kliknúť na kandidáta → Vidíte fotku vo väčšom modale
```

---

## 📁 TECHNICKÉ DETAILY

### Database
```sql
election_candidates {
  id: UUID
  photo_url: TEXT (URL na Supabase Storage)
  ... ostatné polia
}
```

### Storage
```
Bucket: elections
Cesta: candidates/{candidateId}-{timestamp}-{filename}
```

### Komponenty
```
ElectionsEditModal
├── CandidateRow
│   └── CandidatePhotoUpload ← NEW
└── ElectionsAttachmentUpload

CandidateCard
└── Zobrazuje photo_url (HOTOVO)

CandidateModal
└── Zobrazuje photo_url (HOTOVO)
```

---

## 🧪 TESTOVANIE

### Scenár 1: Nahrať fotku
```
1. Voľby → Edit
2. Candidate → Rozšíriť
3. "Vložiť fotku" → Vybrať .jpg
4. Uložiť zmeny
5. ✅ Fotka sa uloží
6. Refresh (F5)
7. ✅ Fotka ostane
```

### Scenár 2: Odstrániť fotku
```
1. Voľby → Edit
2. Candidate → Rozšíriť
3. Kliknúť X na fotke
4. Uložiť zmeny
5. ✅ Fotka sa odstráni (photo_url=null)
6. ✅ CandidateCard zobrazí User ikonu
```

### Scenár 3: Odstrániť kandidáta s fotkou
```
1. Voľby → Edit
2. Candidate → Kliknúť delete
3. Potvrdiť delete
4. ✅ Kandidát + fotka sa vymažú (is_active=false)
5. ✅ CandidateCard kandidáta zmizne
```

### Scenár 4: Zobrazenie v profile
```
1. Voľby
2. Vidíte CandidateCard s fotkou
3. Kliknúť "Detail kandidáta"
4. ✅ CandidateModal zobrazí fotku
```

---

## ⚙️ IMPLEMENTÁCIA

### 1. ElectionsEditModal - CandidatePhotoUpload
```typescript
// NEW KOMPONENT (lines 723-798 v ElectionsEditModal.tsx)

const CandidatePhotoUpload: React.FC<...> = ({
  photo_url,
  onChange,
  candidateId,
  disabled
}) => {
  // Upload logika:
  // 1. Validácia (size, type)
  // 2. Upload do Supabase Storage
  // 3. Vrátenie public URL
  // 4. Callback onChange(url)
  
  // Render:
  // - Ak photo_url → Zobraz fotku + X button
  // - Ak NIE → Upload input
}
```

### 2. CandidateRow - Photo upload field
```typescript
// PRIDANÉ (lines 699-706 v ElectionsEditModal.tsx)

<CandidatePhotoUpload
  photo_url={candidate.photo_url}
  onChange={(url) => onChange('photo_url', url)}
  candidateId={candidate.id}
  disabled={disabled}
/>
```

### 3. CandidateCard - Zobrazenie fotky
```typescript
// EXISTUJE (lines 67-77 v CandidateCard.tsx)

{candidate.photo_url ? (
  <img src={candidate.photo_url} alt={candidate.full_name} />
) : (
  <User icon />
)}
```

---

## 📊 WORKFLOW MAZANIA

### Soft Delete Fotky (bez mazania kandidáta)
```
User: Kliknúť X na fotke
↓
CandidatePhotoUpload.handleRemovePhoto()
↓
onChange(null)
↓
candidate.photo_url = null
↓
handleSave() → UPDATE election_candidates SET photo_url=null
↓
✅ Fotka zmizne z UI
✅ DB: photo_url = null (ale kandidát ostane)
```

### Hard Delete Fotky (spolu s kandidátom)
```
User: Kliknúť delete na kandidáta
↓
ElectionsEditModal.onDelete(candidateId)
↓
ElectionsScreen.handleDeleteCandidate()
↓
UPDATE election_candidates SET is_active=false
↓
loadData() filtruje is_active=true
↓
✅ Kandidát + fotka zmizne z UI
✅ DB: candidate.is_active = false (ale record ostane)
```

---

## 🎯 KLÚ ČOVÉ BODY

- ✅ Fotky sa ukladajú v Supabase Storage (elections bucket)
- ✅ photo_url sa ukladá v DB (election_candidates.photo_url)
- ✅ Mazanie: Soft delete (photo_url=null alebo is_active=false)
- ✅ Zobrazenie: Automatické v CandidateCard a CandidateModal
- ✅ Validácia: Max 5MB, len obrázky
- ✅ Build: SUCCESS ✅

---

## 📋 KROKY K NASADENIU

### 1. Code Review
- [x] ElectionsEditModal: CandidatePhotoUpload komponent
- [x] CandidateRow: Photo upload field
- [x] Build: SUCCESS

### 2. Testing
- [ ] Upload fotky (JPEG, PNG, WebP)
- [ ] Zobrazenie fotky v CandidateCard
- [ ] Zobrazenie fotky v CandidateModal
- [ ] Remove fotky (bez mazania kandidáta)
- [ ] Delete kandidáta (s fotkou)
- [ ] Refresh stránky

### 3. Database
- [ ] Overiť že photo_url sa ukladá do election_candidates
- [ ] Skontrolovať Supabase Storage (elections/candidates/)

### 4. Deployment
- [ ] npm run build
- [ ] Deploy dist/ to production

---

## 🔍 MOŽNÉ PROBLÉMY A RIEŠENIA

### Problem: Fotka sa nenahrá
```
Príčina: Storage bucket 'elections' neexistuje
Riešenie: Vytvoriť bucket v Supabase (Storage → New bucket → elections)
         Nastaviť RLS policy: allow public read, auth write
```

### Problem: Fotka sa zobrazuje ale zmiznú po refreshi
```
Príčina: photo_url sa neukladá do DB
Riešenie: Skontrolovať handleSave() v ElectionsScreen
         Uistiť sa že onChange('photo_url', url) sa volá
```

### Problem: Mazanie fotky nemá efekt
```
Príčina: onChange(null) sa neukladá
Riešenie: Skontrolovať handleSave() filtruje null hodnoty
         Upraviť na UPDATE photo_url=null
```

---

## ✨ FINÁLNY STATUS

```
╔════════════════════════════════════════╗
║     FOTKY KANDIDÁTOV - HOTOVO!        ║
╠════════════════════════════════════════╣
║ Upload:       ✅ IMPLEMENTOVANÝ        ║
║ Zobrazenie:   ✅ HOTOVÉ                ║
║ Mazanie:      ✅ HOTOVÉ                ║
║ Build:        ✅ ÚSPEŠNÝ (0 errors)   ║
║ Database:     ✅ FIELD EXISTS          ║
║ Testing:      ⏳ ČAKÁ                  ║
╚════════════════════════════════════════╝
```

---

## 📞 SUMMARY

| Čo | Kde | Ako |
|----|----|-----|
| Upload fotky | ElectionsEditModal | Vložiť fotku → Vybrať súbor |
| Zobrazenie | CandidateCard | Automatické (photo_url) |
| Remove fotky | CandidateRow | Kliknúť X |
| Delete kandidáta | CandidateModal | Kliknúť delete |
| Mazanie fotky | Soft delete | photo_url=null alebo is_active=false |

---

**Status**: Ready for Testing  
**Build**: ✅ SUCCESS  
**Time**: ~2 hours implementation + testing
