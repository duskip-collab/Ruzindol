import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ParsedEvent = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  sourceUrl: string;
  imageUrl: string | null;
};

const BASE_URL = "https://www.ruzindol.sk";
const CALENDAR_URL = "https://www.ruzindol.sk/obcan/kalendar-podujati/";
const RSS_URL = "https://www.ruzindol.sk/?rss=200";
const EVENT_PATH_LIMIT = 40;
const RSS_LIMIT = 6;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeHtml(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .trim();
}

function stripTags(input: string) {
  return decodeHtml(input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function parseRss(xml: string) {
  // Odstránenie namespace predpôn (napr. atom:link -> link), aby regex/parsovanie nezlyhávalo
  const cleanXml = xml.replace(/<\/?([a-zA-Z0-9]+):/g, "<");
  
  const itemMatches = cleanXml.match(/<item[\s\S]*?>[\s\S]*?<\/item>/gi) || [];

  return itemMatches
    .map((itemXml, index) => {
      const getValue = (tag: string) => {
        // Podpora pre klasické tagy aj CDATA bloky
        const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i");
        const match = itemXml.match(regex);
        const rawText = match ? match[1] || match[2] || "" : "";
        return stripTags(rawText);
      };

      const title = getValue("title") || "Oznam";
      const link = getValue("link") || null;
      const guid = getValue("guid") || link || `${title}-${index}`;
      const published = getValue("pubDate");
      const category = getValue("category").trim();

      const publishedAt = published && !isNaN(new Date(published).getTime())
        ? new Date(published).toISOString()
        : new Date().toISOString();

      return {
        source: "rss",
        external_id: guid,
        title,
        content: getValue("description"),
        link,
        priority: "oznam",
        published_at: publishedAt,
        author_id: null,
        category,
      };
    })
    .filter((item) => item.title && item.external_id && item.category.toLowerCase().includes("aktualit"))
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));
}

function parseDateTime(text: string): { startsAt: string; endsAt: string | null } | null {
  const dateRange = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4}))?/);
  if (!dateRange) return null;

  const startDay = Number(dateRange[1]);
  const startMonth = Number(dateRange[2]);
  const startYear = Number(dateRange[3]);
  const endDay = dateRange[4] ? Number(dateRange[4]) : startDay;
  const endMonth = dateRange[5] ? Number(dateRange[5]) : startMonth;
  const endYear = dateRange[6] ? Number(dateRange[6]) : startYear;

  const times = [...text.matchAll(/([01]?\d|2[0-3]):([0-5]\d)/g)].map((m) => ({
    h: Number(m[1]),
    min: Number(m[2]),
  }));

  const startTime = times[0] ?? { h: 9, min: 0 };
  const endTime = times[1] ?? null;

  const startsAt = new Date(Date.UTC(startYear, startMonth - 1, startDay, startTime.h, startTime.min));
  const endsAt = endTime
    ? new Date(Date.UTC(endYear, endMonth - 1, endDay, endTime.h, endTime.min)).toISOString()
    : null;

  if (isNaN(startsAt.getTime())) return null;
  return { startsAt: startsAt.toISOString(), endsAt };
}

function toAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith("/")) return `${BASE_URL}${pathOrUrl}`;
  return `${BASE_URL}/${pathOrUrl}`;
}

function extractEventLinks(html: string) {
  const links = new Set<string>();
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null = re.exec(html);

  while (match) {
    const href = match[1] ?? "";
    if (
      href.includes("kalendar-podujati") &&
      !href.endsWith("/obcan/kalendar-podujati/") &&
      !href.endsWith("/obcan/kalendar-podujati")
    ) {
      links.add(toAbsoluteUrl(href));
    }
    match = re.exec(html);
  }

  return [...links].slice(0, EVENT_PATH_LIMIT);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }

  return await response.text();
}

async function syncRss(supabase: ReturnType<typeof createClient>) {
  const xml = await fetchText(RSS_URL);
  const items = parseRss(xml)
    .slice(0, RSS_LIMIT)
    .map(({ category: _category, ...item }) => item);
  console.log("RSS položiek načítaných z XML:", items.length);

  if (items.length === 0) return { success: true, count: 0, skipped: true };

  const { error } = await supabase.from("announcements").upsert(items, {
    onConflict: "source,external_id",
    ignoreDuplicates: false,
  });
  if (error) throw error;

  const { data: existing, error: listError } = await supabase
    .from("announcements")
    .select("id")
    .eq("source", "rss")
    .order("published_at", { ascending: false });
  if (listError) throw listError;

  const obsoleteIds = (existing ?? []).slice(RSS_LIMIT).map((row) => row.id);
  if (obsoleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .in("id", obsoleteIds);
    if (deleteError) throw deleteError;
  }

  return { success: true, count: items.length };
}

function parseSingleEventHtml(html: string, sourceUrl: string): ParsedEvent | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const title = stripTags(h1);
  if (!title) return null;

  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  const description = stripTags(paragraph);

  const image = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i)?.[1] ?? null;
  const imageUrl = image ? toAbsoluteUrl(image) : null;

  const dt = parseDateTime(`${title} ${description}`);
  if (!dt) return null;

  return {
    title,
    description,
    startsAt: dt.startsAt,
    endsAt: dt.endsAt,
    sourceUrl,
    imageUrl,
  };
}

function toDatePart(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toTimePart(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ success: false, error: "Missing service credentials" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    if (body?.mode === "rss") {
      return json(await syncRss(supabase));
    }

    const listingHtml = await fetchText(CALENDAR_URL);
    const links = extractEventLinks(listingHtml);

    const parsed: ParsedEvent[] = [];
    for (const link of links) {
      try {
        const html = await fetchText(link);
        const item = parseSingleEventHtml(html, link);
        if (item) parsed.push(item);
      } catch (error) {
        console.error("Failed to parse event page", { link, error });
      }
    }

    const upcoming = parsed
      .filter((event) => new Date(event.startsAt).getTime() >= Date.now() - 7 * 24 * 3600_000)
      .slice(0, EVENT_PATH_LIMIT);

    if (upcoming.length === 0) {
      return json({ success: true, count: 0, skipped: true });
    }

    const rows = upcoming.map((event) => ({
      author_id: null,
      municipality_id: null,
      title: event.title,
      description: event.description,
      location: "Ružindol",
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      type: "Samosprava",
      source_url: event.sourceUrl,
      image_url: event.imageUrl,
      end_date: event.endsAt ? toDatePart(event.endsAt) : null,
      end_time: event.endsAt ? toTimePart(event.endsAt) : null,
    }));

    const { error } = await supabase.from("events").upsert(rows, {
      onConflict: "source_url,starts_at",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("Upsert municipal events failed", error);
      return json({ success: false, error: error.message }, 500);
    }

    return json({ success: true, count: rows.length });
  } catch (error) {
    console.error("fetch-municipal-events failed", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return json({ success: false, error: message }, 500);
  }
});