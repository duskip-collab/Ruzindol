# Doplnenie Push Notifikácií pre "Susedský Život" a "Obecný Hlásnik"

**Dátum:** 2026-09-10  
**Status:** ✅ Hotové  
**Autorský komentár:** Copilot

---

## 📋 Prehľad zmien

### 1. ✅ Migrácia: `20260910121000_add_neighbor_post_notifications.sql`

**Účel:** Pridať trigger pre notifikácie príspevkov "Susedský život" (susedsky_zivot)

**Funkcia vytvorená:**
```sql
CREATE OR REPLACE FUNCTION public.enqueue_notifications_for_susedsky_zivot_posts()
```

**Logika:**
- Spúšťa sa po INSERT do tabuľky `posts`
- Filtruje len príspevky s typom `susedsky_zivot`
- Vytvára notifikáciu typu `neighbor_post` pre všetkých ostatných profilov v komunite
- Notifikácia obsahuje:
  - **type:** `neighbor_post`
  - **title:** Názov príspevku
  - **body:** Prvých 240 znakov obsahu
  - **ref_id:** ID príspevku
  - **url:** `/nastenka` (odkaz na príspevok)
  - **priority:** `oznam`
  - **is_critical:** `false`

**Trigger vytvorený:**
```sql
CREATE TRIGGER trg_enqueue_notifications_susedsky_zivot_posts
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notifications_for_susedsky_zivot_posts()
```

---

### 2. ✅ Úprava: `supabase/functions/send-push/index.ts`

Táto úprava umožňuje spracovanie nového typu notifikácie `neighbor_post`.

#### 2.1 Funkcia: `resolveTargetUrl()` (riadok 31)

**Staré:**
```typescript
if (type === "official_alert" || type === "hlasnik") return "/nastenka";
```

**Nové:**
```typescript
if (type === "official_alert" || type === "hlasnik" || type === "neighbor_post") return "/nastenka";
```

**Účel:** Mapovať notifikácie `neighbor_post` na `/nastenka` (aby sa notifikácia navigovala na správnu stránku)

---

#### 2.2 Funkcia: `isCommunityBroadcastNotification()` (riadok 45)

**Staré:**
```typescript
return type === "announcement" || type === "official_alert" || type === "group_announcement";
```

**Nové:**
```typescript
return type === "announcement" || type === "official_alert" || type === "group_announcement" || type === "neighbor_post";
```

**Účel:** Klasifikovať `neighbor_post` ako "community broadcast" notifikáciu, čo znamená:
- Push notifikácia sa pošle aj keď sú notifikácie zakázané (ale nie pri kritickej)
- Nastaví sa `requireInteraction: true` (notifikácia ostane viditeľná)
- Urgency v push header sa nastaví na "high"

---

## 🔄 Tok notifikácií

### Prípad 1: Príspevok v "Susedský Život" (susedsky_zivot)

```
1. Používateľ vytvorí príspevok typu "susedsky_zivot"
           ↓
2. INSERT do tabuľky posts
           ↓
3. Trigger: trg_enqueue_notifications_susedsky_zivot_posts
           ↓
4. Vytvoriť notifikácie (typ: neighbor_post) pre všetkých ostatných
           ↓
5. Supabase Realtime webhook → send-push edge function
           ↓
6. send-push spracuje notifikáciu:
   - resolveTargetUrl: neighbor_post → /nastenka
   - isCommunityBroadcastNotification: neighbor_post = true
   - Pošle push notifikáciu
           ↓
7. Užívateľ dostane push notifikáciu na "/nastenka"
```

### Prípad 2: Oznámenie v "Obecný Hlásnik" (hlasnik)

```
1. Starosta/Úradník vytvorí oznam typu "hlasnik"
           ↓
2. INSERT do tabuľky posts
           ↓
3. Trigger: trg_enqueue_notifications_hlasnik_posts (EXISTUJÚCI)
           ↓
4. Vytvoriť notifikácie (typ: official_alert) pre všetkých ostatných
   - Kontroluje prioritu (vystraha, urgentne, oznam)
   - Nastaví is_critical ak je priority "vystraha" alebo "urgentne"
           ↓
5. Supabase Realtime webhook → send-push edge function
           ↓
6. send-push spracuje notifikáciu:
   - resolveTargetUrl: official_alert → /nastenka
   - isCommunityBroadcastNotification: official_alert = true
   - Ak je kritická: vibrácia, zvuk, vysoká urgencia
   - Pošle push notifikáciu
           ↓
7. Užívateľ dostane push notifikáciu na "/nastenka"
```

---

## 🔍 Overenosť bez zmien

### Existujúce notifikácie (NEZMENÉ):

