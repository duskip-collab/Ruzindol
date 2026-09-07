# Git Commit Summary - Push Notifikácie pre "Susedský Život"

## Zmeny

### 1. Nová migrácia databázy
**Súbor:** `supabase/migrations/20260910121000_add_neighbor_post_notifications.sql`

**Popis:**
- Pridaný trigger `enqueue_notifications_for_susedsky_zivot_posts()` pre notifikácie príspevkov typu `susedsky_zivot`
- Vytvárajú sa notifikácie s typom `neighbor_post` pre všetkých ostatných profilov
- Notifikácia obsahuje názov príspevku, text a odkaz na `/nastenka`

**Prečo:**
Umožňuje automatické vytvorenie notifikácií keď užívateľ vytvorí príspevok v sekcii "Susedský život"

---

### 2. Upravená edge function
**Súbor:** `supabase/functions/send-push/index.ts`

**Zmeny:**

#### A) Funkcia `resolveTargetUrl()` (riadok 39)
Priradená navigácia pre `neighbor_post` na `/nastenka`:
```typescript
// PRED:
if (type === "official_alert" || type === "hlasnik") return "/nastenka";

// PO:
if (type === "official_alert" || type === "hlasnik" || type === "neighbor_post") return "/nastenka";
```

#### B) Funkcia `isCommunityBroadcastNotification()` (riadok 47)
Klasifikácia `neighbor_post` ako community broadcast:
```typescript
// PRED:
return type === "announcement" || type === "official_alert" || type === "group_announcement";

// PO:
return type === "announcement" || type === "official_alert" || type === "group_announcement" || type === "neighbor_post";
```

**Prečo:**
- `resolveTargetUrl()`: Zabezpečuje, že push notifikácia naviguje na správnu stránku
- `isCommunityBroadcastNotification()`: Zaistí, že push notifikácia sa pošle s vysokou prioritou aj keď sú ostatné notifikácie zakázané

---

### 3. Frontend - bez zmien ✅
- `src/context/NotificationContext.tsx` - Automaticky spracúva všetky typy notifikácií
- `src/screens/NastenkaScreen.tsx` - Už má podporu pre `susedsky_zivot`
- `src/lib/push.ts` - Bez zmien

---

## Overenie zmien

### ✅ Databáza
- Migrácia je idempotentná (môže sa spustiť viackrát)
- Trigger je bezpečne oddelený od existujúcich triggerov
- Notifikácie sa filtrujú podľa `user_id` (bezpečnosť RLS)
- Žiadne zmeny v existujúcich triggeroch

### ✅ Push notifikácie
- `neighbor_post` je mapovaný na `/nastenka`
- `neighbor_post` je klasifikovaný ako community broadcast
- Všetky existujúce typy (`announcement`, `official_alert`, etc.) sa posielajú bez zmien

### ✅ Frontend
- NotificationContext.tsx číta notifikácie z databázy bez filtrácií podľa typu
- Všetky nové notifikácie sa automaticky zobrazujú
- Bez regresií v existujúcim funkciám

---

## Testovací scenár

### Test: Príspevok v "Susedský Život"
1. **Užívateľ A** vytvorí príspevok v "Nastenka > Info pre susedov"
2. **Databáza:** Trigger vytvorí notifikácie pre všetkých ostatných
3. **Užívateľ B** dostane:
   - ✅ Notifikáciu v aplikácii (v zvone)
   - ✅ Push notifikáciu na zariadení
   - ✅ Kliknutie na notifikáciu ho naviguje na `/nastenka`

### Test: Oznam v "Obecný Hlásnik"
1. **Starosta** vytvorí oznam v "Nastenka > Hlásnik"
2. **Databáza:** Existujúci trigger vytvára `official_alert` notifikácie
3. **Občan** dostane:
   - ✅ Notifikáciu v aplikácii
   - ✅ Push notifikáciu
   - ✅ (Bez zmien oproti predtým)

---

## Rizika a mitigation

| Riziko | Pravdepodobnosť | Mitigation |
|--------|-----------------|-----------|
| SQL syntax chyba v migácii | Nízka | Migrácia je testovaná, DROP IF EXISTS zabrániť chybám |
| Duplicate notifikácie | Nízka | Trigger je AFTER INSERT, nie BEFORE INSERT |
| Performance (príliš veľa notifikácií) | Nízka | Notifikácie sa vytvárajú len pre `susedsky_zivot` typ |
| RLS problémy | Nízka | RLS politiky sa nezmenia, notifikácie majú user_id |
| Frontend regresie | Veľmi nízka | Frontend sa vôbec nezmení |

---

## Nasadenie

1. **SQL Migrácia:** Aplikovať v Supabase Console
2. **Edge Function:** Automaticky deployovaná zmena v `send-push/index.ts`
3. **Frontend:** Bez zmien (redeploy nie je potrebný)

---

## Dokumentácia

Vytvorené súbory:
- `NEIGHBOR_POST_NOTIFICATIONS_IMPLEMENTATION.md` - Detailná dokumentácia
- `DEPLOYMENT_CHECKLIST_NOTIFICATIONS.md` - Deployment checklist

---

**Co-authored-by:** Copilot <223556219+Copilot@users.noreply.github.com>
