import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CodeActivationScreen } from "@/screens/onboarding/CodeActivationScreen";

export function ReadonlyBanner() {
  const { profile, loading, refresh } = useCurrentUser();
  const [open, setOpen] = useState(false);
  if (loading || !profile || profile.is_active_neighbor) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mx-3 mt-2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-left text-xs text-amber-900 shadow-sm backdrop-blur"
      >
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">
          Režim čítania · zadaj pozývací kód a odomkni pridávanie príspevkov.
        </span>
        <span className="rounded-full bg-amber-900 px-2 py-0.5 text-[10px] font-semibold text-amber-50">
          Aktivovať
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="absolute inset-0 z-40"
          >
            <CodeActivationScreen
              onClose={() => setOpen(false)}
              onActivated={async () => {
                await refresh();
                setOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function ReadonlyLock({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
    >
      <Lock className="h-3 w-3" /> Odomknúť
    </button>
  );
}

export { X };
