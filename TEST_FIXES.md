# TEST: Oprava Problémov so Spodnou Lištou

## Status: ✅ OPRAVENO

### Problém
- Tlačítka v modáloch "Nové voľby" a "Pridať kandidáta" sú prekryté spodnou navigačnou lištou
- Modály sa nekrorovo pozicionujú vzhľadom na spodnú lištu
- Nedostatočný padding pre mobilné zariadenia

### Implementované Riešenia

#### 1. Z-Index Hierarchia
```css
Modal Content:    z-[9999]  ← VRCH
Modal Backdrop:   z-[9998]  ← Pod obsahom
Other Modals:     z-[9997-9998]
Bottom Nav:       z-40      ← DÓL (pod všetkou)
```

#### 2. Padding Odsúv
- **AnimatedModal**: `pb-32 sm:pb-40` (namiesto pb-20 sm:pb-24)
- **InquiryModal**: `pb-28` v obsahu, `pb-safe` v footeri
- **WarehouseItemEditForm**: `pb-safe` v formulári
- **PostLightbox**: `pb-safe` v footeri

#### 3. Safe Area Support
```css
pb-safe → env(safe-area-inset-bottom)
```
- Automatická ochrana pred notch/home indicator
- Desktop: 0px
- iOS: env value (väčšinou 20-34px)
- Android: env value (väčšinou 0px)

### Skontrolované Komponenty

| Komponent | Zmena | Status |
|-----------|-------|--------|
| AnimatedModal | z-index, pb-32 sm:pb-40, pb-safe | ✓ |
| BottomNav | z-40 | ✓ |
| InquiryModal | z-index, pb-safe | ✓ |
| WarehouseItemEditForm | pb-safe | ✓ |
| PostLightbox | pb-safe | ✓ |
| CandidateModal | Používa AnimatedModal | ✓ |
| ElectionsEditModal | Používa AnimatedModal | ✓ |

### Testovacia Procedúra

#### Na Deskope
1. Otvor http://localhost:5174
2. Naviguj: Aktuality → Voľby
3. Klikni "Pridať volby"
4. Overenie:
   - Modal sa otvára do fullscreen modu
   - Tlačítka "Uložiť zmeny" a "Zavrieť" sú viditeľné na dne
   - Môžeš skrolovať obsah
   - Tlačítka nie sú prekryté spodnou lištou

#### Na Mobilnom Zariadení (Emulacia)
1. Otvor Dev Tools (F12)
2. Prepni na mobilný režim (Ctrl+Shift+M)
3. Vyber iPhone 12 (390x844)
4. Postup ako na deskope
5. Overenie:
   - Tlačítka sú dostatočne vzdialené od spodka obrazovky
   - Neexistuje překrytie s navigáciou
   - Safe area je dodržaná

### CSS Selektory na Skontrolovanie

```css
/* Hlavný Modal */
div[role="dialog"] /* z-[9999] */

/* Spodná Lišta */
nav[role="tablist"] /* z-40 */

/* Content s Paddingom */
.overflow-y-auto.pb-32
.overflow-y-auto.pb-safe
```

### Poznámky

- **pb-32**: 128px = 8rem (dostatočné pre väčšinu prípadov)
- **pb-40**: 160px = 10rem (pre väčšie možnosti)
- **pb-safe**: Adaptívny padding pre different devices
- **z-indexy**: Wysokie čísla (9999) zabezpečujú, že modály sú vždy na vrchu

### Očakávaný Rezultát

✓ Všetky tlačítka sú viditeľné
✓ Žiadne prekrytie s spodnou navigáciou
✓ Rolovanie funguje správne
✓ Mobilný viewport je podporovaný
✓ iOS safe areas sú dodržané
