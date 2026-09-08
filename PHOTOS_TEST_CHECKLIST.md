# ✅ FOTKY KANDIDÁTOV - TESTOVACÍ CHECKLIST

## 🚀 QUICK START (5 MINÚT)

### 1. Build
```
npm run build
✅ SUCCESS (0 errors)
```

### 2. Start App
```
http://localhost:5176
Menu → Voľby
```

### 3. Nahrať fotku
```
1. Kliknúť Edit
2. Kliknúť na Kandidáta (Starosta tab)
3. Kliknúť "Vložiť fotku"
4. Vybrať .jpg/.png/.webp
5. ✅ Fotka sa zobrazí (s X button)
```

### 4. Uložiť zmeny
```
Kliknúť "Uložiť zmeny"
Refresh (F5)
✅ Fotka ostane
```

### 5. Zobrazenie
```
Menu → Voľby
✅ CandidateCard ukazuje fotku
Kliknúť → Detail
✅ CandidateModal ukazuje fotku
```

### 6. Remove fotka
```
Edit → Kandidát → Kliknúť X na fotke
Uložiť zmeny
✅ Fotka zmizne (User ikona sa objaví)
```

---

## ✅ DETAIL TESTY

### Test 1: Upload fotky
```
Status: ⏳ PENDING
Steps:
  1. Voľby → Edit
  2. Candidate → Rozšíriť
  3. "Vložiť fotku"
  4. Vybrať: sample.jpg (5MB or less)
  5. Kliknúť Uložiť zmeny
Expected:
  ✅ Fotka sa nahrá
  ✅ Uloží sa do Supabase Storage
  ✅ photo_url sa uloží v DB
  ✅ CandidateCard zobrazí fotku
```

### Test 2: Zobrazenie fotky
```
Status: ⏳ PENDING
Steps:
  1. Voľby
Expected:
  ✅ CandidateCard s fotkou
  ✅ Fotka viditeľná v gridu
  ✅ Hover efekt (fotka sa zväčší)
  ✅ Kliknúť Detail → CandidateModal s fotkou
```

### Test 3: Remove fotka
```
Status: ⏳ PENDING
Steps:
  1. Voľby → Edit
  2. Candidate → Kliknúť X na fotke
  3. Uložiť zmeny
Expected:
  ✅ Fotka zmizne
  ✅ User ikona sa zobrazí
  ✅ photo_url = null v DB
```

### Test 4: Delete kandidáta
```
Status: ⏳ PENDING
Steps:
  1. Voľby → Edit
  2. Candidate → Kliknúť delete
  3. Potvrdiť
Expected:
  ✅ Kandidát + fotka zmizne
  ✅ is_active = false v DB
  ✅ CandidateCard sa neobjavuje
```

### Test 5: Refresh po uploade
```
Status: ⏳ PENDING
Steps:
  1. Upload fotka
  2. F5 (Refresh)
Expected:
  ✅ Fotka ostane viditeľná
  ✅ photo_url sa zapamatá
```

### Test 6: Validácia veľkosti
```
Status: ⏳ PENDING
Steps:
  1. Pokúsiť upload 10MB+ súbor
Expected:
  ✅ Error: "Fotka je príliš veľká (max 5MB)"
```

### Test 7: Validácia typu
```
Status: ⏳ PENDING
Steps:
  1. Pokúsiť upload .pdf/.txt/.doc
Expected:
  ✅ Error: "Povolené sú iba obrázky"
```

---

## 🎯 MANUÁLNY TEST SCENÁR

### Scenár 1: Kompletný workflow
```
[ ] 1. Otvorím Voľby → Edit
[ ] 2. Expandnem kandidáta na starostu
[ ] 3. Kliknúť "Vložiť fotku"
[ ] 4. Vybrať fotku z počítača
[ ] 5. Vidím fotku v preview
[ ] 6. Kliknúť "Uložiť zmeny"
[ ] 7. Vidím "Success" notifikáciu
[ ] 8. Zavriem modal
[ ] 9. Refresh (F5)
[ ] 10. Vidím CandidateCard s fotkou
[ ] 11. Kliknúť Detail
[ ] 12. Vidím fotku v CandidateModal
[ ] 13. Zavriem modal
[ ] 14. Voľby → Edit
[ ] 15. Expandnem kandidáta
[ ] 16. Kliknúť X na fotke
[ ] 17. Vidím User ikonu
[ ] 18. Kliknúť Uložiť zmeny
[ ] 19. Refresh (F5)
[ ] 20. CandidateCard bez fotky

✅ PASSED: Kompletný workflow OK
```

---

## 📊 EXPECTED RESULTS

| Test | Expected | Status |
|------|----------|--------|
| Upload fotky | Fotka sa nahrá a zobrazí | ⏳ |
| Zobrazenie | CandidateCard + Modal | ⏳ |
| Remove fotka | photo_url=null | ⏳ |
| Delete kandidáta | is_active=false | ⏳ |
| Refresh | Fotka ostane | ⏳ |
| Max size (5MB) | Error message | ⏳ |
| Type validation | Error message | ⏳ |

---

## 🐛 KNOWN ISSUES

- [ ] Žiadne známe problémy (zatiaľ)

---

## 📝 NOTES

- Max file size: 5MB
- Allowed types: JPEG, PNG, WebP
- Storage bucket: elections
- Path: candidates/{candidateId}-{timestamp}-{filename}
- Soft delete: photo_url=null

---

## ✨ FINAL CHECKLIST

```
[ ] Build kompajluje bez chýb
[ ] Dev server beží
[ ] Upload fotky funguje
[ ] Zobrazenie fotky OK
[ ] Remove fotka OK
[ ] Delete kandidáta OK
[ ] Refresh pamätá fotky
[ ] Validácia funguje
[ ] ✅ READY FOR PRODUCTION
```

---

**Status**: Ready for Manual Testing  
**Build**: ✅ SUCCESS  
**Expected Time**: ~10 minút na testing
