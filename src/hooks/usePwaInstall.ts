import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa";
const IOS_HINT_DISMISS_UNTIL_KEY = "komunita.pwa.install.iosHintDismissUntil.v1";

import {
  getPwaInstallSnapshot,
  getPwaInstallVersion,
  promptPwaInstall,
  subscribePwaInstall,
} from "@/lib/pwa-install";

function getIosHintDismissUntil() {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(IOS_HINT_DISMISS_UNTIL_KEY);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function postponeIosHint(hours: number) {
  if (typeof window === "undefined") return;
  const until = Date.now() + hours * 60 * 60 * 1000;
  window.localStorage.setItem(IOS_HINT_DISMISS_UNTIL_KEY, String(until));
}

export function usePwaInstall() {
  useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallVersion,
    getPwaInstallVersion,
  );
  const { canInstall, isInstalled, isPrompting } = getPwaInstallSnapshot();
  const [canShowIosHint, setCanShowIosHint] = useState(false);

  const dismissIosInstallHint = useCallback(() => {
    postponeIosHint(24);
    setCanShowIosHint(false);
  }, []);

  useEffect(() => {
    const updateIosHintVisibility = () => {
      if (!isIosDevice() || isStandaloneMode()) {
        setCanShowIosHint(false);
        return;
      }

      setCanShowIosHint(Date.now() >= getIosHintDismissUntil());
    };

    const onDisplayModeChanged = () => {
      if (isStandaloneMode()) {
        setCanShowIosHint(false);
        return;
      }

      updateIosHintVisibility();
    };

    updateIosHintVisibility();

    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", onDisplayModeChanged);

    return () => {
      media.removeEventListener("change", onDisplayModeChanged);
    };
  }, []);

  return {
    canInstall: canInstall && !isInstalled,
    canShowIosHint,
    isInstalled,
    isIosDevice: isIosDevice(),
    isPrompting,
    dismissIosInstallHint,
    promptInstall: useCallback(() => promptPwaInstall(), []),
  };
}
