import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Eye, KeyRound } from "lucide-react";
import { useAppMode } from "@/context/AppModeContext";
import { WelcomeScreen } from "@/screens/onboarding/WelcomeScreen";
import { GeoWizard } from "@/screens/onboarding/GeoWizard";
import { CodeActivationScreen } from "@/screens/onboarding/CodeActivationScreen";

type Phase = "welcome" | "geo" | "gate" | "app";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { onboarded, isVerified } = useAppMode();
  const [phase, setPhase] = useState<Phase>(onboarded ? "app" : "welcome");
  const [showActivation, setShowActivation] = useState(false);
  const canUseDom = typeof document !== "undefined";

  useEffect(() => {
    if (onboarded) {
      setPhase("app");
    }
  }, [onboarded]);

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <WelcomeScreen onNext={() => setPhase("geo")} />
          </motion.div>
        )}
        {phase === "geo" && (
          <motion.div
            key="geo"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute inset-0"
          >
            <GeoWizard onDone={() => setPhase("gate")} />
          </motion.div>
        )}
        {phase === "gate" && !isVerified && !showActivation && (
          <motion.div
            key="gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <PostGeoLanding
              onEnterCode={() => setShowActivation(true)}
              onSkip={() => setPhase("app")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "app" && (
        <div className="relative flex h-full flex-col">{children}</div>
      )}

      {canUseDom &&
        createPortal(
          <AnimatePresence>
            {showActivation && (
              <motion.div
                key="activation-modal"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 260 }}
                className="fixed inset-0 z-[110]"
              >
                <CodeActivationScreen
                  onClose={() => {
                    setShowActivation(false);
                    if (phase === "gate") setPhase("app");
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function PostGeoLanding({
  onEnterCode,
  onSkip,
}: {
  onEnterCode: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-neutral-50 to-neutral-100 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-md">
        <KeyRound className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Máš pozývací kód?</h2>
        <p className="mt-2 max-w-xs text-sm text-neutral-600">
          Komunita je uzavretá — potrebuješ 10-znakový kód od suseda alebo
          starostu, aby si mohol pridávať príspevky.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          onClick={onEnterCode}
          className="rounded-2xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-md"
        >
          Zadať pozývací kód
        </button>
        <button
          onClick={onSkip}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700"
        >
          <Eye className="h-4 w-4" /> Prezerať bez prihlásenia
        </button>
      </div>
      <p className="text-[11px] text-neutral-400">
        Prezeranie je len na čítanie. Nemôžeš pridávať ani písať správy.
      </p>
    </div>
  );
}
