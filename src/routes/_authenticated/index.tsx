import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Bell } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav, NAV_TABS, type Tab } from "@/components/BottomNav";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ReadonlyBanner } from "@/components/ReadonlyBanner";
import { FullscreenAlert } from "@/components/FullscreenAlert";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useNotifications } from "@/context/NotificationContext";

const NastenkaScreen = lazy(async () => {
  const module = await import("@/screens/NastenkaScreen");
  return { default: module.NastenkaScreen };
});

const SkladScreen = lazy(async () => {
  const module = await import("@/screens/SkladScreen");
  return { default: module.SkladScreen };
});

const ProfilScreen = lazy(async () => {
  const module = await import("@/screens/ProfilScreen");
  return { default: module.ProfilScreen };
});

const AktualityScreen = lazy(async () => {
  const module = await import("@/screens/AktualityScreen");
  return { default: module.AktualityScreen };
});

const MojeSpravyScreen = lazy(async () => {
  const module = await import("@/screens/MojeSpravyScreen");
  return { default: module.MojeSpravyScreen };
});

type Search = {
  tab?: string;
};

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Search) => search,
  component: Index,
});

const TAB_ORDER: Tab[] = ["nastenka", "aktuality", "sklad", "spravy", "profil"];
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 300;

function ScreenFallback() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-sm text-neutral-500">
      Načítavam obsah...
    </div>
  );
}

function Index() {
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();

  const initialTab = useMemo<Tab>(() => {
    const value = search.tab;
    if (!value) return "nastenka";
    return TAB_ORDER.includes(value as Tab) ? (value as Tab) : "nastenka";
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [direction, setDirection] = useState<1 | -1>(1);

  const { profile, error: userLoadError } = useCurrentUser();
  const {
    hasBellDot,
    hasMessageUnread,
    hasOfficialUnread,
    clearMessageUnread,
    clearOfficialUnread,
  } = useNotifications();
  const { canInstall, isPrompting, promptInstall } = usePwaInstall();

  function changeTab(next: Tab) {
    if (next === activeTab) return;
    const from = TAB_ORDER.indexOf(activeTab);
    const to = TAB_ORDER.indexOf(next);
    setDirection(to >= from ? 1 : -1);

    setActiveTab(next);

    try {
      navigate({
        search: (prev: Search) => ({ ...prev, tab: next }),
        replace: true,
      });
    } catch {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    }
  }

  useEffect(() => {
    if (search.tab && TAB_ORDER.includes(search.tab as Tab)) {
      setActiveTab(search.tab as Tab);
    }
  }, [search.tab]);

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

  useEffect(() => {
    if (activeTab === "spravy") clearMessageUnread();
    if (activeTab === "nastenka") clearOfficialUnread();
  }, [activeTab, clearMessageUnread, clearOfficialUnread]);

  const activeTabMeta = useMemo(() => NAV_TABS.find((tab) => tab.id === activeTab), [activeTab]);

  return (
    <div className="bg-app-shell min-h-screen xl:h-screen xl:overflow-hidden">
      <OnboardingGate>
        <div className="mx-auto flex min-h-screen w-full md:max-w-3xl md:px-4 md:py-4 lg:max-w-4xl xl:h-screen xl:max-w-7xl xl:gap-6 xl:px-6 xl:py-6">
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
              onTabChange={changeTab}
              layout="sidebar"
              className="flex-1"
            />
            <div className="mt-4 rounded-2xl border border-border/70 bg-white/65 px-3 py-2 text-[11px] text-muted-foreground">
              Zobrazenie pre desktop. Prepínaj sekcie v ľavom paneli.
            </div>
          </aside>

          <div className="glass-panel relative flex h-[100dvh] w-full flex-col overflow-hidden shadow-2xl md:h-[calc(100dvh-2rem)] md:rounded-[2.25rem] xl:h-full xl:min-w-0 xl:flex-1 xl:rounded-[2rem]">
            <div className="pt-safe xl:pt-0">
              <Header
                profile={profile}
                hasNotificationDot={hasBellDot}
                onBellClick={handleBellClick}
                canInstall={canInstall}
                installBusy={isPrompting}
                onInstallClick={handleInstallClick}
                subtitle="Komunitné centrum"
                className="mx-3 mt-2 md:mx-4 md:mt-3 xl:mx-5 xl:mt-5"
              />
            </div>
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
                    {activeTab === "nastenka" && <NastenkaScreen />}
                    {activeTab === "aktuality" && <AktualityScreen />}
                    {activeTab === "sklad" && <SkladScreen />}
                    {activeTab === "spravy" && <MojeSpravyScreen />}
                    {activeTab === "profil" && <ProfilScreen />}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
            <BottomNav
              activeTab={activeTab}
              onTabChange={changeTab}
              className="sticky bottom-0 mx-3 mb-2 md:mx-4 md:mb-3 xl:hidden"
            />
            <FullscreenAlert />
          </div>

          <aside className="glass-panel hidden h-full w-[300px] shrink-0 flex-col gap-3 rounded-[2rem] p-4 xl:flex">
            <div className="rounded-2xl border border-border/70 bg-white/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Aktívna sekcia
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {activeTabMeta?.label ?? "Nástenka"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleBellClick}
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/70 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-white"
            >
              <span>Notifikácie</span>
              <span className="relative">
                <Bell size={16} />
                {hasBellDot && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </span>
            </button>

            <div className="rounded-2xl border border-border/70 bg-white/65 px-3 py-2 text-xs text-muted-foreground">
              Pre mobilné zariadenia je k dispozícii spodná navigácia. Na desktope je nahradená
              bočným panelom.
            </div>
          </aside>
        </div>
      </OnboardingGate>
    </div>
  );
}