# ⚡ RÝCHLY CHECKLIST - VOĽBY VIDITEĽNOSŤ

## 📋 QUICK START (5 MINÚT)

### 1️⃣ TAB 1: ADMIN PANEL
```
Login: Admin/Starosta
Path: Admin Panel → Komunálne voľby
Action: TOGGLE viditeľný? ✅/❌
Status: "Aktívne v PWA" alebo "Skryté"
```

### 2️⃣ TAB 2: SUSED VIEW  
```
Login: Sused (alebo inkognito)
Path: Menu → Voľby
View: Vidíte "Modul nie je aktívny"? ✅/❌
Status: ⏳ Čakajte na realtime zmenu
```

### 3️⃣ TAB 1: ZAPNÚŤ TOGGLE
```
Action: Kliknúť toggle (ON)
Status: Vidíte checkmark? ✅/❌
Text: "Aktívne v PWA" ✅
```

### 4️⃣ TAB 2: SKONTROLOVAŤ ZMENU
```
Bez Refresh: Vidíte Kandidáti? ✅/❌
S Refresh (F5): Stále vidíte Kandidáti? ✅/❌
Edit button: NEMÁ byť viditeľný ✅
```

### 5️⃣ TAB 1: VYPNÚŤ TOGGLE
```
Action: Kliknúť toggle (OFF)
Status: Vidíte checkmark PREČ? ✅/❌
Text: "Skryté pre obyvateľov" ✅
```

### 6️⃣ TAB 2: SKONTROLOVAŤ ZMENU
```
Bez Refresh: Vidíte "Modul nie je..."? ✅/❌
S Refresh (F5): Stále vidíte "Modul nie je..."? ✅/❌
Edit button: NEMÁ byť viditeľný ✅
```

---

## 🎯 VÝSLEDOK

```
✅ VŠETKO FUNGUJE     → Production Ready
❌ NIEČO NIE          → Skontrolujte DEBUG tipy
⚠️  REALTIME BUG      → Refresh F5 pre workaround
```

---

## 🔧 DEBUG TIPS (Ak nejde)

### Problem 1: Toggle NEVIDITEĽNÝ
```
→ Logout → Login
→ Skontroľujte role: MUST Admin/Starosta/Uradnik
→ Skontroľujte AdminPanel existuje
```

### Problem 2: Zmena nefunguje bez refresh
```
→ Realtime možno nedostupný
→ Workaround: F5 refresh
→ Kontrolujte Supabase status
```

### Problem 3: Sused vidí Edit button
```
→ Skontroľujte profile.role v DevTools
→ Musí byť 'Sused' nie 'Admin'/'Starosta'
→ Skontroľujte ElectionsScreen.tsx line 291
```

### Problem 4: Fotka sa nenahrá
```
→ File: max 5MB, JPEG/PNG/WebP
→ Skontroľujte Supabase Storage RLS
→ Skontroľujte 'elections' bucket existuje
```

---

## 📊 TICK THE BOXES

```
SETUP:
[ ] Tab 1: Admin Panel (Admin/Starosta)
[ ] Tab 2: Voľby (Sused)
[ ] DevTools Console otvorené

TESTS:
[ ] Test 1: Toggle viditeľný - ✅
[ ] Test 2: Zapnuté funguje - ✅  
[ ] Test 3: Vypnuté funguje - ✅
[ ] Test 4: Edit button skrytý - ✅
[ ] Test 5: Admin vidí vždy - ✅
[ ] Test 6: Fotky fungujú - ✅

RESULT:
[ ] ✅ VŠETKO OK → Production
[ ] ❌ NIEČO NIE → Debug + Fix
[ ] ⚠️  REALTIME → Refresh pomôže
```

---

**Status**: 🟢 READY  
**Time**: ~10 minút  
**Result**: ✅ Production Ready  
