# Analýza a Komplexný Sumár Projektu "Komunita"

Tento dokument poskytuje detailný technický a funkčný prehľad aplikácie **Komunita** (Susedská platforma, primárne lokalizovaná pre obec Ružindol). Dokument mapuje súčasný stav implementácie, technickú architektúru, štruktúru databázy, komponentov a integrácií po migrácii z vývojovej platformy Lovable.

---

## 1. Prehľad aplikácie a Architektúra

### Hlavný účel aplikácie
**Komunita** je uzavretá susedská a komunitná platforma (s predvoleným nastavením pre obec Ružindol), ktorá slúži na uľahčenie miestnej komunikácie, zdieľanie informácií, susedskú pomoc a výpožičky náradia či iných potrieb. Aplikácia poskytuje bezpečné prostredie pre obyvateľov vďaka systému geografického overenia a overovania pomocou jedinečných pozývacích kódov od starostu alebo overených susedov.

### Použitý Tech Stack
*   **Frontend (Používateľské rozhranie):**
    *   **Knižnica:** React 19 & TypeScript (strict mode).
    *   **Smerovanie (Routing):** TanStack Router (s plnou podporou typovo bezpečných trás a klientskeho generovania stromu smerovania `routeTree.gen.ts`).
    *   **Správa stavu & Data Fetching:** TanStack Query (@tanstack/react-query v5) na optimalizáciu dopytov a mutácií, lokálny stav a globálne stavy cez React Context.
    *   **Styling & UI:** Tailwind CSS, Radix UI (reusable základ pre shadcn/ui komponenty), Framer Motion (vysoko plynulé animácie prechodov obrazoviek a onboarding krokov).
    *   **Mapové podklady:** Leaflet & React-Leaflet na interaktívny výber ulice/domu počas onboardingu.
*   **Backend (BaaS & Serverless):**
    *   **Služba:** Supabase (kompletná integrácia Postgres DB, Authentication, Realtime WebSocket kanálov pre chat, a Storage).
    *   **Serverless Logika:** Supabase Edge Functions (Deno runtime) pre asynchrónne a plánované operácie (scraping úradných webov, posielanie push notifikácií, mazanie účtov).
*   **Ostatné dôležité knižnice:**
    *   `lucide-react` pre sadu moderných ikon.
    *   `date-fns` pre lokalizovanú prácu s časom a dátumami.
    *   `browser-image-compression` pre kompresiu fotografií pred nahrávaním na úložisko.
    *   `recharts` pre analytické zobrazenia v rozhraní pre admina.
    *   `sonner` pre systém toastových notifikácií.

### Typ architektúry
Ide o **Single Page Application (SPA) s Client-Side Routingom (TanStack Router)**, ktorá komunikuje priamo s cloudovou infraštruktúrou **Supabase (Backend-as-a-Service)** cez typovo bezpečné API rozhranie PostgREST.

Súčasťou architektúry je taktiež mikroservisná zložka v podobe **Supabase Edge Functions** (písané v TypeScript/Deno), ktoré slúžia ako chránené prostredie pre asynchrónne operácie, do ktorých nesmie mať klient priamy prístup (napr. tajné VAPID kľúče pre WebPush alebo pravidelný cron-job pre synchronizáciu obecných údajov).


---

## 2. Hlavné Funkcionality (Featúry)

Aplikácia je plne modularizovaná a rozdelená na nasledujúce funkčné časti:

### A. Autentifikácia a Správa Právnych Dokumentov
*   **Implementácia:** Postavená na **Supabase Auth** s podporou prihlásenia emailom/heslom a Google OAuth (cez prepojovací callback `/auth/callback`).
*   **Právny súhlas:** Registrácia (Sign Up) vynucuje súhlas so Všeobecnými obchodnými podmienkami (VOP) a GDPR. Právne dokumenty sú zobrazené priamo v modal okne (`LegalDocumentsDialog`). Verzia a čas súhlasu sa ukladajú priamo do meta-údajov používateľa pri registrácii.

