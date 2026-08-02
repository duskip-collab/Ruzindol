// Aktivujeme nový SW okamžite po nasadení, aby push handler neostal v waiting stave.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Minimal fetch handler keeps PWA installability checks green in strict browsers.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
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
      const tag = data.renotify === false ? `${baseTag}-${Date.now()}` : baseTag;
      const vibratePattern = Array.isArray(data.vibrate)
        ? data.vibrate
        : priority === "high"
          ? [300, 120, 300, 120, 500]
          : [180, 80, 180];

      const options = {
        body: data.body || "Máte novú správu alebo aktualizáciu.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag,
        renotify: data.renotify !== false,
        requireInteraction: data.requireInteraction ?? priority === "high",
        silent: false,
        vibrate: vibratePattern,
        // Some browsers ignore custom sound on Web Push, but keeping it allows
        // platforms that support this hint to play an audible alert.
        sound: data.sound || "default",
        timestamp: Date.now(),
        data: {
          url: data.url || "/",
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
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const targetUrl = new URL(event.notification.data.url, self.location.origin).href;

      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});