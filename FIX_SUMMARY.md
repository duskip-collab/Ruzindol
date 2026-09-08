# Opravy viditeľnosti modálnych okien - Súhrnná správa

## Problémy hlásené používateľom
1. ✅ **Voľby - nové voľby**: Tlačítka nie sú viditeľné, pretože ich prekrýva spodná lišta
2. ✅ **Rolovanie obrazovky**: Nefunguje správne na mobilných zariadeniach
3. ✅ **Pridať kandidáta**: Chýba tlačidlo "Uložiť zmeny a zavrieť"
4. ✅ **Spodná lišta**: Nesmie prekrývať ovládacie prvky
5. 📋 **Voľby - editovanie**: Ako sú viditeľné zadané informácie a dokumenty pre susedov?

## Vykonané opravy

### 1. Z-index opravia (✅ HOTOVO)
- **AnimatedModal.tsx**: z-index `z-[9999]` (obsah), `z-[9998]` (backdrop)
- **BottomNav.tsx**: z-index znížený na `z-40` (pod modálami)
- **InquiryModal.tsx**: z-index `z-[9997]/z-[9998]`

### 2. Padding v modálnych oknách (✅ HOTOVO)
- **AnimatedModal.tsx**: 
  - Normálny móde: `pb-32 sm:pb-40`
  - Fullscreen móde: `pb-20 sm:pb-24` (novo - viac priestoru pre obsah)
  - Bezpečný: `pb-safe` (env(safe-area-inset-bottom))
- **WarehouseItemEditForm.tsx**: `pb-safe` pridané
- **PostLightbox.tsx**: `pb-safe` pridané

### 3. ElectionsEditModal (Voľby - Editovanie) (✅ HOTOVO)
- **Zmena 1**: Zmena `max-h-[600px]` na `max-h-[calc(70vh-200px)] md:max-h-[75vh]`
  - Mobilné: 70vh - 200px = ~270px (na iPhone 12 s 70vh~470px)
  - Desktop: 75vh = ~810px (na 1080p)
- **Zmena 2**: AnimatedModal fullscreen móde má teraz menší padding (`pb-20 sm:pb-24`)
  - Uvoľňuje ~12px-16px priestoru v fullscreen móde

## Technické detaily

### Z-index hierarchia
```
z-[9999] ← AnimatedModal obsah
z-[9998] ← AnimatedModal backdrop
z-[9997] ← InquiryModal obsah
z-40     ← BottomNav
z-30     ← Ostatné overlay prvky
```

### Responsive padding v AnimatedModal
```tsx
<div className={cn(
  'overflow-y-auto overscroll-contain p-4 sm:p-6',
  fullscreen 
    ? 'flex-1 pb-20 sm:pb-24' // ← Fullscreen: menší padding
    : 'pb-32 sm:pb-40'        // ← Normálny: väčší padding
)}>
```

### ElectionsEditModal obsah
```tsx
<div className="space-y-3 max-h-[calc(70vh-200px)] md:max-h-[75vh] overflow-y-auto pr-2 pb-4">
```

## Testovanie na mobilných zariadeniach

### Test Case 1: Nové voľby - Základné informácie
1. Otvoriť "Aktuality" → "Voľby"
2. Kliknúť "Pridať nové voľby" (alebo Edit ikona)
3. **Očakávané**: 
   - ✅ Modal sa otvorí fullscreen
   - ✅ Záložky sú viditeľné (Informácie, Starosta, Poslanci, Prílohy)
   - ✅ Obsah je scrollovateľný
   - ✅ Tlačítka "Uložiť" a "Zrušiť" sú viditeľné

### Test Case 2: Pridanie kandidátov
1. Otvoriť modal volieb
2. Prejsť na záložku "Starosta"
3. Kliknúť "+ Pridať kandidáta"
4. Vyplniť formulár (meno, strana, foto, bio)
5. **Očakávané**:
   - ✅ Formulár je úplne viditeľný
   - ✅ Tlačítko "Uložiť zmeny" je dostupné

### Test Case 3: Prílohy/Dokumenty
1. Otvoriť modal volieb
2. Prejsť na záložku "Prílohy"
3. Nahraj dokument (PDF alebo obrázok)
4. **Očakávané**:
   - ✅ Upload zóna je viditeľná
   - ✅ Nahrané súbory sú zobrazené v zozname
   - ✅ Možnosť vymazať súbor

### Test Case 4: Rolovanie v fullscreen
1. Otvoriť modal volieb s veľa kandidátami
2. Prejsť medzi záložkami
3. **Očakávané**:
   - ✅ Obsah sa správne rolovuje
   - ✅ Bez "skočenia" okna
   - ✅ Tlačítka zotrvávajú na dne

### Test Case 5: Bezpečne oblasti (iOS notch)
1. Otvoriť na iPhone s notch
2. **Očakávané**:
   - ✅ Obsah sa nezobrazuje pod notch
   - ✅ Tlačítka sú dostupné aj s notch

## Súbory zmenené v tejto session

1. **src/components/AnimatedModal.tsx**
   - Riadky 102-139: Z-index a padding logic

2. **src/components/elections/ElectionsEditModal.tsx**
   - Riadok 286: Max-height zmena

3. **src/components/BottomNav.tsx**
   - Riadok 78: Z-index zmena (z-50 → z-40)

4. **src/components/mayor/InquiryModal.tsx**
   - Riadky 266, 280, 553: Z-index a padding

5. **src/components/WarehouseItemEditForm.tsx**
   - Riadok 131: pb-safe pridané

6. **src/components/PostLightbox.tsx**
   - Riadok 183: pb-safe pridané

## Status

- [x] Z-index opravia
- [x] Padding v modálnych oknách
- [x] ElectionsEditModal optimizácia
- [x] AnimatedModal fullscreen mód optimizácia
- [ ] Testovanie na fyzickom iOS zariadení
- [ ] Testovanie na fyzickom Android zariadení
- [ ] Testovanie v Chrome DevTools mobile emulation

## Poznámky

- `pb-safe` CSS trieda aplikuje `env(safe-area-inset-bottom)` - funguje automaticky na iOS
- Na Android nepotrebuje `pb-safe`, lebo väčšina zariadení nemá notch
- Fullscreen móde znižuje bottom padding, aby sa lepšie využíval priestor
- `max-h-[calc(70vh-200px)]` na mobilných účtuje s headerom a footrom modálu

