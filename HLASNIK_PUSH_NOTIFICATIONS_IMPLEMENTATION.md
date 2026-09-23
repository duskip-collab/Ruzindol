# Push notifikácie pre nové položky obecného hlásnika

**Dátum:** 2026-09-23
**Rozsah:** výhradne detekcia nových položiek na hlavnej ploche obecného hlásnika a ich
prepojenie na odoslanie push notifikácie. Ostatný kód aplikácie ostal bez zmien.

## Problém

Hlásnik (`src/hooks/useHlasnikFeed.ts`) zobrazuje tri zdroje, ale push notifikáciu mali len
niektoré z nich:

| Zdroj hlásnika | Tabuľka | Push pred zmenou |
| --- | --- | --- |
| RSS aktuality obce | `announcements` (`source = 'rss'`) | ❌ žiadna (trigger preskakoval všetko okrem `internal`) |
| Termíny kalendára (dnes/zajtra) | `events` (`type <> 'odpad'`) | ❌ žiadna (trigger neexistoval) |
| Vývoz odpadu (dnes/zajtra) | `events` (`type = 'odpad'`) | ❌ žiadna (len cron pripomienka „zajtra“) |
| Príspevky hlásnika | `posts` (`hlasnik`/`official_alert`) | ✅ fungovala |
| Interné oznamy / rozhlas | `announcements` (`source = 'internal'`) | ✅ fungovala |

## Riešenie

### 1) Nová migrácia – univerzálny spúšťač

`supabase/migrations/20260923130000_hlasnik_new_items_push_notifications.sql`

* `trg_enqueue_notifications_rss_announcements` na `public.announcements`
  → pre novú RSS položku vytvorí notifikáciu typu **`rss_announcement`**
  (nadpis aktuality + výňatok obsahu, `url = /aktuality?tile=oznamy&sub=rss`).
  Položky staršie ako 5 dní (alebo bez `published_at`) sa preskakujú, pretože v hlásniku
  sa už nezobrazujú (`NEWS_MAX_AGE_MS`).
* `trg_enqueue_notifications_calendar_events` na `public.events`
  → pre nový termín v okne **DNES + ZAJTRA** (lokálny čas `Europe/Bratislava`, presne ako
  filter hlásnika) vytvorí notifikáciu typu **`calendar_event`**
  (`url = /kalendar`, pre `type = 'odpad'` → `/kalendar?category=odpad`).
  Autor termínu notifikáciu nedostane, duplicitám bráni `NOT EXISTS` poistka.

Obe funkcie sú `AFTER INSERT` (nie `UPDATE`), takže opakovaný RSS sync / `upsert`
(`ON CONFLICT DO UPDATE`) nikdy nevygeneruje notifikáciu pre už známu položku – push sa
pošle len pre **skutočne novú** položku.

### 2) Prepojenie na odoslanie push (Edge Function `send-push`)

* `index.ts` → `resolveTargetUrl()`: `rss_announcement` → `/aktuality?tile=oznamy&sub=rss`,
  `calendar_event` → `/kalendar` (fallback, ak by v notifikácii chýbal `url`).
* `index.ts` → `isCommunityBroadcastNotification()`: oba nové typy sú broadcast (rovnako ako
  existujúci `official_alert`/`announcement`), takže sa odošlú aj používateľom s vypnutým
  všeobecným prepínačom notifikácií.
* `logic.ts` → `resolveNotifyCategory()`: oba nové typy patria do kategórie **`obecne`**,
  rovnako ako doterajší hlásnik – filter záujmov sa tak správa konzistentne.
* `logic.test.ts`: doplnené testy mapovania nových typov a regresie pôvodných.

Existujúce typy ani ich správanie sa nemenia. Reťazenie ostáva rovnaké:

```
INSERT (RSS sync / admin / sync skript)
   → DB trigger (nové položky hlásnika)
   → public.notifications
   → Database Webhook
   → Edge Function send-push
   → WebPush všetkým odberateľom (user_push_subscriptions)
```

### 3) Presmerovanie po kliknutí

Push payload obsahuje `url` z notifikácie, ktorý `public/push-handlers.js`
(`notificationclick`) otvorí priamo v aplikácii:

* RSS aktualita → `/aktuality?tile=oznamy&sub=rss` („RSS oznamy obce“),
* termín kalendára → `/kalendar`,
* vývoz odpadu → `/kalendar?category=odpad`.

Ide o rovnaké ciele, aké používa samotná kartička hlásnika
(`src/components/ObecnyHlasnik.tsx`), takže preklik je konzistentný.

## Nasadenie

```bash
npx supabase db push          # aplikuje novú migráciu
supabase functions deploy send-push
```

Alternatívne je možné obsah migrácie vložiť do Supabase SQL Editora (idempotentná –
`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`).

## Overenie

* `npm run build` – prechádza.
* `npm run typecheck` – prechádza.
* Logika `logic.ts` overená spustením mimo Deno (transpilácia `tsc` + Node) – všetky
  kontroly vrátane spätnej kompatibility prešli.
* Po nasadení: vložiť novú RSS položku / termín na dnes alebo zajtra a skontrolovať
  `public.notifications` (typy `rss_announcement`, `calendar_event`) a doručenie push.

> Poznámka: filtrovanie „aktívni odberatelia“ je riešené na strane `send-push` – push sa
> posiela používateľom, ktorí majú záznam v `user_push_subscriptions`; používatelia bez
> odberu sa preskočia.
