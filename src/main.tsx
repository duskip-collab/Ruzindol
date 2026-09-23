// Automatické zotavenie pri zlyhaní načítania dynamických modulov/chunkov po novom nasadení (re-deploy na Verceli)
window.addEventListener("vite:preload-error", () => {
  const reloadKey = "komunita.vite-preload-reload-attempted";
  if (sessionStorage.getItem(reloadKey) === "1") return;
  sessionStorage.setItem(reloadKey, "1");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
  window.location.reload();
});
// Guard pre viacnásobné reloady (version check + SW update + controllerchange)
let appReloading = false;
const safeReload = (reason: string) => {
  if (appReloading) return;
  appReloading = true;
  console.log(`Nová verzia aplikácie (${reason}), prenačítavam...`);
  window.location.reload();
};

// Bezpečný prístup k úložisku (v súkromnom režime iOS môže byť nedostupné)
const readStored = (storage: "local" | "session", key: string): string | null => {
  try {
    const target = storage === "local" ? window.localStorage : window.sessionStorage;
    return target.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (storage: "local" | "session", key: string, value: string) => {
  try {
    const target = storage === "local" ? window.localStorage : window.sessionStorage;
    target.setItem(key, value);
  } catch {
    /* ignore */
  }
};

/**
 * Identifikátor PRÁVE BEŽIACEHO buildu – v produkcii názov vstupného bundle
 * (napr. `index-Bd2w330s.js`) odvodený z URL modulu. Odhalí, že klient beží na
 * starých assetoch (iOS bfcache / Workbox precache) aj vtedy, keď je už
 * v localStorage uložená nová verzia. V dev režime sa nepoužíva.
 */
const runningBuildId = import.meta.env.PROD ? buildIdFromUrl(import.meta.url) : "";

// Kontrola aktualizácie aplikácie (version.json je vždy servnuty bez cache)
let lastVersionCheckAt = 0;
let versionCheckInFlight = false;

/** Vyčistí CacheStorage (Workbox precache), aby iOS po reloade nevzal starý kód. */
async function clearPwaCaches() {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (err) {
    console.warn("CacheStorage sa nepodarilo vyčistiť:", err);
  }
}

/** Aktualizuje a odregistruje Service Workera, aby sa pri reloade načítal čerstvý kód. */
async function refreshServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (registration) => {
        try {
          await registration.update();
        } catch {
          /* update môže zlyhať offline – pokračujeme odregistrovaním */
        }
        try {
          await registration.unregister();
        } catch {
          /* ignore */
        }
      }),
    );
  } catch (err) {
    console.warn("Service Workera sa nepodarilo aktualizovať:", err);
  }
}

/** Je práve potlačený reload z `controllerchange`/`updatefound` (po vynútenom update)? */
function isSwReloadSuppressed() {
  const until = Number(readStored("session", SW_RELOAD_SUPPRESS_UNTIL_KEY) ?? 0);
  return Number.isFinite(until) && Date.now() < until;
}

/** Na pozadí skontroluje aj nový Service Worker (bez čakania na odpoveď). */
function refreshServiceWorkerInBackground() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => reg?.update())
    .catch(() => {});
}

