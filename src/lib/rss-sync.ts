import { supabase } from "@/integrations/supabase/client";
import { retryAsync, withTimeout } from "@/lib/async-guard";

const LAST_SYNC_KEY = "aktuality_rss_last_sync_v2";
const LAST_SYNC_DAY_KEY = "aktuality_rss_last_sync_day_v2";
const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const RSS_LIMIT = 6;

export type RssItem = {
  external_id: string;
  title: string;
  content: string;
  link: string | null;
  published_at: string;
};

export async function cleanupExpiredAnnouncements() {
  const now = Date.now();
  const intCut = new Date(now - 4 * DAY_MS).toISOString();
  await withTimeout(
    () =>
      retryAsync(
        () =>
          Promise.all([
            supabase
              .from("announcements")
              .delete()
              .eq("source", "internal")
              .lt("published_at", intCut),
          ]).then(() => undefined),
        { retries: 1, delayMs: 250 },
      ),
    8000,
    "Čistenie starých oznamov trvalo príliš dlho.",
  );
}

function getTodayLocalKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shouldSyncToday(force: boolean) {
  if (force) return true;

  // Sync on every single app startup. We bypass the 24h limit, but fallback to 24h if desired.
  // To fetch on every app startup, we can just return true.
  return true;
}

function markSyncedToday() {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  localStorage.setItem(LAST_SYNC_DAY_KEY, getTodayLocalKey());
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncRssIfNeeded(force = false): Promise<{ synced: boolean; count: number }> {
  try {
    if (!shouldSyncToday(force)) return { synced: false, count: 0 };

    console.log("[FRONTEND] Pokus o spustenie fetch-municipal-events Edge Function...");

    const { data, error } = await supabase.functions.invoke("fetch-municipal-events", {
      body: { mode: "rss", force: true },
    });
    if (error) {
      console.error("[FRONTEND ERROR] Edge Function zlyhala pri volaní:", error);
      throw error;
    }
    console.log("[FRONTEND SUCCESS] Edge Function odpovedala:", data);
    if (data?.success !== true) {
      throw new Error(data?.error || "Synchronizácia RSS zlyhala.");
    }
    const count = typeof data?.count === "number" ? data.count : 0;
    console.log("[RSS] Backend synchronizácia dokončená:", count);

    markSyncedToday();
    return { synced: true, count };
  } catch (e) {
    console.error("Nepodarilo sa stiahnut aktuality z obce:", e);
    return { synced: false, count: 0 };
  }
}