### B. Onboarding Gate a Geografické overenie (GeoWizard)
*   **Implementácia:** Ak sa nový používateľ úspešne prihlási, systém ho presmeruje na **Onboarding Gate** (`OnboardingGate.tsx`), ktorý zamedzí prístup do hlavnej aplikácie, kým neprejde tromi krokmi:
    1.  `WelcomeScreen`: Privítanie a vysvetlenie účelu platformy.
    2.  `GeoWizard`: Interaktívny proces overenia geolokácie. Užívateľ si vyberie svoju ulicu a potvrdí dom na interaktívnej mape (OpenStreetMap/Leaflet). Toto priradí používateľovi príslušné ID obce (`municipality_id`).
    3.  `CodeActivationScreen`: Brána na zadanie pozývacieho kódu.

### C. Systém Pozývacích Kódov (Uzavretá Komunita)
*   **Implementácia:** Aplikácia vyžaduje na plnú autorizáciu (zápis príspevkov, chatovanie a pridávanie položiek do skladu) **10-miestny overovací kód**.
*   **Spôsob fungovania:**
    *   Užívateľ môže aplikáciu len prezerať v režime **len na čítanie** (Readonly), pričom je zobrazený fixný `ReadonlyBanner`.
    *   Ak užívateľ zadá validný kód (generovaný starostom obce, adminom alebo existujúcim susedom), aktivujú sa mu plné práva.
    *   Bežný aktívny užívateľ ("Sused") môže vygenerovať maximálne 5 pozývacích kódov pre ďalších susedov. Starosta a administrátori majú neobmedzený limit.
    *   Systém obsahuje administrátorský bypass kód (`ADMI.DP.77`) pre potreby miestneho vývoja a testovania.

### D. Nástenka (Komunitné Fórum)
*   **Implementácia:** Susedský bulletin board slúžiaci ako fórum pre celú obec.
*   **Sub-funkcie:**
    *   **Príspevky:** Užívatelia môžu publikovať textové príspevky s voliteľnými obrázkami. Obrázky sa pred nahraním komprimujú na klientovi a ukladajú do Supabase Storage bucketu `posts`.
    *   **Životnosť:** Príspevky môžu doomed_at (alebo expiráciu, napr. 4 dni), po ktorej sa automaticky zneviditeľnia, aby sa udržiaval čerstvý obsah.
    *   **Kategórie:** Príspevky je možné filtrovať podľa kategórií (napr. Otázka, Pomoc, Darujem, Oznam, Trash/Odpad atď.).
    *   **Komentáre:** Podpora pre písanie odpovedí v reálnom čase (`post_replies`).
    *   **Lajky:** Používatelia môžu príspevky lajkovať (`post_likes`).
    *   **Moderácia obsahu:** Možnosť nahlásiť príspevok ako nevhodný (`post_reports`), čím sa dostane do moderátorského rozhrania pre starostu/admina.

### E. Aktuality a Úradný Hlásnik (Municipal RSS Integration)
*   **Implementácia:** Špeciálna karta, ktorá agreguje dôležité oficiálne informácie pre obyvateľov.
*   **Spôsob fungovania:**
    *   **Automatická synchronizácia:** Deno Edge funkcia `fetch-municipal-events` pravidelne zoškrabáva oficiálny web obce Ružindol (RSS kanál na aktuality a Kalendár podujatí na podujatia) a ukladá dáta priamo do databázových tabuliek `announcements` a `events`.
    *   **Skupinové oznamy:** Autorizovaní administrátori skupín môžu pridávať oznamy špecifické pre záujmové/tematické skupiny vrátane možnosti nahrať **zvukovú stopu (audio oznam)**.

