import { supabase } from "@/integrations/supabase/client";

const RSS_URL = "https://www.ruzindol.sk/api/rss/";
const PROXY = "https://api.allorigins.win/raw?url=";
const LAST_SYNC_KEY = "aktuality_rss_last_sync";
const DAY_MS = 24 * 60 * 60 * 1000;

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
  await supabase.from("announcements").delete().eq("source", "rss").lt("published_at", rssCut);
  await supabase.from("announcements").delete().eq("source", "internal").lt("published_at", intCut);
}

export async function syncRssIfNeeded(force = false): Promise<{ synced: boolean; count: number }> {
  try {
    const last = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
    if (!force && Date.now() - last < DAY_MS) return { synced: false, count: 0 };

    const res = await fetch(PROXY + encodeURIComponent(RSS_URL));
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
      await supabase.from("announcements").upsert(rows, { onConflict: "source,external_id" });
    }

    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    return { synced: true, count: fresh.length };
  } catch (e) {
    console.error("[RSS sync] failed", e);
    return { synced: false, count: 0 };
  }
}
