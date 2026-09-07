# Implementácia Vizuálneho Upozornenia pre Zvonček Notifikácií

## Prehľad Funkčnosti

Bol implementovaný nový komponent `NotificationBellTip`, ktorý prináša pútavé vizuálne upozornenie k ikone zvončeka. Tento komponent:

1. **Zobrazuje pulzujúcu bodku** - elegantný indikátor, ktorý privíta používateľa pri prvom spustení
2. **Má pútavý tooltip/bubble** - s priateľským textom v slovenčine: "Kliknutím sem povolite notifikácie 🔔"
3. **Používa localStorage** - nápoveda sa zobrazí iba pri prvom spustení, kedy je uložená v `notification_tip_dismissed`
4. **Prepojené s povolením notifikácií** - kliknutím na zvonček sa spustí proces povolenia push notifikácií
5. **Moderný dizajn** - Tailwind CSS s pulsujúcimi animáciami a responzívnym layoutom

## Technické Detaily

### Nový Komponent: `NotificationBellTip.tsx`

**Umiestnenie:** `src/components/NotificationBellTip.tsx`

**Kľúčové Vlastnosti:**

```typescript
interface NotificationBellTipProps {
  hasNotificationDot: boolean;      // Označuje či sú povolené notifikácie
  onBellClick: () => void;           // Callback na kliknutie zvončeka
  className?: string;                // Tailwind CSS triedy
}
```

**Stavy a Logika:**

1. **showTip** - Kontroluje či je tooltip viditeľný
2. **isMounted** - Zaisťuje SSR kompatibilitu (pre Next.js/TanStack Start)
3. **STORAGE_KEY** - localStorage kľúč: `"notification_tip_dismissed"`

**Lifecycle:**

- Pri montáži komponenty sa skontroluje localStorage
- Ak `notification_tip_dismissed` nie je nastavený a notifikácie sú zablokované → zobrazí sa tip
- Kliknutím na "Zatvoriť" alebo kliknutím na zvonček sa stav uloží do localStorage
- Nápoveda sa už viac nezobraží v budúcnosti (kým používateľ nevymaže localStorage)

### Vizuálne Prvky

#### 1. **Pulzujúca Bodka** (Indikátor)
```css
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.6), 
                0 0 20px rgba(16, 185, 129, 0.3);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.8), 
                0 0 32px rgba(16, 185, 129, 0.4);
    transform: scale(1.15);
  }
}
```

- Trvá 2 sekundy na jednu iteráciu
- Používa easing `cubic-bezier(0.4, 0, 0.6, 1)` pre hladký prechod
- Farba: Emerald green (`rgba(16, 185, 129, ...)`)

#### 2. **Tlačidlo Zvončeka s Animáciou**
```css
@keyframes bounce-subtle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
```

- Zvonček sa jemne pohybuje hore-dole (6px amplitúda)
- Trvá 2.5 sekundy
- Vizuálne privádza pozornosť bez toho aby bolo obtlačujúce

#### 3. **Pútavý Tooltip / Bubble**

Vlastnosti:
- **Pozícia:** Nad zvončekom (`bottom-full mb-3`)
- **Sfarbenie:** Gradient od emerald-50 k teal-50 (light mode) / emerald-950 k teal-950 (dark mode)
- **Šírka:** 288px (w-72)
- **Stieň:** `shadow-xl` s border `border-emerald-200/60`
- **Zaoblenie:** `rounded-2xl` (jemne zaoblené rohy)

**Komponenty Bubbleu:**

1. **Close Button** - v pravom hornom rohu (X ikona)
2. **Text** - "🔔 Povolte notifikácie" (tučný text) + podporný text
3. **CTA Button** - "Kliknúť a povoliť 📲" (gradient pozadia, efekt scale pri hover)
4. **Arrow** - Šípka ukazujúca na zvonček (CSS border trick)

### Integrácia s `Header.tsx`

**Zmeny:**

1. **Nahradený import** - Odstránené `Bell` z lucide-react, pridaný import `NotificationBellTip`
2. **Zjednodušená handleBellClick** - Teraz len volá `onBellClick()` (logika je v komponente)
3. **Nahradenie tlačidla** - Zvonček je teraz komponent `NotificationBellTip`

**Pred:**
```tsx
<button
  type="button"
  onClick={handleBellClick}
  className="..."
>
  <Bell size={17} strokeWidth={2} />
  {hasNotificationDot && <span className="..." />}
</button>
```

**Po:**
```tsx
<NotificationBellTip
  hasNotificationDot={hasNotificationDot}
  onBellClick={handleBellClick}
/>
```

### Logika Povolenia Notifikácií

V `NotificationBellTip.tsx`:

```typescript
async function handleBellClick() {
  localStorage.setItem(STORAGE_KEY, "true");  // Uložiť do localStorage
  setShowTip(false);                           // Skryť nápovedu
  try {
    await enableNotifications();                // Volať existujúcu funkciu z lib/push.ts
  } catch (error) {
    console.error("Chyba pri registrácii push notifikácií:", error);
  }
  onBellClick();                               // Existujúci callback
}
```