### F. Susedský Sklad (Zdieľaná ekonomika / Tool Sharing)
*   **Implementácia:** Modul pre výpožičku náradia, ponuku služieb či bazárový predaj v rámci susedstva (`SkladScreen.tsx`).
*   **Sub-funkcie:**
    *   **Kategórie a vyhľadávanie:** Rýchle filtrovanie položiek (Náradie, Záhrada, Domácnosť, Šport atď.) a full-text vyhľadávanie.
    *   **Typ ponuky:** Rozlíšenie medzi požičaním (s cenou/bez) a darovaním.
    *   **Dopyt po položkách:** Možnosť publikovať dopyt typu `sklad_dopyt` (napr. "Susedia, nepožičia niekto na víkend kosačku?").
    *   **Ukončenie/Expirácia:** Používateľ vie položku označiť ako vyriešenú alebo ju vymazať. Systém taktiež automaticky premazáva expirovaný skladový tovar a k nemu prislúchajúce chaty.

### G. Chat a Realtime správy
*   **Implementácia:** Súkromné správy medzi používateľmi spúšťané priamo z ponuky v Susedskom Sklade.
*   **Spôsob fungovania:**
    *   Kliknutím na "Kontaktovať" pri položke v Sklade sa vytvorí nová entita v tabuľke `chats` spájajúca kupujúceho, predávajúceho a danú položku.
    *   Používatelia si píšu cez okno `SafeChat.tsx`. Doručovanie správ funguje v **reálnom čase** (Realtime odoberanie zmeny v tabuľke `messages` cez Supabase).
    *   Možnosť vymazať celú konverzáciu priamo z prehľadu správ.

### H. Administrátorský a Moderátorský Panel
*   **Implementácia:** Komponenty `AdminPanel.tsx` a `ModerationPanel.tsx`, ktoré sa dynamicky zobrazujú len používateľom s rolou `Starosta` alebo `Admin`.
*   **Možnosti pre správu:**
    *   **Správa používateľov:** Zmena rolí (Sused, Starosta, Admin).
    *   **Blokovanie (Bannovanie):** Dočasné alebo trvalé zablokovanie užívateľov vrátane zadania odôvodnenia banu (`ban_reason`, `banned_until`). Zablokovaným užívateľom sa zobrazuje globálny `BanBanner`.
    *   **Moderovanie obsahu:** Schvaľovanie/vymazanie nahlásených príspevkov na nástenke.
    *   **Generovanie kódov:** Administrátorská správa a tvorba pozývacích kódov pre nových občanov.
    *   **Správa obcí:** Správa zapojených samospráv a obcí.

### I. WebPush Notifikačný Kanál
*   **Implementácia:** Užívatelia si môžu povoliť natívne Push notifikácie priamo v nastaveniach profilu. Klientsky prehliadač vygeneruje predplatné (Subscription), ktoré sa uloží do tabuľky `user_push_subscriptions`.
*   **Odosielanie:** Edge funkcia `send-push` odosiela správy s využitím kryptografického štandardu VAPID. Notifikácie sa odosielajú na základe dôležitých zmien v databáze (napr. nová správa v chate, dôležitý oznam starostu).


---

## 3. Komponenty a Moduly (Štruktúra kódu)

### A. Frontend / UI (Priečinok `src/`)

#### Hlavné Obrazovky (Screens - `src/screens/`)
1.  **`NastenkaScreen.tsx`**: Hlavné diskusné fórum, pridávanie príspevkov, lajkovanie, pridávanie komentárov a nahlasovanie obsahu.
2.  **`AktualityScreen.tsx`**: Kombinácia úradných oznamov z RSS, kalendára obecných podujatí a príspevkov z tematických lokálnych skupín.
3.  **`SkladScreen.tsx`**: Katalóg zdieľaného náradia a komunitného skladu, vyhľadávanie, tvorba ponúk a dopytov.
4.  **`MojeSpravyScreen.tsx`**: Prehľad aktívnych konverzácií (chatov) s ostatnými susedmi a prepojenie na konkrétne inzeráty zo skladu.
5.  **`ProfilScreen.tsx`**: Nastavenia vlastného profilu, prehľad vlastných položiek v sklade a vkladanie administratívnych widgetov pre overených správcov (Starostov/Adminov).

