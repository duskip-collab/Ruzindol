import { isStandaloneMode } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallState = {
  canInstall: boolean;
  isInstalled: boolean;
  isPrompting: boolean;
};

const DISMISS_UNTIL_KEY = "komunita.pwa.install.dismissUntil.v1";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersRegistered = false;
const listeners = new Set<() => void>();
let version = 0;

const state: InstallState = {
  canInstall: false,
  isInstalled: false,
  isPrompting: false,
};

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function setInstalled(value: boolean) {
  state.isInstalled = value;
  if (value) {
    state.canInstall = false;
    deferredPrompt = null;
  }
  emit();
}

function syncStandaloneState() {
  state.isInstalled = isStandaloneMode();
  if (state.isInstalled) {
    state.canInstall = false;
    deferredPrompt = null;
  }
}

function onBeforeInstallPrompt(event: Event) {
  const bipEvent = event as BeforeInstallPromptEvent;
  bipEvent.preventDefault();

  if (isStandaloneMode()) {
    setInstalled(true);
    return;
  }

  deferredPrompt = bipEvent;
  state.canInstall = true;
  emit();
}

function onAppInstalled() {
  deferredPrompt = null;
  state.canInstall = false;
  state.isPrompting = false;
  setInstalled(true);
  window.localStorage.removeItem(DISMISS_UNTIL_KEY);
}

function onDisplayModeChanged() {
  syncStandaloneState();
  emit();
}

export function ensurePwaInstallListeners() {
  if (typeof window === "undefined" || listenersRegistered) return;

  listenersRegistered = true;
  syncStandaloneState();

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
  window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayModeChanged);
}

export function subscribePwaInstall(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaInstallSnapshot(): InstallState {
  return { ...state };
}

export function getPwaInstallVersion() {
  return version;
}

/**
 * Výsledok pokusu o natívnu inštaláciu:
 * - "accepted"    – používateľ prijal systémový inštalačný prompt
 * - "dismissed"   – používateľ prompt zavrhol
 * - "unavailable" – beforeinstallprompt nie je k dispozícii (starší Android /
 *                   Samsung Internet / starší Chrome) alebo prompt zlyhal
 */
export type PwaInstallPromptResult = "accepted" | "dismissed" | "unavailable";

export async function promptPwaInstall(): Promise<PwaInstallPromptResult> {
  const deferred = deferredPrompt;
  if (!deferred) return "unavailable";

  try {
    state.isPrompting = true;
    emit();
    await deferred.prompt();
    const choice = await deferred.userChoice;

    deferredPrompt = null;
    state.canInstall = false;

    if (choice.outcome === "accepted") {
      window.localStorage.removeItem(DISMISS_UNTIL_KEY);
      setInstalled(true);
      return "accepted";
    }

    return "dismissed";
  } catch {
    // Prompt sa nepodarilo vyvolať (blokované prehliadačom / chyba) –
    // volajúci môže zobraziť manuálny návod.
    return "unavailable";
  } finally {
    state.isPrompting = false;
    emit();
  }
}