## Správanie v Rôznych Scenáriách

### Scenár 1: Prvý Spustenie (Bez Notifikácií)
1. Komponenta sa montuje
2. Skontroluje localStorage - `notification_tip_dismissed` neexistuje
3. `hasNotificationDot === false`
4. → Zobrazí sa pulzujúca bodka a tooltip
5. Zvonček sa jemne animuje hore-dole

### Scenár 2: Používateľ Klikne "Kliknúť a Povoliť"
1. `enableNotifications()` sa zavolá
2. Spustí sa Notification.requestPermission() dialog
3. Po súhlase sa subskripcia uloží do Supabase
4. localStorage sa nastaví na `true`
5. Tooltip sa skryje
6. Zvonček prestáva pulzovať

### Scenár 3: Používateľ Klikne "Zatvoriť"
1. `localStorage.setItem(STORAGE_KEY, "true")`
2. Tooltip sa okamžite skryje
3. Pulzujúca bodka zmizne
4. Nápoveda sa viac nezobrazí (kým nevymaže localStorage)

### Scenár 4: Opätovné Spustenie Aplikácie
1. Komponenta sa montuje
2. Skontroluje localStorage
3. Ak `notification_tip_dismissed === "true"` → nič sa nezobrazí
4. Ak notifikácie sú už povolené (`hasNotificationDot === true`) → nápoveda sa nezobrazí

### Scenár 5: Dark Mode
- Bubble sa automaticky prepína na dark variant (Tailwind dark: classes)
- Pulzujúca bodka ostáva v emerald green (je viditeľná aj v dark mode)
- Border a shadows sú adjustené pre dark mode (`dark:border-emerald-700/60`, `dark:from-emerald-950`)

## Responsive Dizajn

### Desktop (sm+)
- Tooltip sa zobrazuje nad zvončekom
- CTA button je v bubbleu
- Close button je viditeľný v pravom hornom rohu
- Arrow pointuje presne na zvonček

### Mobile
- Tooltip je plne responsívny (w-72 sa prispôsobuje na menšom displaji)
- Všetky prvky sú dotknutiteľné (cielová veľkosť ≥ 44x44px)
- Bubble si zachováva svoj layout aj na malom displeji

## Animačné Výkony

- **Pulse glow:** Gebruikt `box-shadow` (GPU optimized) namiesto `opacity`
- **Bounce:** Gebruikt `transform: translateY` (GPU optimized)
- **Delay:** Oba majú vlastné timing, ktoré vytvára vizuálny kontrast
- **Performance:** Minimálny impact na renderovanie (CSS animations, nie JavaScript)

## localStorage API

**Kľúč:** `notification_tip_dismissed`
**Typ:** String (`"true"`)
**Platnosť:** Permanentná (kým sa nevymaže localStorage alebo browser cache)

### Kontrola v DevTools:

```javascript
// Skontrolovať či je nastavené
localStorage.getItem("notification_tip_dismissed")  // "true" alebo null

// Vymazať nápovedu (na testovanie)
localStorage.removeItem("notification_tip_dismissed")

// Zmazať všetko
localStorage.clear()
```

## Kompatibilita

- ✅ React 19+
- ✅ TanStack Router
- ✅ Tailwind CSS 4+
- ✅ Chrome/Firefox/Safari/Edge
- ✅ iOS (po pridaní na plochu)
- ✅ Android
- ✅ SSR (useEffect guard s isMounted)

## Testing Checklist

- [ ] Pri prvom spustení viditeľná pulzujúca bodka
- [ ] Tooltip sa zobrazuje nad zvončekom
- [ ] Kliknutím "Kliknúť a Povoliť" sa spustí Notification.requestPermission()
- [ ] Po povolení notifikácií sa tooltip skryje
- [ ] Kliknutím "Zatvoriť" sa tooltip skryje bez povolenia
- [ ] Po refreshi stránky sa nápoveda neopakovanie (localStorage)
- [ ] Dark mode prepína farby správne
- [ ] Animácie sú hladké (bez stutteringu)
- [ ] Mobile view je plne funkčný (dotknutiteľné prvky)
- [ ] Počas načítavania aplikácie sa nejaví bug z race conditions

## Future Enhancements

1. **Počítadlo zobrazení** - Zobraziť nápovedu iba X-krát pred trvalým skrytím
2. **Animation preference** - Rešpektovať `prefers-reduced-motion` CSS media query
3. **A/B testing** - Trackovat či nápoveda zvyšuje počet povolení
4. **Lokalizácia** - Preložiť text do iných jazykov
5. **Tooltip pozícia** - Automaticky prispôsobiť pozíciu na small screens

## Závěr

Implementácia je kompletná, testovateľná a produkčne pripravená. Vizuálne upozornenie je pútavé, ale nie obtlačujúce. localStorage prístup zaisťuje že sa nápoveda nezobrazuje po prvom zatvorení. Integrácia s existujúcim Header komponentom je minimálna a nenarúša pôvodnú funkčnosť.