#### Onboarding Obrazovky (`src/screens/onboarding/`)
*   `WelcomeScreen.tsx`: Prvá uvítacia obrazovka po prihlásení.
*   `GeoWizard.tsx`: Výber obce a potvrdenie lokality na interaktívnej mape Leaflet.
*   `CodeActivationScreen.tsx`: Stránka pre zadanie 10-miestneho kódu pre aktiváciu účtu.

#### Spoločné a Feature Komponenty (`src/components/`)
*   `OnboardingGate.tsx`: Brána, ktorá filtruje nezaregistrovaných a novoprihlásených cez Welcome -> Geo -> Code Activation.
*   `AdminPanel.tsx` & `ModerationPanel.tsx`: Administratívne nástroje pre správu rolí, generovanie pozvánok, správu obcí a riešenie nahlásených príspevkov.
*   `BottomNav.tsx` & `Header.tsx`: Globálny navigačný shell (Bottom Navigation Bar optimalizovaný pre mobilné zobrazenie a záhlavie s možnosťou odhlásenia).
*   `SafeChat.tsx`: Realtime chatovacie okno ošetrené proti XSS, s načítavaním správ a podporou okamžitého odosielania.
*   `SharedCalendar.tsx`: Zobrazenie nadchádzajúcich udalostí z obecného kalendára s filtrom kategórií.
*   `ActiveNeighborBadge.tsx`: Odznak "Aktívny sused" zobrazujúci overený stav používateľa.
*   `BanBanner.tsx` & `ReadonlyBanner.tsx`: Informačné prúžky o obmedzení konta (len na čítanie, alebo ban).
*   `RealtimeNotificationBanner.tsx`: Zobrazenie in-app upozornení na dôležité udalosti.

#### Reusable UI Komponenty (`src/components/ui/`)
Kompletná sada nízkoúrovňových komponentov postavených na **Radix UI** a upravených pomocou Tailwind CSS pre zachovanie konzistentného vizuálneho dizajnu (napr. `button`, `dialog`, `input`, `tabs`, `card`, `avatar`, `badge`, `sheet`, `select` atď.).

#### Globálny Stav & Context (`src/context/`)
*   `AppModeContext.tsx`: Správa lokálneho stavu onboardingu, overenia kódov, dočasnej role a generovania pozvánok.
*   `NotificationContext.tsx`: Správa neprečítaných upozornení v aplikácii (realtime indikátory pre správy, obecné oznamy, atď.).
*   `ThemeContext.tsx`: Správa témy aplikácie (prednastavená a zamknutá na Light mode kvôli konzistencii mobilného dizajnu a eliminácii hydration chýb pri SSR).

#### Custom Hooky (`src/hooks/`)
*   `useCurrentUser.ts`: Reaktívne prepojenie na aktuálne prihláseného používateľa v Supabase. Sleduje aj to, či má používateľ rolu starosta/admin a či je aktívny sused.
*   `useIsAdmin.ts`: Pomocný hook pre rýchle overenie oprávnení na administrátorské akcie.
*   `use-mobile.tsx`: Detekcia šírky obrazovky pre responzívny rendering.

#### Utility & Pomocná Logika (`src/lib/`)
*   `compress-image.ts`: Klient-side kompresia nahraných fotiek pred uploadom na úložisko na šetrenie dát.
*   `upload-image.ts`: Priamy zápis súborov do Supabase Storage.
*   `rss-sync.ts`: Lokálne rozhranie pre plánované čistenie a aktualizáciu dát.
*   `error-capture.ts` & `error-page.ts`: Centralizované zachytávanie chýb v React aplikácii pre bezpečný pád bez zamrznutia rozhrania.


### B. Backend / API & Databáza (Priečinok `supabase/`)

