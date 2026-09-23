# PWA aktualizácie na iOS (Safari) – kontrola verzie a návrat z pozadia

**Dátum:** 2026-09-23
**Rozsah:** výhradne aktualizačná logika, kontrola verzie a ošetrenie návratu aplikácie
z pozadia na iOS. Hlásnik, notifikácie, podnety ani iné moduly sa nemenili.

## Čo bolo zlé

| # | Problém | Dôsledok |
| --- | --- | --- |
| 1 | Chýbal `pageshow` listener s `event.persisted` | iOS pri obnovení z bfcache nevykonal kontrolu verzie |
| 2 | `fetch("/version.json?t=…")` bez `cache: "no-store"` | Safari mohol vrátiť verziu z lokálnej cache |
| 3 | `public/version.json` bol napevno `1.0.0` a nikdy sa nemenil | kontrola verzie bola **nefunkčná** – nikdy nezistila nové nasadenie |
| 4 | Reload nezisťoval, či beží naozaj aktuálny bundle | po reloade mohol bežať starý kód z Workbox precache (typicky na iOS) |
| 5 | `unregister()` SW nebol `await`-nutý, cache sa nečistila | na iOS mohol prežívať starý kód, hrozila slučka reloadov |

## Zmeny

### `src/lib/pwa-version.ts` (nový)
Čistá, testovateľná logika verzie (bez DOM):
`isAppOutdated()` porovná **verziu zo servera** s uloženou verziou a tiež
**identifikátor bežiaceho bundle** (`buildId`) s tým, ktorý ponúka server
(toto odhalí starý kód v bfcache/precache), `buildIdFromUrl()` odvodí identifikátor
z `import.meta.url`, `isWithinCooldown()` chráni pred slučkou reloadov.
Kľúče: `app-version` (localStorage), `komunita.pwa.last-forced-update-at`,
`komunita.pwa.suppress-sw-reload-until` (sessionStorage).

### `src/main.tsx`
* **`pageshow` (iOS bfcache):** nový listener sleduje `event.persisted`; pri obnovení
  z vyrovnávacej pamäte sa kontrola verzie spustí **okamžite** (obchádza 30 s odstup),
  inak beží normálne. V oboch prípadoch sa na pozadí zavolá aj `registration.update()`.
* **Agresívny fetch:** `fetch("/version.json?t=…", { cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } })`
  + 8 s timeout (aby zaseknutá sieť nezablokovala ďalšie kontroly).
* **Vynútená aktualizácia (`forceAppUpdate`):** uloží novú verziu, `update()` +
  `unregister()` všetkých Service Workerov, vyčistí `CacheStorage` a až potom
  `window.location.reload()`. Ochrana proti slučke: ďalší pokus najskôr po 30 s
  (`komunita.pwa.last-forced-update-at`).
* **Žiadny dvojitý reload:** po vynútenom update sa v SW bloku potlačí okamžitý
  `updatefound`/`controllerchange` reload (10 s), keďže čerstvý SW sa stránky ujme sám.
* `visibilitychange` ostáva (iOS standalone často pošle len toto) – kontroluje verziu
  a aktualizuje SW.

### `vite.config.ts`
Plugin `pwa-version-file()` zapíše pri builde `dist/version.json`:

```json
{ "version": "index-DM4qdH3T.js-53d602a53927", "buildId": "index-DM4qdH3T.js", "builtAt": "…" }
```

* `buildId` = názov vstupného chunk-u (rovnaký, aký má klient v `import.meta.url`)
  → odhalí starý kód, aj keď je verzia v localStorage už prepísaná.
* `version` obsahuje odtlačok všetkých assetov → zmení sa pri každej zmene kódu,
  takže vynútený reload sa naozaj spustí.
* Zapisuje sa v `closeBundle` (po skopírovaní `public/`), takže statické
  `public/version.json` slúži len pre `vite dev`.

## Nasadenie / infra

`vercel.json` už obsahuje `Cache-Control: public, max-age=0, must-revalidate` pre
`/version.json`. Podľa dokumentácie Vercel ide routing v poradí
*File System Routes → Rewrites*, takže catch-all rewrite na `/index.html` statický
`/version.json` neprepíše. Service Worker súbor `version.json` neobsluhuje
(nie je v `globPatterns`), takže požiadavka ide vždy na sieť.

## Overenie

* `npm run build` – prechádza, `dist/version.json` obsahuje generovanú verziu a jej
  `buildId` sa zhoduje s entry chunkom v `dist/index.html`.
* `npm run typecheck` – prechádza.
* `eslint` na zmenených súboroch – bez chýb (celý repo má pre-existing lint chyby
  v iných, nedotknutých súboroch).
* Logika `pwa-version.ts` overená 17 kontrolami (nové nasadenie, starý bundle
  z bfcache, prvé spustenie, dev režim, cooldown, parsovanie `import.meta.url`).

## Ako to funguje na iOS

1. Občan otvorí PWA z plochy (alebo ju vráti z pozadia) → `pageshow` (`persisted = true`)
   / `visibilitychange` → kontrola `version.json` s `no-store`.
2. Ak sa verzia alebo identifikátor buildu líši → `update()`+`unregister()` SW, vyčistenie cache,
   zápis novej verzie a `location.reload()` → občan vidí aktuálny kód.
3. Ak by bola odpoveď aj po reloade nekonzistentná (napr. CDN ešte nedobehol),
   ochrana proti slučke zabráni opakovanému reloadu.
