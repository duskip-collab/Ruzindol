// Aktivujeme nový SW okamžite po nasadení, aby push handler neostal v waiting stave.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Ak prehliadač obnoví/rotuje push subskripciu, požiadame otvorené klienty
// o tichý refresh uloženia subscription na backend.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: "PUSH_SUBSCRIPTION_REFRESH_REQUIRED" });
      }
    })(),
  );
});

// Fetch handler s bezpečným zachytávaním sieťových chýb pre PWA installability.
self.addEventListener("fetch", (event) => {
  // Ak ide o cross-origin požiadavku (napr. Supabase API/Functions), necháme prehliadač spracovať fetch štandardne.
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch((error) => {
      console.warn("[SW] Fetch failed:", error);
      // Vráti čistú sieťovú chybovú odpoveď namiesto zlyhania v Service Workeri
      return new Response("Network error occurred", {
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers({ "Content-Type": "text/plain" }),
      });
    })
  );
});

// Počúvanie na prichádzajúce push notifikácie
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};

      if (event.data) {
        try {
          data = event.data.json();
        } catch {
          data = { title: "Moji Susedia", body: event.data.text() };
        }
      }

      const title = data.title || "Moji Susedia";
      const priority = data.priority || "high";
      const baseTag = data.tag || "komunita-push";
      const tag = `${baseTag}-${Date.now()}`;
      const rawTargetUrl = data.url || data.data?.url;
      const targetUrl =
        typeof rawTargetUrl === "string" && rawTargetUrl.startsWith("/")
          ? rawTargetUrl
          : "/";
      const vibratePattern = Array.isArray(data.vibrate)
        ? data.vibrate
        : priority === "high"
          ? [300, 120, 300, 120, 500]
          : [180, 80, 180];

      const options = {
        body: data.body || "Máte novú správu alebo aktualizáciu.",
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag,
        renotify: true,
        requireInteraction: data.requireInteraction ?? priority === "high",
        silent: false,
        vibrate: vibratePattern,
        // Some browsers ignore custom sound on Web Push, but keeping it allows
        // platforms that support this hint to play an audible alert.
        sound: data.sound || "default",
        timestamp: Date.now(),
        data: {
          url: targetUrl,
          priority,
          sound: data.sound || "default",
        },
      };

      await self.registration.showNotification(title, options);
    })(),
  );
});

// Otvorenie aplikácie po kliknutí na notifikáciu
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Klik na notifikáciu zachytený:", event.notification.tag);

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const relativeUrl = event.notification.data?.url || "/";
      const urlToOpen = new URL(relativeUrl, self.location.origin).href;

      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});