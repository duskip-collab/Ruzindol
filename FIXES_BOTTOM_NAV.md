# OPRAVA: Problémy s Vidite¾nosou Tlaèítok - Spodná Lišta Prekrıva Modály

## Problém
- Tlaèítka v modáloch "Nové vo¾by" a "Prida kandidáta" nie sú vidite¾né
- Spodná navigaèná lišta prekrıva ovládacie prvky v modaloch
- Problémy s rolovacím priestorom na mobilnıch zariadeniach

## Opravy

### 1. AnimatedModal.tsx
- **Z-index zmena**: Backdrop z-50 › z-[9998], Content z-10 › z-[9999]
  - Vzor: Spodná lišta (z-40) bude pod modalm
- **Padding zvıšenı**: pb-20 sm:pb-24 › pb-32 sm:pb-40
  - Vzor: Viac priestoru na spodku pre tlaèítka
- **Footer bezpeènos**: Pridanı pb-safe
  - Vzor: Ochrana pred notch/home indicator na mobilnıch zariadeniach

### 2. BottomNav.tsx
- **Z-index zníenı**: z-50 › z-40
  - Vzor: Spodná lišta bude pod všetkımi modalmi

### 3. InquiryModal.tsx (Mayor Inquiries)
- **Z-index zníenı**: z-[99] › z-[9997], z-[100] › z-[9998]
  - Vzor: Konzistentnos s AnimatedModal (z-[9999])

### 4. WarehouseItemEditForm.tsx
- **Padding pridanı**: Formulár má pb-safe
  - Vzor: Ochrana tlaèítok pred spodnou lištou

### 5. PostLightbox.tsx
- **Footer bezpeènos**: Pridanı pb-safe
  - Vzor: Ochrana tlaèítok pred spodnou lištou

## Z-Index Hierarchia (po opravách)
`
z-[9999]  ‹ AnimatedModal obsah
z-[9998]  ‹ AnimatedModal backdrop, InquiryModal obsah
z-[9997]  ‹ InquiryModal backdrop
z-40      ‹ BottomNav (spodná navigaèná lišta)
`

## Testing
Skontroluj:
1. Otvor Aktuality › Vo¾by
2. Klikni "Nové vo¾by" - tlaèítka "Uloi zmeny" a "Zavrie" by mali by vidite¾né
3. Otvor Podnety a skúsim vytvori novı podnet
4. Skontroluj na mobilnom zariadení alebo emulácii (DevTools)
5. Skontroluj rolovanie - obsah by mal by odsú od spodnej lišty

## Bezpeèné Zóny (Safe Areas)
- pb-safe pouíva env(safe-area-inset-bottom)
- Automaticky chránite priestor pre notch/home indicator na iOS/Android
- Desktop = 0, Mobil = vaša bezpeèná zóna