✅ **Announcements (RSS)** - typ: `announcement`
- Trigger: `enqueue_notifications_for_announcements()`
- Status: Bez zmien

✅ **Obecný Hlásnik (hlasnik/official_alert)** - typ: `official_alert`
- Trigger: `enqueue_notifications_for_hlasnik_posts()` (existuje)
- Status: Bez zmien (naďalej funguje)

✅ **Skupinové Oznamy** - typ: `group_announcement`
- Trigger: `enqueue_notifications_for_group_announcements()`
- Status: Bez zmien

✅ **Podnet - Odpoveď (Inquiry Answer)** - typ: `inquiry_answer`
- Trigger: `handle_inquiry_answer_update()`
- Status: Bez zmien

✅ **Push notifikácie** - edge function: `send-push/index.ts`
- Status: Bez zmien (len pridané nové mapovanie)

---

## 🚀 Nasadenie

### Krok 1: Aplikovať migráciu
```
1. Supabase Console > SQL Editor
2. Skopírovať obsah: supabase/migrations/20260910121000_add_neighbor_post_notifications.sql
3. Spustiť
4. Čakať na úspešnú kompiláciu
```

### Krok 2: Deploypnúť zmeny v send-push
```
1. Deploypnúť zmeny v supabase/functions/send-push/index.ts
2. Verifikovať, že edge function sa znovu nasadila
3. Skontrolovať logov Supabase Functions
```

### Krok 3: Testovacie scénáre

#### Test A: Príspevok v "Susedský Život"
```
1. Prihlasit sa ako používateľ A
2. Prejsť na "Nastenka" > "📣 Info pre susedov"
3. Vytvoriť príspevok "Test príspevok"
4. Prihlasit sa ako používateľ B (na inom zariadení/prehliadači)
5. Skontrolovať:
   - Príspevok sa zobrazuje na Nástence
   - Notifikácia v zvone
   - Push notifikácia (ak je aktivovaná)
```

#### Test B: Oznam v "Obecný Hlásnik"
```
1. Prihlasit sa ako starosta
2. Prejsť na "Nastenka" > "📢 Hlásnik"
3. Vytvoriť oznam "Test hlásnik"
4. Prihlasit sa ako občan
5. Skontrolovať:
   - Oznam sa zobrazuje na Nástence
   - Notifikácia v zvone
   - Push notifikácia s vyššou urgenciou
```

---

## 📊 Očakávané výsledky

### Pred úpravami:
- ❌ "Susedský život" príspevky - **žiadne notifikácie**
- ✅ "Obecný hlásnik" - **notifikácie fungujú**

### Po úpravách:
- ✅ "Susedský život" príspevky - **notifikácie posielané všetkým ostatným**
- ✅ "Obecný hlásnik" - **naďalej funguje bez zmien**
- ✅ Všetky ostatné notifikácie - **bez zmien**

---

## 📚 Vzťahujúce sa súbory

### Databáza:
- `supabase/migrations/20260910121000_add_neighbor_post_notifications.sql` - **NOVÝ TRIGGER**
- `supabase/migrations/20260805173000_push_notifications_pipeline.sql` - existujúci push pipeline

### Edge Functions:
- `supabase/functions/send-push/index.ts` - **UPRAVENÉ** (2 funkcie)
- `supabase/functions/send-push/logic.ts` - bez zmien

### Frontend:
- `src/screens/NastenkaScreen.tsx` - vytvorenie príspevkov (bez zmien)
- `src/context/NotificationContext.tsx` - spracovanie notifikácií (bez zmien)
- `src/lib/push.ts` - push subscription management (bez zmien)

---

## ✨ Poznámky k implementácii

1. **Oddelené triggery:** "Susedský život" a "Hlásnik" majú oddelené triggery, aby sa zabránilo kolíziám a umožnilo nezávislosť logiky.

2. **Jednoduchá logika pre Susedský život:** Na rozdiel od "Hlásnika", ktorý má logiku pre prioritu, "Susedský život" má konštantne `priority = 'oznam'` a `is_critical = false`. To je zámerné - títo príspevky nie sú kritické upozornenia.

3. **Community Broadcast:** Oba typy ("hlasnik" a "susedsky_zivot") sú označené ako "community broadcast" v send-push, čo zabezpečuje, že sa push notifikácia pošle aj keď sú nešetriace notifikácie výpnuté (ale musíte mať povolenú aplikáciu).

4. **Bez zmien v existujúcich triggeroch:** Trigger pre "hlasnik" ostáva úplne bez zmien, aby sa zabránilo regresiám.

---

**Status:** ✅ **READY FOR PRODUCTION**
