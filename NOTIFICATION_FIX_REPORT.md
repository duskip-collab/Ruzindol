# 🔧 ANALÝZA A OPRAVA PROBLÉMU S NOTIFIKÁCIAMI

**Dátum:** 2026-09-10  
**Status:** 🟢 PROBLÉM NÁJDENÝ A OPRAVENÝ  

---

## 🚨 OBJAVENÝ PROBLÉM

### Problém: Nekonzistentnosť v Edge Function `send-push/index.ts`

V funkcii `isCommunityBroadcastNotification()` **chýbalo `"hlasnik"`** ako typ notifikácie.

#### Riadok 47 PRED:
```typescript
function isCommunityBroadcastNotification(record: Record<string, unknown>) {
  const type = String(record.type ?? "").toLowerCase();
  return type === "announcement" || type === "official_alert" || type === "group_announcement" || type === "neighbor_post";
  // ❌ CHÝBA: type === "hlasnik"
}
```

Ale na riadku 39 sa **kontroluje** `type === "hlasnik"`:
```typescript
if (type === "official_alert" || type === "hlasnik" || type === "neighbor_post") return "/nastenka";
// ✅ ALE TU JE ZAHRNUTÝ!
```

---

## ✅ OPRAVA

### Riadok 47 PO:
```typescript
function isCommunityBroadcastNotification(record: Record<string, unknown>) {
  const type = String(record.type ?? "").toLowerCase();
  return type === "announcement" || type === "official_alert" || type === "hlasnik" || type === "group_announcement" || type === "neighbor_post";
  // ✅ OPRAVENÉ: Pridaný type === "hlasnik"
}
```

---

## 📋 DOPAD PROBLÉMU

### Ako problém ovplyvňoval notifikácie:

1. **Notifikácia typu "hlasnik" bola prijatá v edge function**
2. **`isCommunityBroadcastNotification()` vratila `false`** (lebo "hlasnik" nebol v podmienkach)
3. **`forceSend` premenná bola nastavená na `false`**
4. **Edge function skontrolovala preferenčné nastavenia používateľa** (`shouldSendOptionalNotification()`)
5. **Ak mal používateľ notifikácie vypnuté**, notifikácia sa **NEODOSLALA**
6. **Problém**: "Hlásnik" (obecný hlásnik) by mal byť **vždy** odoslaný (broadcast), ale kvôli chybajúcemu type sa kontrolovala preferencia

### Vplyv na notifikácie:
- ✅ **RSS Announcements** - Fungovali (správne zahrnuté ako "announcement")
- ✅ **Group Announcements** - Fungovali (správne zahrnuté ako "group_announcement")
- ✅ **Inquiry Answers** - Fungovali (nie je súčasť broadcast check)
- ✅ **Neighbor Posts** - Fungovali (správne zahrnuté ako "neighbor_post")
- ❌ **Obecný Hlásnik (Hlasnik)** - NEFUNGOVALI pre užívateľov s vypnutými notifikáciami

---

## 📝 ZMENY V SÚBOREJ

### Súbor: `supabase/functions/send-push/index.ts`

**Zmena na riadku 47:**
```diff
  function isCommunityBroadcastNotification(record: Record<string, unknown>) {
    const type = String(record.type ?? "").toLowerCase();
-   return type === "announcement" || type === "official_alert" || type === "group_announcement" || type === "neighbor_post";
+   return type === "announcement" || type === "official_alert" || type === "hlasnik" || type === "group_announcement" || type === "neighbor_post";
  }
```

---

## 🔍 KONTROLNÁ CHECKLIST

- [x] Nájdený nekonzistentný typ "hlasnik" v `isCommunityBroadcastNotification()`
- [x] Pridaný `type === "hlasnik"` do podmienky
- [x] Overené, že všetky typy notifikácií sú teraz pokryté:
  - [x] `announcement` - RSS Announcements
  - [x] `official_alert` - Obecný hlásnik (official)
  - [x] `hlasnik` - Obecný hlásnik (fallback/legacy)
  - [x] `group_announcement` - Skupinové oznámenia
  - [x] `neighbor_post` - Susedský život (nové)
- [x] Overené, že zmena je konzistentná s `resolveTargetUrl()` na riadku 39
- [x] Žiadne ostatné zmeny v logike nie sú potrebné

---

## 🚀 NASADENIE

### Kroky na nasadenie:

1. **Aplikujte zmenu na edge function**:
   ```bash
   # Upraviť: supabase/functions/send-push/index.ts
   # Zmena: riadok 47 - pridať "hlasnik"
   ```

2. **Overujte zmenu v Supabase Edge Function Editor**:
   - Prejdite na: Functions → send-push → Deploy

3. **Otestujte notifikácie**:
   - Vytvorte nový príspevok v "Susedský život"
   - Vytvorte oznámenie v "Obecnom hlásníku"
   - Skontrolovať, či všetci používatelia dostali push notifikácie

---

## 📚 CONTEXT

### Ako sa notifikácie spracovávajú:

```
1. Příspěvek INSERT na tabuľku 'posts'
   ↓
2. Trigger 'trg_enqueue_notifications_hlasnik_posts' alebo 'trg_enqueue_notifications_susedsky_zivot_posts'
   ↓
3. Vytvoří sa záznam v tabuľke 'notifications'
   ↓
4. Realtime webhook spustí edge function 'send-push'
   ↓
5. Edge function kontroluje:
   a. isCommunityBroadcastNotification() - je to broadcast notifikácia?
   b. shouldSendOptionalNotification() - sú notifikácie povolené?
   ↓
6. Push notifikácia sa odošle na device
```

**PROBLÉM**: V kroku 5a, ak bol typ "hlasnik", funkcia vrátila `false`, čo spôsobilo preskočenie broadcast logiky.

---

## ✨ VÝSLEDOK

**Všetky notifikácie by mali teraz fungovať korektne:**
- ✅ Obecný hlásnik - **VŽDY** sa odošle (broadcast)
- ✅ Susedský život - **VŽDY** sa odošle (broadcast)
- ✅ RSS Announcements - Sa odoslajú
- ✅ Skupinové oznámenia - Sa odoslajú
- ✅ Odpovede na podnety - Sa odoslajú

---

**Čas opravy**: < 5 minút
**Zložitosť**: Jednoduchá zmena jedného riadku
**Riziko**: Minimálne (len doplnenie chýbajúceho typu)
