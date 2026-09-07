# ✅ TESTOVACIA PROCEDÚRA PRE NOTIFIKÁCIE

**Status:** Oprava aplikovaná  
**Dátum:** 2026-09-10  

---

## 🔍 ČECKLIST NA OVERENIE OPRAVY

### 1. Overenie Kódu

- [x] **Edge Function** (`supabase/functions/send-push/index.ts`):
  - [x] Riadok 39: `resolveTargetUrl()` obsahuje `type === "hlasnik"`
  - [x] Riadok 47: `isCommunityBroadcastNotification()` teraz obsahuje `type === "hlasnik"`
  - [x] Konzistentnosť oboch funkcií ✅

### 2. Typy Notifikácií - Overenie Pokrytia

| Typ | resolveTargetUrl() | isCommunityBroadcast() | Popis | Status |
|-----|-------------------|----------------------|-------|--------|
| `announcement` | `/aktuality` | ✅ Yes | RSS Announcements | ✅ OK |
| `official_alert` | `/nastenka` | ✅ Yes | Obecný hlásnik (official) | ✅ OK |
| `hlasnik` | `/nastenka` | ✅ Yes (NOVÁ OPRAVA) | Obecný hlásnik (fallback) | ✅ OK |
| `group_announcement` | `/aktuality` | ✅ Yes | Skupinové oznámenia | ✅ OK |
| `neighbor_post` | `/nastenka` | ✅ Yes | Susedský život (NOVÉ) | ✅ OK |
| `inquiry_answer` | `/` | ❌ No | Odpovede na podnety | ✅ OK |
| `message` | `/chat/{refId}` | ❌ No | Chat správy | ✅ OK |

### 3. Očakávaný Scenár - Ako by teraz malo fungovať

#### Scenár A: Vytvorenie príspevku v "Susedský život"
```
1. Príspevok typu 'susedsky_zivot' sa vloží do tabuľky 'posts'
   ↓
2. Trigger 'trg_enqueue_notifications_susedsky_zivot_posts' sa spustí
   ↓
3. Notifikácia s typom 'neighbor_post' sa vytvorí pre všetkých okrem autora
   ↓
4. Edge function 'send-push' spracuje notifikáciu
   ↓
5. isCommunityBroadcastNotification() vráti TRUE ✅
   (lebo type === "neighbor_post" je v podmienke)
   ↓
6. Notifikácia sa VŽDY odošle, bez ohľadu na preferenčné nastavenia ✅
```

#### Scenár B: Vytvorenie oznámenia v "Obecnom hlásníku"
```
1. Príspevek typu 'hlasnik' alebo 'official_alert' sa vloží do tabuľky 'posts'
   ↓
2. Trigger 'trg_enqueue_notifications_hlasnik_posts' se spustí
   ↓
3. Notifikácia s typom 'official_alert' se vytvorí pro všechny okrom autora
   ↓
4. Edge function 'send-push' spracuje notifikáciu
   ↓
5. isCommunityBroadcastNotification() vráti TRUE ✅
   (lebo type === "official_alert" je v podmienke)
   ↓
6. Notifikácia se VŽDY odošle, bez ohľadu na preferenčné nastavenia ✅
```

#### Scenár C: Fallback pre starý kód (Hlasnik)
```
Ak by sa z nejakého dôvodu vytvorila notifikácia s typom 'hlasnik':

1. Edge function dostane type === "hlasnik"
   ↓
2. isCommunityBroadcastNotification() vráti TRUE ✅ (OPRAVA!)
   (dříve vracala FALSE - TO BYL PROBLÉM)
   ↓
3. Notifikácia se VŽDY odošle ✅
```

---

## 🧪 MANUÁLNE TESTOVANIE

Ak chcete manuálne otestovať notifikácie v Supabase dashboarde:

### Test 1: Príspevek v Susedskom živote
```sql
-- Vložiť testovací príspevek v Susedskom živote
INSERT INTO public.posts (
  id, community_id, user_id, type, title, content, status, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'YOUR_COMMUNITY_ID',
  'YOUR_USER_ID',
  'susedsky_zivot',
  '🧪 Test: Susedský život',
  'Toto je testovací príspevek pre overenie notifikácií',
  'published',
  now(),
  now()
);

-- Skontrolujte, či sa vytvorili notifikácie
SELECT * FROM public.notifications 
WHERE type = 'neighbor_post' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Test 2: Oznámenie v Obecnom hlásníku
```sql
-- Vložiť testovací príspevek v Obecnom hlásníku
INSERT INTO public.posts (
  id, community_id, user_id, type, title, content, status, category, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'YOUR_COMMUNITY_ID',
  'YOUR_USER_ID',
  'hlasnik',
  '🧪 Test: Obecný hlásnik',
  'Toto je testovací hlásnik pre overenie notifikácií',
  'published',
  'standard',
  now(),
  now()
);

-- Skontrolujte, či sa vytvorili notifikácie
SELECT * FROM public.notifications 
WHERE type = 'official_alert' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Test 3: Overiť počet notifikácií
```sql
-- Počet notifikácií podľa typu v posledných 24 hodinách
SELECT 
  type,
  COUNT(*) as pocet_notifikacii,
  MAX(created_at) as posledna_notifikacia
FROM public.notifications
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY type
ORDER BY pocet_notifikacii DESC;
```

---

## 📞 KONTAKT NA CHYBY

Ak notifikácie **stále** nie sú funkčné po aplikovaní tejto opravy, skontrolujte:

1. **Supabase Dashboard → Functions → Logs**:
   - Skontrolujte chyby v `send-push` edge function
   - Hľadajte chyby typu "subscription_query_failed" alebo "missing_user_id"

2. **Supabase Dashboard → SQL Editor**:
   - Spustite skript `DIAGNOSTIC_SQL.sql` na overenie databázového stavu

3. **Browser DevTools → Console**:
   - Skontrolujte, či frontend dostáva notifikácie cez Realtime kanál

---

## 🎯 SÚHRN OPRAVY

| Problém | Oprava | Dôsledok |
|---------|--------|---------|
| Chýbajúci `"hlasnik"` v `isCommunityBroadcastNotification()` | Pridaný `type === "hlasnik"` | Notifikácie "Obecný hlásnik" sa teraz VŽDY pošlú |
| Nekonzistentnosť medzi `resolveTargetUrl()` a `isCommunityBroadcastNotification()` | Obidve funkcie teraz obsahujú rovnaké typy | Správna logika notifikácií |

---

**Oprava aplikovaná:** ✅  
**Testovanie:** Čaká sa na nasadenie na Supabase  
**Predpokladaný dopad:** Všetky notifikácie by teraz mali fungovať správne
