import { supabase } from "@/integrations/supabase/client";
import { retryAsync, withTimeout } from "@/lib/async-guard";

const RSS_URL = "https://www.ruzindol.sk/api/rss/";
const PROXY = "https://api.allorigins.win/raw?url=";
const LAST_SYNC_KEY = "aktuality_rss_last_sync";
const LAST_SYNC_DAY_KEY = "aktuality_rss_last_sync_day";
const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

export type RssItem = {
  external_id: string;
  title: string;
  content: string;
  link: string | null;
  published_at: string;
};

function textOf(el: Element | null | undefined): string {
  if (!el) return "";
  return (el.textContent ?? "").trim();
}

function parseRss(xml: string): RssItem[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const items = Array.from(doc.querySelectorAll("item"));
  return items.map((it) => {
    const title = textOf(it.querySelector("title"));
    const link = textOf(it.querySelector("link")) || null;
    const guid = textOf(it.querySelector("guid")) || link || title;
    const pubDate = textOf(it.querySelector("pubDate"));
    const description = textOf(it.querySelector("description"));
    const publishedAt = pubDate ? new Date(pubDate) : new Date();
    return {
      external_id: guid,
      title: title || "Oznam",
      content: sanitizeHtml(description),
      link,
      published_at: (isNaN(publishedAt.getTime()) ? new Date() : publishedAt).toISOString(),
    };
  });
}

function sanitizeHtml(html: string): string {
  if (!html) return "";
  // Remove script/style blocks and inline event handlers / javascript: URLs.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

export async function cleanupExpiredAnnouncements() {
  const now = Date.now();
  const rssCut = new Date(now - 3 * DAY_MS).toISOString();
  const intCut = new Date(now - 4 * DAY_MS).toISOString();
  await withTimeout(
    () =>
      retryAsync(
        () =>
          Promise.all([
            supabase.from("announcements").delete().eq("source", "rss").lt("published_at", rssCut),
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

  const today = getTodayLocalKey();
  const lastDay = localStorage.getItem(LAST_SYNC_DAY_KEY);
  if (lastDay === today) return false;

  // Backward compatibility for older key based on timestamp.
  const lastTs = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
  if (lastTs > 0 && Date.now() - lastTs < DAY_MS) return false;

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

    const res = await retryAsync(
      () => fetchWithTimeout(PROXY + encodeURIComponent(RSS_URL), FETCH_TIMEOUT_MS),
      { retries: 1, delayMs: 400 },
    );
    if (!res.ok) throw new Error("RSS fetch failed");
    const xml = await res.text();
    const items = parseRss(xml);

    // Only keep fresh items (<3 days)
    const cutoff = Date.now() - 3 * DAY_MS;
    const fresh = items.filter((i) => new Date(i.published_at).getTime() >= cutoff);

    await cleanupExpiredAnnouncements();

    if (fresh.length > 0) {
      const rows = fresh.map((i) => ({
        source: "rss" as const,
        external_id: i.external_id,
        title: i.title,
        content: i.content,
        link: i.link,
        priority: "oznam" as const,
        published_at: i.published_at,
        author_id: null,
      }));
      await withTimeout(
        () =>
          retryAsync(
            () => supabase.from("announcements").upsert(rows, { onConflict: "source,external_id" }),
            { retries: 1, delayMs: 250 },
          ).then(() => undefined),
        8000,
        "Ukladanie RSS oznamov trvalo príliš dlho.",
      );
    }

    markSyncedToday();
    return { synced: true, count: fresh.length };
  } catch (e) {
    console.error("Nepodarilo sa stiahnut aktuality z obce:", e);
    return { synced: false, count: 0 };
  }
}
