# 🧪 TESTOVACIA PRÍRUČKA - EDIT A DELETE PRÍSPEVKOV

**Dátum:** 2026-09-10  
**Status:** ✅ Hotovo na otestovanie  

---

## ⚡ RÝCHLY START

### Test 1: Úradník upravuje príspevok (✅ Najdôležitejší)

```
1. Prihlásiť sa ako úradník
   - Email: uradnik@komunita.sk (prípadne iný úradník účet)
   - Rola: Starosta alebo Uradnik

2. Prejsť na "📢 Obecný hlásnik"

3. Vytvoriť nový príspevek:
   - Kliknúť "Pridať úradný oznam"
   - Napísať text
   - Kliknúť "Zverejniť"

4. Otvoriť príspevek (kliknúť naň)
   ↓
   Lightbox sa otvorí

5. Visiť tlačidlá v spodnej časti:
   ✅ Tlačidlo "Upraviť" (s ceruzkou)
   ✅ Tlačidlo "Zmazať" (červené, s košom)
   ✅ Tlačidlo "Nahlásiť" (s vlajkou)

6. Kliknúť "Upraviť"
   ↓
   Modal na úpravu sa otvorí

7. Zmeniť text
   ↓
   Kliknúť "Uložiť"

8. ✅ VÝSLEDOK:
   - Príspevek by sa mal aktualizovať
   - Lightbox by sa mal zatvoriť
   - Zmeny by mali byť viditeľné v zozname

⏰ Čas testu: ~2 minúty
```

### Test 2: Úradník maže príspevek

```
1. Postupovať ako v Test 1 (kroky 1-4)

2. Kliknúť tlačidlo "Zmazať" (červeň)

3. Potvrdiť "Naozaj vymazať?" = OK

4. ✅ VÝSLEDOK:
   - Príspevek by sa mal zmazať
   - Zoznam by sa mal aktualizovať
   - Príspevek by nemal byť viditeľný

⏰ Čas testu: ~1 minúta
```

### Test 3: Sused nevidí tlačidlá na príspevku iného

```
1. Prihlásiť sa ako sused (nie úradník)
   - Mať platný invite code
   - Rola: Sused

2. Prejsť na "🏘️ Susedský život"

3. Otvoriť príspevek vytvorený iným susedom
   ↓
   Lightbox sa otvorí

4. Skontrolovať spodné tlačidlá:
   ✅ Tlačidlo "Lajk" - viditeľné
   ✅ Tlačidlo "Nahlásiť" - viditeľné
   ❌ Tlačidlo "Upraviť" - NEMAL BY AŽ BYŤ
   ❌ Tlačidlo "Zmazať" - NEMAL BY AŽ BYŤ

5. ✅ VÝSLEDOK:
   - Tlačidlá "Upraviť" a "Zmazať" by mali byť SKRYTÉ
   - Len lajk a hlásenie má byť viditeľné

⏰ Čas testu: ~1 minúta
```

### Test 4: Sused vidi tlačidlá na svojom príspevku

```
1. Prihlásiť sa ako sused

2. Vytvoriť príspevek v "🏘️ Susedský život":
   - Kliknúť "Príspevok"
   - Napísať text
   - Kliknúť "Zverejniť"

3. Otvoriť svoj príspevek

4. Skontrolovať tlačidlá:
   ✅ Tlačidlo "Upraviť" - MAL BY AŽ BYŤ
   ✅ Tlačidlo "Zmazať" - MAL BY AŽ BYŤ

5. Kliknúť "Upraviť"
   ↓
   Modal sa otvorí

6. Zmeniť text a uložiť
   ↓
   ✅ Zmeny sa majú uložiť

⏰ Čas testu: ~3 minúty
```

---

## 🎯 VÝSLEDKY