#### Databázové entity a modely (16 tabuliek):
1.  **`profiles`**: Profily používateľov (id, name, email, street, municipality_id, is_active_neighbor, role, ban_reason, banned_until, updated_at).
2.  **`municipalities`**: Evidencia obcí zapojených do systému (id, name, slug, region, is_active).
3.  **`user_roles`**: Priradenie k systémovým rolám (user_id, role: app_role).
4.  **`invite_codes`**: Pozývacie kódy na overenie (id, code, created_by, used_by, status, limit, expires_at).
5.  **`posts`**: Príspevky na Nástenke (id, user_id, content, image_url, category, expires_at, created_at).
6.  **`post_replies`**: Komentáre/Odpovede na príspevky (id, post_id, user_id, content, created_at).
7.  **`post_likes`**: Lajky pod príspevkami (post_id, user_id, created_at).
8.  **`post_reports`**: Nahlásenia nevhodného obsahu (id, post_id, reporter_id, reason, status, created_at).
9.  **`warehouse_items`**: Položky v Susedskom Sklade (id, user_id, title, description, image_url, price, type, category, status).
10. **`chats`**: Konverzácie k inzerátom (id, seller_id, buyer_id, item_id, created_at).
11. **`messages`**: Jednotlivé správy v chatoch (id, chat_id, sender_id, text, created_at, is_read).
12. **`announcements`**: Agregované obecné oznamy z RSS/webu obce (id, title, content, link, priority, published_at, source, audio_path, audio_url).
13. **`events`**: Agregované podujatia z kalendára obce (id, title, description, starts_at, ends_at, location, type, image_url, source_url).
14. **`event_attendees`**: Prihlásenie susedov na obecné podujatia (event_id, user_id, created_at).
15. **`group_announcements`**: Oznamy špecifické pre tematické/záujmové skupiny (id, group_key, author_id, content, audio_url, created_at).
16. **`group_admins`**: Správcovia tematických podskupín (id, group_key, user_id, created_at).

#### Supabase Edge Functions (Deno Serverless):
1.  **`fetch-municipal-events`**: Cron-job edge funkcia, ktorá pravidelne sťahuje RSS (`https://www.ruzindol.sk/?rss=200`) a kalendár (`https://www.ruzindol.sk/obcan/kalendar-podujati/`), parsuje HTML, čistí tagy a ukladá dáta do DB.
2.  **`send-push`**: Odosielateľ push správ pre prehliadače s integráciou WebPush a VAPID kľúčov. Reaguje na databázové triggre (webhooky) pri dôležitých udalostiach.
3.  **`delete-account`**: Bezpečné zmazanie profilu a všetkých prepojených dát (kaskádové čistenie príspevkov, inzerátov, chatov a push registrácií).

---

## 4. Integrácie tretích strán

Aplikácia efektívne spája niekoľko externých služieb a rozhraní:

1.  **Supabase Platform (BaaS):**
    *   **Postgres Databáza** pre ukladanie štruktúrovaných dát a relácií.
    *   **Supabase Realtime** pre okamžité chatovanie bez nutnosti neustáleho dopytovania (polling).
    *   **Supabase Storage** pre ukladanie fotiek k inzerátom a príspevkom.
    *   **Supabase Auth** pre správu používateľských relácií, registráciu, verifikáciu emailov a OAuth (Google).
2.  **Web obce Ružindol (www.ruzindol.sk):**
    *   Integrácia prostredníctvom RSS feedu a asynchrónneho scrapovania webového kalendára podujatí na pozadí, vďaka čomu majú obyvatelia v aplikácii stále aktuálne úradné informácie.
3.  **Mapy OpenStreetMap / Leaflet API:**
    *   Zobrazenie interaktívnych mapových podkladov pre overenie adresy obyvateľa počas Geo-onboardingu bez poplatkov za komerčné mapy.
4.  **Web Push API & VAPID:**
    *   Natívne push notifikácie integrované priamo do operačných systémov (mobilné zariadenia, desktopy) prostredníctvom klientskeho Service Workera.


