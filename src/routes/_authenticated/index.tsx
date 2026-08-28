import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Download, PlusSquare, Share2, X } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav, NAV_TABS, type Tab } from "@/components/BottomNav";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ReadonlyBanner } from "@/components/ReadonlyBanner";
import { FullscreenAlert } from "@/components/FullscreenAlert";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useNotifications } from "@/context/NotificationContext";
import { runStartupContentSync } from "@/lib/startup-sync";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/nastenka" });
  },
});

const TAB_ORDER: Tab[] = ["nastenka", "aktuality", "sklad", "spravy", "profil", "susedia"];
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 300;
const FIRST_INSTALL_BANNER_KEY = "komunita.pwa.install.firstLaunchBannerDismissed.v1";

function ScreenFallback() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-sm text-neutral-500">
      Načítavam obsah...
    </div>
  );
}

function tabFromPath(pathname: string): Tab {
  const tab = pathname.split("/").filter(Boolean).at(-1);
  return TAB_ORDER.includes(tab as Tab) ? (tab as Tab) : "nastenka";
}

export function AuthenticatedShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = tabFromPath(location.pathname);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showFirstInstallBanner, setShowFirstInstallBanner] = useState(false);

  const { profile, error: userLoadError } = useCurrentUser();
  const {
    hasBellDot,
    hasMessageUnread,
    hasOfficialUnread,
    clearMessageUnread,
    clearOfficialUnread,
  } = useNotifications();
  const {
    canInstall,
    canShowIosHint,
    isInstalled,
    isPrompting,
    promptInstall,
    dismissIosInstallHint,
  } = usePwaInstall();

  function changeTab(next: Tab) {
    if (next === activeTab) return;
    const from = TAB_ORDER.indexOf(activeTab);
    const to = TAB_ORDER.indexOf(next);
    setDirection(to >= from ? 1 : -1);

    void navigate({ to: `/${next}` });
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    const idx = TAB_ORDER.indexOf(activeTab);
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY) {
      if (idx < TAB_ORDER.length - 1) changeTab(TAB_ORDER[idx + 1]);
    } else if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) {
      if (idx > 0) changeTab(TAB_ORDER[idx - 1]);
    }
  }

  function handleBellClick() {
    if (hasMessageUnread) {
      clearMessageUnread();
      changeTab("spravy");
      return;
    }
    if (hasOfficialUnread) {
      clearOfficialUnread();
      changeTab("nastenka");
    }
  }

  function handleInstallClick() {
    void promptInstall();
  }

  function dismissFirstInstallBanner() {
    window.localStorage.setItem(FIRST_INSTALL_BANNER_KEY, "1");
    setShowFirstInstallBanner(false);
  }

  useEffect(() => {
    if (activeTab === "spravy") clearMessageUnread();
    if (activeTab === "nastenka") clearOfficialUnread();
  }, [activeTab, clearMessageUnread, clearOfficialUnread]);

  useEffect(() => {
    runStartupContentSync();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInstalled) {
      setShowFirstInstallBanner(false);
      return;
    }

    setShowFirstInstallBanner(window.localStorage.getItem(FIRST_INSTALL_BANNER_KEY) !== "1");
  }, [isInstalled]);

  return (
    <div className="bg-app-shell min-h-screen xl:h-screen xl:overflow-hidden">
      <OnboardingGate>
        <div className="mx-auto flex min-h-screen w-full md:max-w-3xl md:px-4 md:py-4 lg:max-w-4xl xl:h-screen xl:max-w-none xl:gap-6 xl:px-6 xl:py-6">
          <aside className="glass-panel hidden h-full w-[248px] shrink-0 flex-col rounded-[2rem] p-4 xl:flex">
            <div className="mb-4 px-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Navigácia
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                Ružindol
              </h2>
            </div>
            <BottomNav
              activeTab={activeTab}
              layout="sidebar"
              className="flex-1"
            />
            <div className="app-surface-muted mt-4 rounded-2xl px-3 py-2 text-[11px] text-muted-foreground">
              Zobrazenie pre desktop. Prepínaj sekcie v ľavom paneli.
            </div>
          </aside>

          <div className="glass-panel relative flex h-[100dvh] w-full flex-col overflow-hidden shadow-2xl md:h-[calc(100dvh-2rem)] md:rounded-[2.25rem] xl:h-full xl:min-w-0 xl:flex-1 xl:rounded-[2rem]">
            <div className="pt-safe xl:pt-0">
              <Header
                profile={profile}
                hasNotificationDot={hasBellDot}
                onBellClick={handleBellClick}
                canInstall={canInstall || canShowIosHint}
                installBusy={isPrompting}
                onInstallClick={handleInstallClick}
                subtitle="Komunitné centrum"
                className="mx-3 mt-2 md:mx-4 md:mt-3 xl:mx-5 xl:mt-5"
              />
            </div>
            {showFirstInstallBanner && (
              <div className="mx-3 mt-2 md:mx-4 xl:mx-5">
                <div className="airy-panel relative overflow-hidden rounded-[1.75rem] px-4 py-3 text-sm text-foreground">
                  <button
                    type="button"
                    onClick={dismissFirstInstallBanner}
                    className="header-action-button absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
                    aria-label="Zavrieť upozornenie na inštaláciu"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-start gap-3 pr-8">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand/15 to-brand-glow/20 text-brand">
                      <Download size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tracking-tight">Inštalácia aplikácie</p>
                      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                          Pridajte si komunitu na plochu. Otvorí sa ako samostatná aplikácia a bude vždy po ruke.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {canInstall && (
                          <button
                            type="button"
                            onClick={handleInstallClick}
                            disabled={isPrompting}
                            className="btn-primary-glow inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          >
                            <Download size={15} />
                            {isPrompting ? "Spúšťam inštaláciu..." : "Inštalovať"}
                          </button>
                        )}
                        {canShowIosHint && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-2 text-[12px] font-medium text-brand">
                            <Share2 size={14} /> Zdieľať → Pridať na plochu
                          </span>
                        )}
                        {!canInstall && !canShowIosHint && (
                          <span className="rounded-full bg-[color:var(--bg-muted)] px-3 py-2 text-[12px] font-medium text-muted-foreground">
                            Tlačidlo sa zobrazí, keď ho prehliadač sprístupní.
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={dismissFirstInstallBanner}
                          className="rounded-full border border-[color:var(--border-card)] px-4 py-2 text-[12px] font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          Nabudúce
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {canShowIosHint && !showFirstInstallBanner && (
              <div className="mx-3 mt-2 md:mx-4 xl:mx-5">
                <div className="airy-panel relative overflow-hidden rounded-[1.75rem] px-4 py-3 text-sm text-foreground">
                  <button
                    type="button"
                    onClick={dismissIosInstallHint}
                    className="header-action-button absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
                    aria-label="Zavrieť návod na inštaláciu"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-start gap-3 pr-8">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand/15 to-brand-glow/20 text-brand">
                      <Share2 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold tracking-tight">Pridajte aplikáciu na plochu</p>
                      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                        Pre inštaláciu aplikácie kliknite na ikonu Zdieľať a vyberte Pridať na plochu.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[12px] font-medium text-brand">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1">
                          <Share2 size={14} /> Zdieľať
                        </span>
                        <span className="text-muted-foreground">potom</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1">
                          <PlusSquare size={14} /> Pridať na plochu
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {userLoadError && (
              <div className="mx-3 mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 md:mx-4 xl:mx-5">
                {userLoadError}
              </div>
            )}
            <ReadonlyBanner />
            <main className="relative flex-1 overflow-hidden">
              <AnimatePresence initial={false} mode="wait" custom={direction}>
                <motion.div
                  key={activeTab}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -24 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  drag="x"
                  dragDirectionLock
                  dragElastic={0.15}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={handleDragEnd}
                  className="absolute inset-0 overflow-y-auto touch-pan-y"
                >
                  <Suspense fallback={<ScreenFallback />}>
                    <Outlet />
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
            <BottomNav
              activeTab={activeTab}
              className="sticky bottom-0 mx-3 mb-2 md:mx-4 md:mb-3 xl:hidden"
            />
            <FullscreenAlert />
          </div>
        </div>
      </OnboardingGate>
    </div>
  );
}