| Test | Scenár | Očakávaný Výsledok | Status |
|------|--------|-------------------|--------|
| 1 | Úradník upravuje | Príspevek sa aktualizuje | ⏳ Čaká |
| 2 | Úradník maže | Príspevek sa odstráni | ⏳ Čaká |
| 3 | Sused nevidí tlačidlá na cudejom príspevku | Tlačidlá sú SKRYTÉ | ⏳ Čaká |
| 4 | Sused vidí tlačidlá na svojom príspevku | Tlačidlá sú VIDITEĽNÉ | ⏳ Čaká |

---

## 🔍 ČECHY - AKO OVERIŤ KÓD

### V Developer Tools (DevTools)

**1. Otvoriť Network tab**
```
F12 → Network → Filter: "posts"
```

**2. Kliknúť "Upraviť"**
```
Mal by sa vidieť PATCH/PUT request na /posts
Status: 200 OK
```

**3. Kliknúť "Zmazať"**
```
Mal by sa vidieť DELETE request na /posts
Status: 200 OK
```

**4. Skontrolovať Console na chyby**
```
F12 → Console
Nemali by tam byť žiadne červené chyby (error)
```

---

## 📊 ZOZNAM PRÍSPEVKOV

### Kde sa ukážu príspevky?

| Sekcia | Typ | Kto môže vidieť | Kto môže upravovať |
|--------|-----|-----------------|-------------------|
| 📢 Obecný hlásnik | `hlasnik` | Všetci | Len autor (úradník) |
| 🏘️ Susedský život | `susedsky_zivot` | Všetci | Len autor (sused) |

---

## 🐛 MOŽNÉ PROBLÉMY A RIEŠENIA

### Problém: Tlačidlá "Upraviť" a "Zmazať" sú SKRYTÉ

**Príčiny:**
1. ❌ Nie si autor príspevku
2. ❌ Nemáš platný invite code (nie si active neighbor)
3. ❌ Nie si prihlásený (auth.uid() je NULL)

**Riešenie:**
- Otvoriť príspevek vytvorený TEBOU (nie niekým iným)
- Mať aktívne "active_neighbor" v profile
- Byť prihlásený

### Problém: Po kliknutí na "Upraviť" sa nič nedialo

**Príčiny:**
1. ❌ Chyba v EditPostModal komponente
2. ❌ Chyba pri UPDATE query v Supabase
3. ❌ RLS politika zablokovala update

**Riešenie:**
- Otvoriť DevTools → Console
- Skontrolovať chybové správy
- Kliknúť na Network tab a pozrieť si response

### Problém: "Nepodarilo sa upraviť príspevek"

**To znamená:**
- Supabase RLS politika zablokovala zmenu
- Príčina: Nie si autor príspevku ALEBO nemáš `is_active_neighbor=true`

**Riešenie:**
- Kliknúť len na svoj príspevek
- Overovať, že máš invite code

---

## 📋 CHECKLIST PRE TESTEROV

- [ ] Test 1 prešiel - Úradník može upravovať príspevek
- [ ] Test 2 prešiel - Úradník može zmazať príspevek
- [ ] Test 3 prešiel - Sused nevidí tlačidlá na cudejom príspevku
- [ ] Test 4 prešiel - Sused vidí tlačidlá na svojom príspevku
- [ ] DevTools Network ukazuje spávne requesty
- [ ] Console neobsahuje chyby
- [ ] Zmeny sa ukladajú korektne
- [ ] Lightbox sa zatvára po akcii
- [ ] Zoznam príspevkov sa aktualizuje

---

## 📞 AKO HLÁSIT CHYBU

Ak test NEPREŠIEL, prosím:

1. **Skríň képi obrazovky**
   ```
   Shift + Windows + S (Windows)
   Command + Shift + 4 (Mac)
   ```

2. **Otvoriť DevTools** a skopírovať chybu:
   ```
   F12 → Console → Pravý klik na chybu → Copy message
   ```

3. **Napísať správu s:**
   - Ktorý test neprešiel (Test 1, 2, 3, alebo 4)
   - Čo sa stalo (oproti očakávanému výsledku)
   - Screenshot
   - Chybu z Console
   - Vašu rolu (sused/úradník)

---

**Testovanie hotové! ✅**
