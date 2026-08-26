import { supabase } from "@/integrations/supabase/client";

const LAST_SYNC_KEY = "municipal_events_last_sync_day";

function getTodayLocalKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shouldSyncToday(force: boolean) {
  if (force) return true;
  return localStorage.getItem(LAST_SYNC_KEY) !== getTodayLocalKey();
}

function markSyncedToday() {
  localStorage.setItem(LAST_SYNC_KEY, getTodayLocalKey());
}

export async function syncMunicipalEventsIfNeeded(force = false): Promise<{ synced: boolean; count: number }> {
  try {
    if (!shouldSyncToday(force)) return { synced: false, count: 0 };

    console.log("[FRONTEND] Pokus o spustenie fetch-municipal-events Edge Function...");

    const { data, error } = await supabase.functions.invoke("fetch-municipal-events", {
      body: { force },
    });

    if (error) {
      console.error("[FRONTEND ERROR] Edge Function zlyhala pri volaní:", error);
      return { synced: false, count: 0 };
    }

    console.log("[FRONTEND SUCCESS] Edge Function odpovedala:", data);
    const count = typeof data?.count === "number" ? data.count : 0;
    markSyncedToday();
    return { synced: true, count };
  } catch (error) {
    console.error("Chyba pri synchronizácii obecného kalendára:", error);
    return { synced: false, count: 0 };
  }
}
