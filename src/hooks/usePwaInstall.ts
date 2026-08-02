import { useCallback, useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_UNTIL_KEY = "komunita.pwa.install.dismissUntil.v1";
const AUTO_PROMPTED_SESSION_KEY = "komunita.pwa.install.autoPrompted.v1";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const mediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

function getDismissUntil() {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(DISMISS_UNTIL_KEY);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function postponePrompt(hours: number) {
  if (typeof window === "undefined") return;
  const until = Date.now() + hours * 60 * 60 * 1000;
  window.localStorage.setItem(DISMISS_UNTIL_KEY, String(until));
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [isPrompting, setIsPrompting] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const runInstallPrompt = useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred) return false;

    try {
      setIsPrompting(true);
      await deferred.prompt();
      const choice = await deferred.userChoice;

      deferredRef.current = null;
      setCanInstall(false);

      if (choice.outcome === "accepted") {
        window.localStorage.removeItem(DISMISS_UNTIL_KEY);
        setIsInstalled(true);
        return true;
      }

      postponePrompt(24);
      return false;
    } catch {
      return false;
    } finally {
      setIsPrompting(false);
    }
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const bipEvent = event as BeforeInstallPromptEvent;
      bipEvent.preventDefault();

      if (isStandaloneMode()) {
        setIsInstalled(true);
        setCanInstall(false);
        return;
      }

      deferredRef.current = bipEvent;
      setCanInstall(true);

      const dismissedUntil = getDismissUntil();
      const autoPromptedThisSession = window.sessionStorage.getItem(AUTO_PROMPTED_SESSION_KEY) === "1";
      if (Date.now() >= dismissedUntil && !autoPromptedThisSession) {
        window.sessionStorage.setItem(AUTO_PROMPTED_SESSION_KEY, "1");
        window.setTimeout(() => {
          void runInstallPrompt();
        }, 1600);
      }
    };

    const onInstalled = () => {
      deferredRef.current = null;
      setCanInstall(false);
      setIsInstalled(true);
      window.localStorage.removeItem(DISMISS_UNTIL_KEY);
    };

    const onDisplayModeChanged = () => {
      if (isStandaloneMode()) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", onDisplayModeChanged);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media.removeEventListener("change", onDisplayModeChanged);
    };
  }, [runInstallPrompt]);

  return {
    canInstall: canInstall && !isInstalled,
    isInstalled,
    isPrompting,
    promptInstall: runInstallPrompt,
  };
}
