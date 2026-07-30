import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";

import { Header } from "@/components/Header";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ReadonlyBanner } from "@/components/ReadonlyBanner";
import { FullscreenAlert } from "@/components/FullscreenAlert";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeTab = useMemo<Tab>(() => {
    const value = search.tab;
    if (!value) return "nastenka";
    return TAB_ORDER.includes(value as Tab) ? (value as Tab) : "nastenka";
  }, [search.tab]);
  const [direction, setDirection] = useState<1 | -1>(1);
  const { profile, error: userLoadError } = useCurrentUser();
  const {
    hasBellDot,
    hasMessageUnread,
    hasOfficialUnread,
    clearMessageUnread,
    clearOfficialUnread,
  } = useNotifications();

  function changeTab(next: Tab) {
    if (next === activeTab) return;
    const from = TAB_ORDER.indexOf(activeTab);
    const to = TAB_ORDER.indexOf(next);
    setDirection(to >= from ? 1 : -1);
    navigate({
      search: (prev) => ({ ...prev, tab: next }),
      replace: false,
    });
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

  useEffect(() => {
    if (activeTab === "spravy") clearMessageUnread();
    if (activeTab === "nastenka") clearOfficialUnread();
  }, [activeTab, clearMessageUnread, clearOfficialUnread]);

  return (
    <div className="bg-app-shell flex min-h-screen items-center justify-center p-0 md:p-6">
      <div className="glass-panel relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden shadow-2xl md:h-[820px] md:rounded-[2.25rem]">
        <OnboardingGate>
          <Header
            profile={profile}
            hasNotificationDot={hasBellDot}
            onBellClick={handleBellClick}
          />
          {userLoadError && (
            <div className="mx-3 mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 md:mx-4">
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
          <BottomNav activeTab={activeTab} onTabChange={changeTab} />
          <FullscreenAlert />
        </OnboardingGate>
      </div>
    </div>
  );
}
