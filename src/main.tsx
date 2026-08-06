import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";
import { getRouter } from "./router";
import { ensurePwaInstallListeners } from "./lib/pwa-install";

const router = getRouter();

ensurePwaInstallListeners();

// Registrácia Service Workera pre PWA a Push notifikácie na pozadí
if ("serviceWorker" in navigator) {
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