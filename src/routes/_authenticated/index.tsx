import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";

import { Header } from "@/components/Header";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { NastenkaScreen } from "@/screens/NastenkaScreen";
import { SkladScreen } from "@/screens/SkladScreen";
import { ProfilScreen } from "@/screens/ProfilScreen";
import { AktualityScreen } from "@/screens/AktualityScreen";
import { MojeSpravyScreen } from "@/screens/MojeSpravyScreen";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ReadonlyBanner } from "@/components/ReadonlyBanner";
import { FullscreenAlert } from "@/components/FullscreenAlert";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

const TAB_ORDER: Tab[] = ["nastenka", "aktuality", "sklad", "spravy", "profil"];
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 300;

function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("nastenka");
  const [direction, setDirection] = useState<1 | -1>(1);
  const { profile } = useCurrentUser();

  function changeTab(next: Tab) {
    const from = TAB_ORDER.indexOf(activeTab);
    const to = TAB_ORDER.indexOf(next);
    setDirection(to >= from ? 1 : -1);
    setActiveTab(next);
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

  return (
    <div className="bg-app-shell flex min-h-screen items-center justify-center p-0 md:p-6">
      <div className="glass-panel relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden shadow-2xl md:h-[820px] md:rounded-[2.25rem]">
        <OnboardingGate>
          <Header profile={profile} />
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
                {activeTab === "nastenka" && <NastenkaScreen />}
                {activeTab === "aktuality" && <AktualityScreen />}
                {activeTab === "sklad" && <SkladScreen />}
                {activeTab === "spravy" && <MojeSpravyScreen />}
                {activeTab === "profil" && <ProfilScreen />}
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