const checkVersion = async (options: { force?: boolean } = {}) => {
  if (appReloading || versionCheckInFlight) return;
  const now = Date.now();
  // Minimálny odstup medzi kontrolami, aby sa netrepotalo na sekundovej báze.
  // `force` (návrat iOS z bfcache) tento odstup zámerne obchádza.
  if (!options.force && isWithinCooldown(lastVersionCheckAt, now, VERSION_CHECK_MIN_INTERVAL_MS)) {
    return;
  }
  versionCheckInFlight = true;
  lastVersionCheckAt = now;

  // Timeout, aby zaseknutý request na mobilnej sieti nezablokoval ďalšie kontroly.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT_MS);

  try {
    // iOS Safari agresívne cachuje: `no-store` + časový parameter + hlavičky
    // zaručia, že sa naozaj stiahne aktuálny `version.json` zo servera.
    const response = await fetch(`/version.json?t=${now}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`version.json HTTP ${response.status}`);

    const data = (await response.json()) as ServerVersionInfo;
    if (!data?.version) return;

    const storedVersion = readStored("local", APP_VERSION_STORAGE_KEY);

    if (
      isAppOutdated({
        serverVersion: data.version,
        serverBuildId: data.buildId,
        storedVersion,
        runningBuildId,
      })
    ) {
      await forceAppUpdate(
        data.version,
        `version.json${options.force ? " (návrat z pozadia)" : ""}`,
      );
      return;
    }

    if (!storedVersion) writeStored("local", APP_VERSION_STORAGE_KEY, data.version);
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      console.error("Chyba pri kontrole verzie:", err);
    }
  } finally {
    clearTimeout(timeoutId);
    versionCheckInFlight = false;
  }
};

/**
 * Vynúti aktualizáciu na iOS aj Androide: uloží novú verziu, aktualizuje
 * a odregistruje Service Workera, vyčistí CacheStorage a prenačíta stránku.
 *
 * Ochrana proti slučke: ak sa verzia nezmenila ani po reloade (napr. CDN ešte
 * neprepísal `version.json`), ďalší pokus sa odloží o `FORCED_UPDATE_COOLDOWN_MS`.
 */
async function forceAppUpdate(nextVersion: string, reason: string) {
  if (appReloading) return;

  const now = Date.now();
  const lastForcedAt = Number(readStored("session", FORCED_UPDATE_AT_KEY) ?? 0);
  if (isWithinCooldown(lastForcedAt, now, FORCED_UPDATE_COOLDOWN_MS)) {
    console.warn(
      `Aktualizácia (${reason}) už prebehla, opakovaný reload preskakujem (ochrana proti slučke).`,
    );
    return;
  }

  // Novú verziu si zapíšeme ešte pred reloadom, aby sa hneď nežiadala znova.
  writeStored("local", APP_VERSION_STORAGE_KEY, nextVersion);
  writeStored("session", FORCED_UPDATE_AT_KEY, String(now));
  // Po reloade sa nový SW hneď ujme stránky → potlačíme zbytočný druhý reload.
  writeStored("session", SW_RELOAD_SUPPRESS_UNTIL_KEY, String(now + SW_RELOAD_SUPPRESS_MS));

  if (import.meta.env.PROD) {
    await refreshServiceWorkerRegistration();
    await clearPwaCaches();
  }

  safeReload(reason);
}

// Spustiť kontrolu po načítaní
checkVersion();

/**
 * iOS: návrat aplikácie z vyrovnávacej pamäte (bfcache). `event.persisted` je
 * `true`, keď Safari obnoví stránku z pamäte namiesto nového načítania – vtedy
 * okamžite (bez odstupu) over najnovšiu verziu zo servera.
 */
window.addEventListener("pageshow", (event) => {
  const restoredFromCache = Boolean(event.persisted);
  if (restoredFromCache) {
    console.log("Návrat z vyrovnávacej pamäte (iOS) – kontrolujem najnovšiu verziu.");
  }
  void checkVersion({ force: restoredFromCache });
  refreshServiceWorkerInBackground();
});

// Pri návrate do aplikácie (prepnutie tabu / PWA z pozadia) vždy over najnovšiu verziu
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  void checkVersion();
  refreshServiceWorkerInBackground();
});

// Pravidelná kontrola počas behu aplikácie (napr. otvorený tab cez noc po redeployi)
if (import.meta.env.PROD) {
  setInterval(() => {
    void checkVersion();
  }, 60 * 1000);
}

import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";
import { getRouter } from "./router";
import { ensurePwaInstallListeners } from "./lib/pwa-install";
import {
  APP_VERSION_STORAGE_KEY,
  buildIdFromUrl,
  FORCED_UPDATE_AT_KEY,
  FORCED_UPDATE_COOLDOWN_MS,
  isAppOutdated,
  isWithinCooldown,
  SW_RELOAD_SUPPRESS_MS,
  SW_RELOAD_SUPPRESS_UNTIL_KEY,
  VERSION_CHECK_MIN_INTERVAL_MS,
  VERSION_FETCH_TIMEOUT_MS,
  type ServerVersionInfo,
} from "./lib/pwa-version";

const router = getRouter();

ensurePwaInstallListeners();

// Robustná ochrana proti bielej obrazovke pri chybe načítania chunkov / modulov
window.addEventListener("error", (event) => {
  const message = event.message || "";
  const isChunkLoadError =
    message.includes("Loading chunk failed") ||
    message.includes("Importing a module script failed") ||
    message.includes("Failed to fetch dynamically imported module");
  const reloadKey = "komunita.chunk-load-reload-attempted";

  if (!isChunkLoadError || sessionStorage.getItem(reloadKey) === "1") return;

  sessionStorage.setItem(reloadKey, "1");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
  window.location.reload();
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = String(event.reason || "");
  const isChunkLoadError =
    reason.includes("Loading chunk failed") ||
    reason.includes("Importing a module script failed") ||
    reason.includes("Failed to fetch dynamically imported module");
  const reloadKey = "komunita.chunk-load-reload-attempted";

  if (!isChunkLoadError || sessionStorage.getItem(reloadKey) === "1") return;

  sessionStorage.setItem(reloadKey, "1");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
  window.location.reload();
});

// Dev server must not be controlled by a production worker left from a previous build.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => void registration.unregister());
  });
}

// Registrácia Service Workera pre PWA a Push notifikácie na pozadí s automatickým update
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => {
      console.log("Service Worker úspešne zaregistrovaný:", reg);

      // Kontrola aktualizácií pri spustení a pravidelne každú minútu
      setInterval(() => {
        void reg.update();
      }, 60 * 1000);

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Ak práve prebehol vynútený update z `version.json`, stránka je už
              // čerstvá – okamžitý reload z nového SW by len zbytočne blikal.
              if (isSwReloadSuppressed()) return;
              safeReload("SW updatefound");
            }
          });
        }
      });
    })
    .catch((err) => console.error("Chyba registrácie Service Workera:", err));

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Nový SW sa po vynútenom update ujme stránky automaticky (clientsClaim) –
    // ďalší reload by bol duplicitný.
    if (isSwReloadSuppressed()) return;
    safeReload("SW controllerchange");
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
