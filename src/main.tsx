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
// Kontrola aktualizácie aplikácie
const checkVersion = async () => {
  try {
    const response = await fetch('/version.json?t=' + Date.now());
    const data = await response.json();
    const currentVersion = localStorage.getItem('app-version');

    if (currentVersion && currentVersion !== data.version) {
      console.log('Nová verzia aplikácie, prenačítavam...');
      localStorage.setItem('app-version', data.version);
      
      // Vyčistenie Service Workera pre istotu
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        regs.forEach((reg) => reg.unregister());
      }
      
      window.location.reload();
    } else if (!currentVersion) {
      localStorage.setItem('app-version', data.version);
    }
  } catch (err) {
    console.error('Chyba pri kontrole verzie:', err);
  }
};

// Spustiť kontrolu po načítaní
checkVersion();


import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";
import { getRouter } from "./router";
import { ensurePwaInstallListeners } from "./lib/pwa-install";

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

// Registrácia Service Workera pre PWA a Push notifikácie na pozadí
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => console.log("Service Worker úspešne zaregistrovaný:", reg))
    .catch((err) => console.error("Chyba registrácie Service Workera:", err));
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);