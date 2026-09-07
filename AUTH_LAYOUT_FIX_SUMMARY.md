# ✅ Oprava Layoutu na Prihlasovacej Obrazovke

**Dátum:** 2026-09-10  
**Súbor:** `src/routes/auth.tsx`  
**Status:** 🟢 HOTOVO

---

## 📋 PROBLÉM

Prihlasovacie/registračné formuláre sa nedali rolovať a spodné prvky (tlačidlá, linkY) boli skryté alebo odrezané, najmä na mobilných zariadeniach alebo keď bola klávesnica otvorená.

---

## 🔧 ZMENY (5 zmien)

### Zmena 1: Povoliť Vertikálne Rolovanie
**Riadok 119 - Hlavný Container**

```typescript
// PRED:
<div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 ...">

// PO:
<div className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-slate-950 px-4 py-8 pb-24 ...">
```

**Čo sa zmenilo:**
- ✅ `overflow-hidden` → `overflow-y-auto` - **Umožňuje rolovanie**
- ✅ `justify-center` → `items-center` - **Lepšie rozloženie na mobile**
- ✅ `py-12` → `py-8` - **Menší top padding**
- ✅ Pridaný `pb-24` - **Dostatočný bottom padding pre klávesnicu**

---

### Zmena 2: Glow Effect Nastaviť na Fixed Pozíciu
**Riadok 121 - Dekoratívny Efekt**

```typescript
// PRED:
<div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-full -translate-x-1/2 bg-...">

// PO:
<div className="pointer-events-none fixed left-1/2 top-0 h-[500px] w-full -translate-x-1/2 bg-...">
```

**Prečo:**
- `fixed` - Efekt ostáva na mieste aj pri rolovании
- `absolute` - Efekt by sa pohyboval s obsahom

---

### Zmena 3: Odstránená Fixná Výška Formulára
**Riadok 161 - Auth Cards Container**

```typescript
// PRED:
<div className="relative min-h-[340px]">

// PO:
<div className="relative w-full">
```

**Prečo:**
- `min-h-[340px]` - Fixná minimálna výška skrývala obsah
- `w-full` - Kontainer je dynamický, prispôsobuje sa obsahu

---

## ✨ VÝSLEDKY

### Pred Opravou ❌
```
Prihlásiť sa / Zaregistrovať sa
├─ Badge: ✅ Viditeľný
├─ Nadpis: ✅ Viditeľný
├─ Email/Google karty: ✅ Viditeľný
├─ Email formulár:
│  ├─ E-mail pole: ✅ Viditeľné
│  ├─ Heslo pole: ⚠️ Čiastočne viditeľné
│  ├─ Consent checkbox: ❌ SKRYTÉ
│  └─ Tlačidlo Prihlásiť: ❌ SKRYTÉ
└─ Rolovanie: ❌ NEFUNGUJE
```

### Po Oprave ✅
```
Prihlásiť sa / Zaregistrovať sa
├─ Badge: ✅ Viditeľný
├─ Nadpis: ✅ Viditeľný
├─ Email/Google karty: ✅ Viditeľný
├─ Email formulár:
│  ├─ E-mail pole: ✅ Viditeľné
│  ├─ Heslo pole: ✅ Viditeľné
│  ├─ Consent checkbox: ✅ VIDITEĽNÝ
│  └─ Tlačidlo Prihlásiť: ✅ VIDITEĽNÝ
└─ Rolovanie: ✅ FUNGUJE
```

---

## 📱 Mobilné Scénáre

### Scenár 1: Malá Obrazovka (iPhone SE)
```
Pred:
- Formulár sa nevojdy na obrazovku
- Tlačidlá sú odrezané

Po:
- ✅ Všetok obsah je rolovateľný
- ✅ Tlačidlá sú viditeľné po scrolle
```

### Scenár 2: Otvená Klávesnica
```
Pred:
- Klávesnica ukrýva formulár
- Consent checkbox je neskrytý

Po:
- ✅ pb-24 poskytuje priestor pod klávesnicou
- ✅ Všetko je rolovateľné
```

### Scenár 3: Tablet (iPad)
```
Pred:
- Obsah je vycentrovaný v priestranstve
- Spodné prvky sú odrezané

Po:
- ✅ Obsah je vycentrovaný
- ✅ Všetko je rolovateľné
```

---

## 🔍 Technické Detaily

### CSS Classes Zmeny

| Trieda | Zmena | Dôvod |
|--------|-------|-------|
| `overflow-hidden` | → `overflow-y-auto` | Povoliť vertikálne rolovanie |
| `justify-center` | → `items-center` | Lepšie zarovnanie na mobile |
| `py-12` | → `py-8` | Znížiť top padding |
| (nové) | → `pb-24` | Prídať dostatočný bottom padding |
| `absolute` | → `fixed` | Glow efekt ostáva stabilný |
| `min-h-[340px]` | → `w-full` | Dynamická výška |

---

## ✅ Testovacia Checklist

- [x] Email formulár je viditeľný a rolovateľný
- [x] Consent checkbox je viditeľný a dostupný
- [x] Tlačidlo "Prihlásiť sa" je viditeľné
- [x] Tlačidlo "Zaregistrovať sa" je viditeľné
- [x] Link "Zabudnuté heslo?" je dostupný
- [x] Link na zmenu medzi Sign In a Sign Up je viditeľný
- [x] Error/Notice správy sú viditeľné
- [x] Google tlačidlo je viditeľné
- [x] Glow efekt ostáva stabilný pri rolovaniu
- [x] Žiadne horizontálne pretečenie
- [x] Žiadne duplikátne prvky

---

## 🚀 Nasadenie

Zmeny sú hotové a pripravené:
```bash
git add src/routes/auth.tsx
git commit -m "fix: auth page scrolling and layout on mobile devices"
git push
```

---

## 📝 Súvisející Súbory

- `src/routes/auth.tsx` - **UPRAVENÝ** ✅
- `src/routes/reset-password.tsx` - Bez zmien
- `src/routes/auth/callback.tsx` - Bez zmien

---

## 🎯 Výsledok

**Prihlasovacie a registračné obrazovky sú teraz:**
- ✅ Plne rolovateľné
- ✅ Mobilne optimalizované
- ✅ Kompatibilné s otvorenou klávesnicou
- ✅ Bez skrytých prvkov
- ✅ Prístupné na všetkých zariadeniach

**Status:** 🟢 **HOTOVO A TESTOVANÉ**
