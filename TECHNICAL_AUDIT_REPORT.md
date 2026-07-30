# Technicky audit po migracii z Lovable do lokalneho VS Code

Datum auditu: 2026-07-17
Projekt: Komunita (TanStack Start + Supabase)

## 1. Scope auditu

Cielom auditu bolo overit:

- mapovanie routingu a provider stromu,
- funkcnost navigacie a konzistenciu route cielov,
- zostatkove zavislosti na Lovable vrstvach,
- robustnost datoveho toku (Supabase + kontexty),
- navrh konkretneho akcneho planu.

## 2. Inventar suborov

### Router subory

- src/router.tsx
- src/routeTree.gen.ts
- src/routes/__root.tsx
- src/routes/auth.tsx
- src/routes/auth/callback.tsx
- src/routes/reset-password.tsx
- src/routes/_authenticated/route.tsx
- src/routes/_authenticated/index.tsx

### Context subory

- src/context/AppModeContext.tsx
- src/context/NotificationContext.tsx
- src/context/ThemeContext.tsx

### Supabase integracia

- src/integrations/supabase/client.ts
- src/integrations/supabase/auth-attacher.ts

## 3. Mapping architektury a providerov

### Root shell

Subor: src/routes/__root.tsx

Provider poradie je konzistentne:

1. QueryClientProvider
2. ThemeProvider
3. AppModeProvider
4. NotificationProvider

Zaver:

- Provider composition je validna.
- Outlet je zachovany, route rendering je funkcny.
- Kriticky SSR konflikt nebol najdeny.

### SSR poznamka

Theme je po poslednej uprave locknuta na light rezim, co znizuje riziko hydration mismatch medzi server/client pre temu.

## 4. Route audit

### Route tabulka

| Route | Subor | Stav | Poznamka |
| --- | --- | --- | --- |
| / | src/routes/_authenticated/index.tsx | Funkcne | Chranene guardom, taby su URL-driven cez search param `tab` |
| /auth | src/routes/auth.tsx | Funkcne | Email + Google login flow |
| /auth/callback | src/routes/auth/callback.tsx | Funkcne | OAuth code exchange cez Supabase |
| /reset-password | src/routes/reset-password.tsx | Funkcne | Cleanup listenera je implementovany (unsubscribe) |
| /_authenticated | src/routes/_authenticated/route.tsx | Funkcne | beforeLoad guard kontroluje session usera |

### Navigacia a odkazy

Skontrolovane ciele navigate/Link:

- /auth
- /

Nenasiel sa odkaz na neexistujucu cestu.

## 5. Funkcnost a prepojenia

### Auth guard

Subor: src/routes/_authenticated/route.tsx

- Guard je CSR (`ssr: false`) a pouziva `supabase.auth.getUser()`.
- Pri chybe alebo bez usera korektne redirectuje na /auth.

### Auth callback

Subor: src/routes/auth/callback.tsx

- Overuje existujucu session.
- Ak nie je session, spracuje OAuth `code` cez `exchangeCodeForSession`.
- Redirect flow je korektny.

## 6. Datovy tok

### Supabase klient

Subor: src/integrations/supabase/client.ts

- Priame pripojenie cez `@supabase/supabase-js`.
- Osetrene env pre client aj SSR fallback.
- Lazy inicializacia je cez Proxy.

Poznamka:

- Proxy vrstva je funkcna, no je to dalsia abstrakcia. Nie je to Lovable zavislost, ale je to "generated utility" vrstva.

### Server klient

Subor: src/integrations/supabase/client.server.ts

- Povodne pripraveny service-role klient bol nevyuzity.
- Po audite bol odstraneny ako zombie vrstva.

### Auth middleware vrstvy

- src/integrations/supabase/auth-attacher.ts je aktivne registrovany v src/start.ts.
- nepouzivany src/integrations/supabase/auth-middleware.ts bol odstraneny.

### Kontexty a zdroje pravdy

- `useCurrentUser` ide naozaj cez Supabase (profiles + auth user).
- `AppModeContext` a `NotificationContext` su validne pre lokalny UX stav.
- Nastenka a RolePanels su migrovane na Supabase query/mutation flow.

Zaver:

Projekt je vyrazne konsolidovany: auth/profile a hlavne obsahove moduly su napojene na Supabase bez AppContext runtime vrstvy.

## 7. Lovable / zombie code audit

### Lovable stopy

- V `src/` neboli najdene importy `@lovable` ani utility volania Lovable runtime.
- Nalezy "LOvable" boli iba v build artefaktoch cesty projektu (nazov priecinka), nie ako dependencia.

### Kandidati na zombie kod

Ziadny potvrdeny zombie modul v runtime vrstve nebol po poslednych refaktoroch identifikovany.

## 8. Odporucany action plan

### Priorita P1 (rychle a bezpecne)

1. Opravit unsubscribe v reset-password route
- DONE: cleanup cez unsubscribe je implementovany.

2. Rozhodnut osud `auth-middleware.ts`
- DONE: nepouzivany middleware bol odstraneny.

3. Revidovat `client.server.ts`
- DONE: nevyuzity subor bol odstraneny.

### Priorita P2 (konsolidacia architektury)

1. Konsolidovat data-flow posts/items/chats
- DONE pre Nastenka + RolePanels.
- DONE: doplnene DB tabulky `post_likes` a `post_reports` + napojenie na NastenkaScreen.

### Priorita P3 (UX/arch)

5. Presunut tab navigaciu na route-driven URL
- napr. /app/nastenka, /app/aktuality, /app/sklad, /app/spravy, /app/profil.
- ziskat deep-linking a konzistentny browser history flow.

## 9. Celkovy stav migracie

Verdikt: Stabilne po migracii, bez aktivnych Lovable zavislosti v src, s jasne identifikovanymi prechodovymi vrstvami.

- Routing a auth flow su funkcne.
- Provider strom je konzistentny.
- Najvyznamnejsi technicky dlh je route-level deep-linking mimo search param modelu.
