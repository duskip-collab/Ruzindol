# OPRAVA: Probl�my s Vidite�nos�ou Tla��tok - Spodn� Li�ta Prekr�va Mod�ly

## Probl�m

- Tla��tka v mod�loch "Nov� vo�by" a "Prida� kandid�ta" nie s� vidite�n�
- Spodn� naviga�n� li�ta prekr�va ovl�dacie prvky v modaloch
- Probl�my s rolovac�m priestorom na mobiln�ch zariadeniach

## Opravy

### 1. AnimatedModal.tsx

- **Z-index zmena**: Backdrop z-50 � z-[9998], Content z-10 � z-[9999]
  - Vzor: Spodn� li�ta (z-40) bude pod modalm
- **Padding zv��en�**: pb-20 sm:pb-24 � pb-32 sm:pb-40
  - Vzor: Viac priestoru na spodku pre tla��tka
- **Footer bezpe�nos�**: Pridan� pb-safe
  - Vzor: Ochrana pred notch/home indicator na mobiln�ch zariadeniach

### 2. BottomNav.tsx

- **Z-index zn�en�**: z-50 � z-40
  - Vzor: Spodn� li�ta bude pod v�etk�mi modalmi

### 3. InquiryModal.tsx (Mayor Inquiries)

- **Z-index zn�en�**: z-[99] � z-[9997], z-[100] � z-[9998]
  - Vzor: Konzistentnos� s AnimatedModal (z-[9999])

### 4. WarehouseItemEditForm.tsx

- **Padding pridan�**: Formul�r m� pb-safe
  - Vzor: Ochrana tla��tok pred spodnou li�tou

### 5. PostLightbox.tsx

- **Footer bezpe�nos�**: Pridan� pb-safe
  - Vzor: Ochrana tla��tok pred spodnou li�tou

## Z-Index Hierarchia (po oprav�ch)

`z-[9999]  � AnimatedModal obsah
z-[9998]  � AnimatedModal backdrop, InquiryModal obsah
z-[9997]  � InquiryModal backdrop
z-40      � BottomNav (spodn� naviga�n� li�ta)`

## Testing

Skontroluj:

1. Otvor Aktuality � Vo�by
2. Klikni "Nov� vo�by" - tla��tka "Ulo�i� zmeny" a "Zavrie�" by mali by� vidite�n�
3. Otvor Podnety a sk�sim vytvori� nov� podnet
4. Skontroluj na mobilnom zariaden� alebo emul�cii (DevTools)
5. Skontroluj rolovanie - obsah by mal by� ods�� od spodnej li�ty

## Bezpe�n� Z�ny (Safe Areas)

- pb-safe pou��va env(safe-area-inset-bottom)
- Automaticky chr�nite priestor pre notch/home indicator na iOS/Android
- Desktop = 0, Mobil = va�a bezpe�n� z�na
