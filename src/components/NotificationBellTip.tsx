import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { enableNotifications } from "@/lib/push";

interface NotificationBellTipProps {
  hasNotificationDot: boolean;
  onBellClick: () => void;
  className?: string;
}

const STORAGE_KEY = "notification_tip_dismissed";

// Optimized animations with reduced motion support
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
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-6px);
    }
  }

  /* Jemné zatrasenie preškrtnutého zvončeka (notifikácie nie sú zapnuté) */
  @keyframes bell-shake {
    0%, 62%, 100% {
      transform: rotate(0deg);
    }
    64% { transform: rotate(-14deg); }
    66% { transform: rotate(12deg); }
    68% { transform: rotate(-10deg); }
    70% { transform: rotate(8deg); }
    72% { transform: rotate(-6deg); }
    74% { transform: rotate(4deg); }
    76% { transform: rotate(-2deg); }
    78% { transform: rotate(0deg); }
  }

  /* Respect prefers-reduced-motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export function NotificationBellTip({
  hasNotificationDot,
  onBellClick,
  className,
}: NotificationBellTipProps) {
  // Stav sa inicializuje priamo pri prvom renderi (klientská SPA), preto nie je potrebný
  // efekt, ktorý by synchronne nastavoval stav (react-hooks/set-state-in-effect).
  const [showTip, setShowTip] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn("localStorage nie je dostupný:", error);
      return true;
    }
  });
  const [isMounted, setIsMounted] = useState(() => typeof window !== "undefined");

  // Kontrola stavu notifikácií pri štarte aplikácie (lazy init pri prvom renderi)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [tipManuallyOpened, setTipManuallyOpened] = useState(false);
  const notificationsEnabled = permission === "granted";

  function refreshPermission() {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }

  // Opätovná kontrola pri návrate do aplikácie (prepínanie okna / návrat z pozadia)
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") refreshPermission();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDismiss() {
    setShowTip(false);
    setTipManuallyOpened(false);
    // Safe localStorage write
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (error) {
      console.warn("Nepodarilo sa uložiť stav nápovedy:", error);
    }
  }

  // CTA v nápovede: vždy sa pokúsi zapnúť notifikácie (pôvodná logika)
  async function handleEnableFromTip() {
    // Close tip immediately for better UX
    setShowTip(false);
    setTipManuallyOpened(false);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (error) {
      console.warn("Nepodarilo sa uložiť stav nápovedy:", error);
    }

    // Enable notifications
    try {
      await enableNotifications();
    } catch (error) {
      console.error("Chyba pri registrácii push notifikácií:", error);
    }

    // Aktualizuj stav oprávnenia po pokuse o zapnutie
    refreshPermission();

    // Call parent callback
    onBellClick();
  }

  function handleBellClick() {
    // Notifikácie NIE SÚ zapnuté (default / denied) → otvor existujúcu nápovedu,
    // aby používateľ presne vedel, ako ich zapnúť (žiadne tiché zlyhanie).
    if (!notificationsEnabled) {
      setTipManuallyOpened(true);
      return;
    }

    // Notifikácie sú zapnuté → pôvodné správanie (história + tichá re-synchr. push)
    void handleEnableFromTip();
  }

  if (!isMounted) return null;

  return (
    <div className="relative inline-block">
      <style>{PULSE_ANIMATION}</style>

      {/* Pulzujúca bodka indikátora - optimizovaná pre lepšiu viditeľnosť */}
      {showTip && !hasNotificationDot && (
        <div
          className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center"
          style={{
            animation: "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            willChange: "transform, box-shadow",
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
          "dark:hover:scale-105 dark:focus:ring-emerald-500/40",
          // Zelený krúžok = notifikácie sú aktívne (granted)
          notificationsEnabled && "ring-2 ring-emerald-500/70",
          className,
        )}
        aria-label={
          notificationsEnabled ? "Notifikácie" : "Notifikácie nie sú zapnuté – zobraziť návod"
        }
        title={
          notificationsEnabled
            ? "Notifikácie sú zapnuté"
            : "Notifikácie sú vypnuté – ťuknite pre návod"
        }
        style={
          showTip && !hasNotificationDot
            ? {
                animation: "bounce-subtle 2.5s ease-in-out infinite",
                willChange: "transform",
              }
            : undefined
        }
      >
        {notificationsEnabled ? (
          <Bell size={17} strokeWidth={2} className="text-foreground dark:text-foreground" />
        ) : (
          // Preškrtnutý zvonček + jemné zatrasenie = notifikácie nie sú zapnuté
          <span
            className="inline-flex"
            style={{
              animation: "bell-shake 3s ease-in-out infinite",
              willChange: "transform",
            }}
            aria-hidden
          >
            <BellOff size={17} strokeWidth={2} className="text-amber-500 dark:text-amber-400" />
          </span>
        )}

        {/* Červená bodka - signalizuje neprečítané správy */}
        {hasNotificationDot && (
          <span className="absolute right-[0.7rem] top-[0.7rem] h-2 w-2 rounded-full bg-destructive ring-2 ring-background dark:ring-slate-950" />
        )}
      </button>

      {/* Informačná bublina - vysúva sa smerom NADOL s edge protection */}
      {(tipManuallyOpened || (showTip && !hasNotificationDot)) && (
        <div className="fixed sm:absolute top-auto sm:top-full right-auto sm:right-0 left-0 sm:left-auto mt-3 sm:mt-3 mb-0 z-[9999] w-full sm:w-72 pointer-events-auto px-3 sm:px-0 sm:max-w-sm">
          <div className="relative">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-2xl border border-emerald-200/60 dark:from-slate-900 dark:to-slate-800 dark:border-emerald-700/40 dark:shadow-xl dark:shadow-emerald-950/30">
              {/* Zatváracie tlačidlo - optimalizované pre touch */}
              <button
                onClick={handleDismiss}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200 active:scale-95 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                aria-label="Zatvoriť nápovedu"
              >
                <X size={14} strokeWidth={3} />
              </button>

              {/* Text - s proper spacing */}
              <div className="pr-8">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  🔔 Povolte notifikácie
                </p>
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300/90 leading-relaxed line-clamp-3">
                  Kliknutím na zvonček povolíte notifikácie a budete dostávať príspevky od susedov
                  priamo do svojho zariadenia.
                </p>
              </div>

              {/* CTA Tlačidlo - s dark mode variantou */}
              <button
                onClick={handleBellClick}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 dark:shadow-lg dark:shadow-emerald-900/40 dark:hover:shadow-emerald-900/60 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              >
                Kliknúť a povoliť 📲
              </button>

              {/* Šípka ukazujúca nahor na zvonček - hidden on mobile */}
              <div
                className="hidden sm:block absolute right-5 -top-2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-emerald-50 dark:border-b-slate-900"
                style={{
                  filter: "drop-shadow(0 1px 2px rgba(16, 185, 129, 0.15))",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