---

## 5. Stav vývoja & Čo chýba / TODO

### Kompletne dokončené a plne funkčné časti:
*   [x] **Základná kostra a Smerovanie:** Smerovanie pomocou TanStack Router je nakonfigurované, typovo bezpečné a automaticky generované.
*   [x] **Registrácia a Prihlásenie:** Autentifikačný flow (Email, Google OAuth) je kompletne hotový vrátane schválenia licenčných podmienok.
*   [x] **Kompletný Onboarding:** Geografický sprievodca s mapou (GeoWizard) a aktivácia profilu pozývacím kódom sú plne funkčné.
*   [x] **Susedský Sklad (Tool Sharing):** Vkladanie položiek, dopyty, filtrácia kategórií, vyhľadávanie a mazanie expirovaného materiálu funguje bezchybne.
*   [x] **Nástenka a Fórum:** Publikovanie príspevkov, obrázkov (vrátane automatickej kompresie), pridávanie komentárov v reálnom čase, lajkovanie a moderátorský report systém.
*   [x] **Chat a Realtime správy:** Súkromné správy medzi susedmi bežia v reálnom čase vďaka integrácii Supabase Realtime a čistia sa pri zmazaní položky.
*   [x] **Scraping a Synchronizácia oznamov:** Edge funkcia na sťahovanie obecných informácií z Ružindola a ich ukladanie do DB.
*   [x] **Administrátorské panely:** Správa používateľov, prideľovanie a odoberanie rolí (Starosta/Admin), dočasné/trvalé blokovanie (bannovanie) s odôvodnením, generovanie pozvánok, správa nahlásených príspevkov.
*   [x] **Push notifikácie:** Odosielanie WebPush správ pomocou Edge funkcie na základe databázových zmien.

### Rozpracované časti, technický dlh a odporúčania na zlepšenie (Čo chýba / TODO):
Aplikácia je vo vysoko stabilnom a ucelenom stave. V kóde sa nenachádzajú žiadne rozpracované inline `TODO` ani `FIXME` značky, no na základe analýzy a predchádzajúceho technického auditu boli identifikované nasledujúce oblasti na zlepšenie:

1.  **Prepnutie navigácie z parametrov (Query Params) na samostatné Trasy (Route-driven URL):**
    *   *Súčasný stav:* Prechod medzi hlavnými obrazovkami (Nástenka, Sklad, Profil, Správy) je riešený pomocou zmeny search parametra `tab` v URL adrese (napr. `/?tab=sklad`).
    *   *Odporúčanie:* Migrovať tieto taby na skutočné cesty v TanStack Routeri (napr. `/nastenka`, `/aktuality`, `/sklad`, `/spravy`, `/profil`). To umožní natívny prehliadačový flow histórie (tlačidlo späť), deep-linking (možnosť poslať susedovi priamy odkaz na inzerát v sklade) a čistejší kód v `src/routes/_authenticated/index.tsx`.
2.  **Lokalizácia pre viacero obcí (Multi-municipality scaling):**
    *   *Súčasný stav:* Databázový model a štruktúra sú pripravené na viacero obcí (`municipalities` tabuľka), no parsovanie RSS a kalendára v Edge funkcii `fetch-municipal-events` je zatiaľ natvrdo napojené len na oficiálny web obce Ružindol.
    *   *Odporúčanie:* Zovšeobecniť scraper tak, aby dokázal dynamicky čítať RSS kanály a adresy kalendárov z tabuľky `municipalities` pre každú aktívnu obec samostatne.
3.  **PWA (Progressive Web App) inštalácia:**
    *   *Súčasný stav:* V kóde existuje hook `usePwaInstall.ts`, no pre komplexnú a bezproblémovú inštaláciu PWA na zariadeniach iOS/Android je potrebné doriešiť plnohodnotný Service Worker manifest a offline asset caching, aby aplikácia fungovala spoľahlivo aj pri slabom pripojení.

