# Analýza štruktúry priečinka src

Dátum: 2026-07-18

## 1) Koreň priečinka src

- assets/
- components/
- context/
- hooks/
- integrations/
- lib/
- routes/
- screens/
- types/
- router.tsx
- routeTree.gen.ts
- server.ts
- start.ts
- styles.css

### Strom priečinka src (prehľad)

```text
src/
  assets/
    ruzindol-erb.png
  components/
    ActiveNeighborBadge.tsx
    AdminPanel.tsx
    BanBanner.tsx
    BottomNav.tsx
    FullscreenAlert.tsx
    Header.tsx
    ImageInput.tsx
    InviteRedeemSection.tsx
    ModerationPanel.tsx
    NearbyCatalog.tsx
    NeighborhoodPulse.tsx
    OnboardingGate.tsx
    PostLightbox.tsx
    ReadonlyBanner.tsx
    RealtimeNotificationBanner.tsx
    RolePanels.tsx
    SafeChat.tsx
    SharedCalendar.tsx
    Splash.tsx
    ui/
      accordion.tsx
      alert-dialog.tsx
      alert.tsx
      aspect-ratio.tsx
      avatar.tsx
      badge.tsx
      breadcrumb.tsx
      button.tsx
      calendar.tsx
      card.tsx
      carousel.tsx
      chart.tsx
      checkbox.tsx
      collapsible.tsx
      command.tsx
      context-menu.tsx
      dialog.tsx
      drawer.tsx
      dropdown-menu.tsx
      form.tsx
      hover-card.tsx
      input-otp.tsx
      input.tsx
      label.tsx
      menubar.tsx
      navigation-menu.tsx
      pagination.tsx
      popover.tsx
      progress.tsx
      radio-group.tsx
      resizable.tsx
      scroll-area.tsx
      select.tsx
      separator.tsx
      sheet.tsx
      sidebar.tsx
      skeleton.tsx
      slider.tsx
      sonner.tsx
      switch.tsx
      table.tsx
      tabs.tsx
      textarea.tsx
      toggle-group.tsx
      toggle.tsx
      tooltip.tsx
  context/
    AppModeContext.tsx
    NotificationContext.tsx
    ThemeContext.tsx
  hooks/
    use-mobile.tsx
    useCurrentUser.ts
    useIsAdmin.ts
  integrations/
    lovable/ (prázdny)
    supabase/
      auth-attacher.ts
      client.ts
      types.ts
  lib/
    compress-image.ts
    error-capture.ts
    error-page.ts
    rss-sync.ts
    upload-image.ts
    utils.ts
  routes/
    __root.tsx
    auth.tsx
    README.md
    reset-password.tsx
    _authenticated/
      index.tsx
      route.tsx
    auth/
      callback.tsx
  screens/
    AktualityScreen.tsx
    MojeSpravyScreen.tsx
    NastenkaScreen.tsx
    ProfilScreen.tsx
    SkladScreen.tsx
    onboarding/
      CodeActivationScreen.tsx
      GeoWizard.tsx
      WelcomeScreen.tsx
  types/
    index.ts
  router.tsx
  routeTree.gen.ts
  server.ts
  start.ts
  styles.css
```

## 2) Stručný obsah dôležitých priečinkov

### components/
- Feature komponenty aplikácie (panely, bannery, navigácia, onboarding časti, kalendár, chat, atď.).
- Reusable UI knižnica je v components/ui/ (button, dialog, input, tabs, table, tooltip, atď.).

### context/
- React contexty pre globálny stav:
- AppModeContext.tsx
- NotificationContext.tsx
- ThemeContext.tsx

### hooks/
- Custom hooky pre klientsku logiku:
- useCurrentUser.ts (načítanie aktuálneho používateľa/profilu cez Supabase)
- useIsAdmin.ts
- use-mobile.tsx

### integrations/
- Integrácie externých služieb.
- integrations/supabase/ obsahuje hlavné súbory pre Supabase:
  - client.ts: inicializácia a konfigurácia Supabase klienta
  - auth-attacher.ts: middleware na pripojenie Authorization tokenu
  - types.ts: typy databázovej schémy
- integrations/lovable/ je momentálne prázdny.

### lib/
- Pomocné utility a technická logika:
- upload/compress obrázkov
- error capture + render error stránky
- rss-sync.ts (RSS synchronizácia a zápis/čistenie announcement dát cez Supabase)
- všeobecné util funkcie

### routes/
- Definície trás (TanStack Router) a auth flow:
- __root.tsx, auth.tsx, reset-password.tsx
- auth/callback.tsx
- _authenticated/route.tsx a _authenticated/index.tsx
- routeTree.gen.ts je generovaný strom trás.

### screens/
- Hlavné obrazovky aplikácie:
- AktualityScreen.tsx
- MojeSpravyScreen.tsx
- NastenkaScreen.tsx
- ProfilScreen.tsx
- SkladScreen.tsx
- onboarding/ obsahuje onboarding obrazovky (Welcome, GeoWizard, CodeActivation).

### types/
- Zdieľané TypeScript typy (index.ts).

## 3) Kde sú komponenty, API volania a Supabase logika

- Komponenty: components/ a components/ui/.
- API/dátové volania: najmä v hooks/ a lib/ (napr. useCurrentUser.ts, rss-sync.ts).
- Supabase logika:
  - integrations/supabase/client.ts (klient)
  - integrations/supabase/auth-attacher.ts (auth middleware)
  - integrations/supabase/types.ts (DB typy)
  - zapojenie middleware v start.ts
