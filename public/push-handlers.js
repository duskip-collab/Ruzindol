// Keep push behavior separate from the Workbox-generated service worker.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: "PUSH_SUBSCRIPTION_REFRESH_REQUIRED" });
      }
    })(),
  );
});

function normalizeNotificationUrl(value) {
  if (typeof value !== "string") return "/";

  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};

      if (event.data) {
        try {
          data = event.data.json();
        } catch {
          data = { title: "Komunita", body: event.data.text() };
        }
      }

      const title = data.title || "Komunita";
      const priority = data.priority || "high";
      const baseTag = data.tag || "komunita-push";
      const tag = `${baseTag}-${Date.now()}`;
      const targetUrl = normalizeNotificationUrl(data.url || data.data?.url);
      const vibratePattern = Array.isArray(data.vibrate)
        ? data.vibrate
        : priority === "high"
          ? [300, 120, 300, 120, 500]
          : [180, 80, 180];

      await self.registration.showNotification(title, {
        body: data.body || "Máte novú správu alebo aktualizáciu.",
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag,
        renotify: true,
        requireInteraction: data.requireInteraction ?? priority === "high",
        silent: false,
        vibrate: vibratePattern,
        sound: data.sound || "default",
        timestamp: Date.now(),
        data: { url: targetUrl, priority, sound: data.sound || "default" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || "/nastenka";
  const fullUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl);
    }),
  );
});
