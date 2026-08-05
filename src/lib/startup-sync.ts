import { syncRssIfNeeded } from "@/lib/rss-sync";
import { syncMunicipalEventsIfNeeded } from "@/lib/municipal-events-sync";

let started = false;

export function runStartupContentSync() {
  if (started) return;
  started = true;

  // Run both syncs in background to keep UI responsive.
  void Promise.allSettled([syncRssIfNeeded(), syncMunicipalEventsIfNeeded()]).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error("Startup sync zlyhal:", result.reason);
      }
    });
  });
}
