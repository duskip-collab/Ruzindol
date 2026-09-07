import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { enableNotifications } from "@/lib/push";

interface NotificationBellTipProps {
  hasNotificationDot: boolean;
  onBellClick: () => void;
  className?: string;
}

const STORAGE_KEY = "notification_tip_dismissed";
const PULSE_ANIMATION = `
  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.6), 
                  0 0 20px rgba(16, 185, 129, 0.3);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.8), 
                  0 0 32px rgba(16, 185, 129, 0.4);
      transform: scale(1.15);
    }
  }
  
  @keyframes bounce-subtle {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }
`;

export function NotificationBellTip({
  hasNotificationDot,
  onBellClick,
  className,
}: NotificationBellTipProps) {
  const [showTip, setShowTip] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Skontrolovať localStorage pri prvom načítaní
    const isDismissed = localStorage.getItem(STORAGE_KEY);
    if (!isDismissed && !hasNotificationDot) {
      setShowTip(true);
    }
  }, [hasNotificationDot]);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setShowTip(false);
  }

  async function handleBellClick() {
    localStorage.setItem(STORAGE_KEY, "true");
    setShowTip(false);
    try {
      await enableNotifications();
    } catch (error) {
      console.error("Chyba pri registrácii push notifikácií:", error);
    }
    onBellClick();
  }

  if (!isMounted) return null;

  return (
    <>
      <style>{PULSE_ANIMATION}</style>

      {/* Pulzujúca bodka indikátora - viditeľná len ak nie sú notifikácie povolené */}
      {showTip && !hasNotificationDot && (
        <div
          className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center"
          style={{
            animation: "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        >
          <div className="absolute h-3 w-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500" />
          <div className="absolute h-3 w-3 rounded-full bg-emerald-400 opacity-75 blur-sm" />
        </div>
      )}

      {/* Zvonček tlačidlo */}
      <button
        type="button"
        onClick={handleBellClick}
        className={cn(
          "header-action-button relative grid h-10 w-10 place-items-center rounded-full shadow-sm transition-all active:scale-95",
          "hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400/50",
          className,
        )}
        aria-label="Notifikácie"
        style={
          showTip && !hasNotificationDot
            ? {
                animation: "bounce-subtle 2.5s ease-in-out infinite",
              }
            : undefined
        }
      >
        <Bell size={17} strokeWidth={2} />

        {/* Červená bodka - signalizuje neprečítané správy */}
        {hasNotificationDot && (
          <span className="absolute right-[0.7rem] top-[0.7rem] h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </button>

      {/* Tooltip / Nápoveda bubble */}
      {showTip && !hasNotificationDot && (
        <div className="pointer-events-none absolute bottom-full right-0 mb-3 z-50">
          <div className="relative">
            {/* Bubble */}
            <div className="relative w-72 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-xl border border-emerald-200/60 dark:from-emerald-950 dark:to-teal-950 dark:border-emerald-700/60 pointer-events-auto">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-700 transition-colors"
                aria-label="Zatvoriť nápovedu"
              >
                <X size={14} strokeWidth={3} />
              </button>

              {/* Text */}
              <div className="pr-6">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  🔔 Povolte notifikácie
                </p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Kliknutím na zvonček povolíte notifikácie a budete dostávať príspevky
                  od susedov priamo do svojho zariadenia.
                </p>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleBellClick}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:scale-105 transition-all active:scale-95"
              >
                Kliknúť a povoliť 📲
              </button>

              {/* Arrow pointing to bell (zarovnaná doprava priamo pod ikonu zvončeka) */}
              <div
                className="absolute right-6 -bottom-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-emerald-50 dark:border-t-emerald-950"
                style={{
                  filter: "drop-shadow(0 -1px 0 rgba(16, 185, 129, 0.2))",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}