import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Zapíše do buildu `version.json` s jednoznačným identifikátorom nasadenia.
 *
 * Klient (`src/main.tsx`) podľa neho overuje, či beží na najnovšej verzii zo
 * servera – bez toho by statické `public/version.json` („1.0.0“) nikdy
 * nezmenilo hodnotu a kontrola verzie by bola nefunkčná (najmä na iOS, kde
 * Safari drží starý kód v cache).
 *
 * Súbor sa zapisuje v `closeBundle`, teda až PO skopírovaní `public/`, takže
 * statické `public/version.json` ostáva len ako pomôcka pre `vite dev`.
 */
function pwaVersionFile(): Plugin {
  let outDir = "dist";
  let version = "";
  let buildId = "";
  let builtAt = "";

  return {
    name: "pwa-version-file",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find((item) => item.type === "chunk" && item.isEntry);
      buildId = entry?.fileName ? (entry.fileName.split("/").pop() ?? "") : "";

      // Odtlačok všetkých emitovaných assetov – zmení sa pri akejkoľvek zmene
      // kódu (aj keď sa hash vstupného chunk-u nezmení).
      const fingerprint = createHash("sha256")
        .update(Object.keys(bundle).sort().join("|"))
        .digest("hex")
        .slice(0, 12);

      version = `${buildId || "app"}-${fingerprint}`;
      builtAt = new Date().toISOString();
    },
    closeBundle() {
      if (!version) return;
      const target = resolve(process.cwd(), outDir, "version.json");
      writeFileSync(target, `${JSON.stringify({ version, buildId, builtAt }, null, 2)}\n`, "utf8");
    },
  };
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    pwaVersionFile(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["**/*.{png,jpg,jpeg,svg,ico,webp}"],
      manifest: {
        name: "Komunita",
        short_name: "Komunita",
        description: "Komunitná platforma pre susedstvá",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        lang: "sk",
        start_url: "/",
        scope: "/",
      },
      workbox: {
        dontCacheBustURLsMatching: /-[a-zA-Z0-9_-]{8}\./,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^https:\/\/[^/]+\.supabase\.co/],
        importScripts: ["push-handlers.js"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\//,
            handler: "NetworkOnly",
            options: {
              cacheName: "supabase-api-bypass",
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    modulePreload: {
      polyfill: false,
    },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) return "vendor-recharts";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("@radix-ui")) return "vendor-radix";
            return "vendor";
          }
        },
      },
    },
  },
});
