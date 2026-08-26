import { supabase } from "@/integrations/supabase/client";
import { retryAsync, withTimeout } from "@/lib/async-guard";

const RSS_URL = "https://www.ruzindol.sk/api/rss/";
const RSS_PROXIES = [
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];
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

async function fetchRssXml() {
  let lastError: unknown = null;
  for (const [index, createProxyUrl] of RSS_PROXIES.entries()) {
    const proxyUrl = createProxyUrl(RSS_URL);
    try {
      const response = await retryAsync(
        () => fetchWithTimeout(proxyUrl, FETCH_TIMEOUT_MS),
        { retries: 1, delayMs: 400 },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      if (!xml.includes("<item") || xml.includes("<parsererror")) {
        throw new Error("Odpoveď neobsahuje platný RSS XML feed");
      }
      console.log(`[RSS] Proxy ${index + 1} odpovedala úspešne.`);
      return xml;
    } catch (error) {
      lastError = error;
      console.warn(`[RSS] Proxy ${index + 1} zlyhala, skúšam ďalšiu.`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RSS proxy nedostupná");
}

export async function syncRssIfNeeded(force = false): Promise<{ synced: boolean; count: number }> {
  try {
    if (!shouldSyncToday(force)) return { synced: false, count: 0 };

    const xml = await fetchRssXml();
    const items = parseRss(xml).sort(
      (a, b) => +new Date(b.published_at) - +new Date(a.published_at),
    );
    console.log("[RSS] Položiek načítaných z XML:", items.length);

    const fresh = items.slice(0, RSS_LIMIT);
    console.log("[RSS] Položiek určených na uloženie:", fresh.length);

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
    console.log("[RSS] Synchronizácia dokončená:", fresh.length);
    return { synced: true, count: fresh.length };
  } catch (e) {
    console.error("Nepodarilo sa stiahnut aktuality z obce:", e);
    return { synced: false, count: 0 };
  }
}
