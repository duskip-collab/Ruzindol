// =============================================================================
//  Edge Function:  aktualizuj-region-spravy
//  Modul "Správy z regiónu" — BEZ AI agenta.
//
//  • Načíta RSS feed Trnavského hlasu
//    (https://www.trnavskyhlas.sk/_rss/rss-trnavsky-hlas.php) a vloží
//    reálne články do tabuľky public.region_spravy.
//  • Žiadny LLM, žiadne generovanie textu, žiadne vymýšľanie – ukladá sa
//    výhradne to, čo je vo feede (názov, popis, obrázok, odkaz, čas).
//  • Atomická výmena cez RPC replace_region_spravy (jedna transakcia).
//  • Beží VÝHRADNE na pozadí, no dá sa zavolať aj z klienta
//    (supabase.functions.invoke("aktualizuj-region-spravy")).
//
//  Nasadenie:
//    supabase functions deploy aktualizuj-region-spravy --no-verify-jwt
//  Naplánovanie (napr. raz denne o 05:00 UTC) v Supabase Dashboard ->
//  Edge Functions -> Schedules, alebo cez pg_cron -> net.http_post.
//
//  Nevyžaduje žiadne API kľúče. (SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY
//  sú dostupné automaticky.)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLE = "region_spravy";
const FEED_URL = "https://www.trnavskyhlas.sk/_rss/rss-trnavsky-hlas.php";
const FEED_NAME = "Trnavský Hlas";
const ALLOWED_HOST = "trnavskyhlas.sk";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_ITEMS = 40;
const MAX_POPIS = 400;
const MAX_TITULOK = 200;

type Sprava = {
  guid: string;
  titulok: string;
  popis: string | null;
  obrazok_url: string | null;
  zdroj_url: string;
  zdroj_nazov: string;
  publikovane_at: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

/** Dekóduje HTML/XML entity z názvov a popisov článkov. */
function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    hellip: "…",
    mdash: "—",
    ndash: "–",
    laquo: "«",
    raquo: "»",
  };
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/** Odstráni CDATA a HTML značky, dekóduje entity a skráti text. */
function toPlainText(raw: string, max: number): string {
  const withoutCdata = raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return truncate(decodeEntities(withoutCdata).replace(/\s+/g, " ").trim(), max);
}

/** Odkaz musí smerovať na povolený zdroj (ochrana pred podvrhnutým feedom). */
function normalizeUrl(candidate: string): string | null {
  const raw = candidate.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== ALLOWED_HOST) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Prvý obrázok z popisu článku (vrátane CDATA). */
function extractImageUrl(description: string): string | null {
  const match = description.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (!match) return null;
  return normalizeUrl(decodeEntities(match[1]));
}

function pickTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function pickAttribute(block: string, tag: string, attribute: string): string {
  const match = block.match(
    new RegExp(`<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return match?.[1] ?? "";
}

/**
 * Parsuje dátum z RSS. Zdroj Trnavského hlasu používa netradičnú príponu
 * "GTM" namiesto štandardného "GMT" – Date.parse ju odmietne a články by
 * dostali dnešné časové raziečko. Preto príponu normalizujeme.
 */
function parseDate(raw: string): number {
  if (!raw) return Number.NaN;
  const normalized = raw
    .trim()
    .replace(/\bGTM\b/gi, "GMT")
    .replace(/\bUT\b|\bZ\b/gi, "GMT");
  const direct = Date.parse(normalized);
  if (!Number.isNaN(direct)) return direct;
  // Záložný formát: "14:14:41 01.10.2026"
  const m = raw.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) {
    return Date.UTC(+m[6], +m[5] - 1, +m[4], +m[1], +m[2], +m[3]);
  }
  return Number.parseInt(raw, 10) || Number.NaN;
}

/**
 * Parsuje RSS (aj Atom) bez DOMParseru – Edge Runtime ho nemá.
 * Deno / JS by naň spadlo s ReferenceError, feed by sa nikdy nenačítal.
 */
function parseFeed(xml: string): Sprava[] {
  const items: Sprava[] = [];
  const seen = new Set<string>();

  for (const blockMatch of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = blockMatch[0];

    const titulok = toPlainText(pickTag(block, "title"), MAX_TITULOK);
    if (!titulok) continue;

    const linkCandidate =
      pickAttribute(block, "link", "href") || pickTag(block, "link") || pickTag(block, "guid");
    const zdroj_url = normalizeUrl(linkCandidate);
    if (!zdroj_url) continue;

    const guid = normalizeUrl(pickTag(block, "guid")) ?? zdroj_url;
    if (seen.has(guid)) continue;

    const description = pickTag(block, "description") || pickTag(block, "summary") || "";
    const popis = toPlainText(description, MAX_POPIS);

    const dateRaw =
      toPlainText(pickTag(block, "pubDate"), 100) ||
      toPlainText(pickTag(block, "published"), 100) ||
      toPlainText(pickTag(block, "updated"), 100);
    const ts = parseDate(dateRaw);
    const publikovane_at = Number.isNaN(ts) ? new Date().toISOString() : new Date(ts).toISOString();

    // Články z budúcnosti (napr. chybný dátum vo feede) neukladáme.
    if (ts > Date.now() + 24 * 60 * 60 * 1000) continue;

    seen.add(guid);
    items.push({
      guid,
      titulok,
      popis: popis || null,
      obrazok_url: extractImageUrl(description),
      zdroj_url,
      zdroj_nazov: FEED_NAME,
      publikovane_at,
    });
    if (items.length >= MAX_ITEMS) break;
  }

  return items.sort((a, b) => b.publikovane_at.localeCompare(a.publikovane_at));
}

async function fetchFeed(): Promise<Sprava[]> {
  const res = await fetch(FEED_URL, {
    headers: {
      "User-Agent": "SpravyZRegionu/1.0 (+supabase-edge-fn)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ success: true });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "missing_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const items = await fetchFeed();
    if (items.length === 0) {
      console.warn("[region-spravy] RSS feed neobsahuje žiadne použiteľné články – nič sa nemení.");
      return json({ success: true, source: FEED_URL, parsed: 0, stored: 0 });
    }

    // Atomická výmena obsahu v jednej transakcii.
    const { error } = await supabase.rpc("replace_region_spravy", { p_rows: items });
    if (error) {
      console.error("[region-spravy] replace_region_spravy zlyhal:", error);
      return json({ success: false, error: error.message }, 500);
    }

    const { count, error: countError } = await supabase
      .from(TABLE)
      .select("guid", { count: "exact", head: true });
    if (countError) {
      console.warn("[region-spravy] Kontrola počtu zlyhala:", countError.message);
    }

    const stored = count ?? items.length;
    console.log(`[region-spravy] OK parsed=${items.length} stored=${stored}`);
    return json({
      success: true,
      source: FEED_URL,
      source_name: FEED_NAME,
      parsed: items.length,
      stored,
    });
  } catch (error) {
    console.error("[region-spravy] zlyhal:", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return json({ success: false, error: message }, 502);
  }
});

  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function pickAttribute(block: string, tag: string, attribute: string): string {
  const match = block.match(
    new RegExp(`<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return match?.[1] ?? "";
}
