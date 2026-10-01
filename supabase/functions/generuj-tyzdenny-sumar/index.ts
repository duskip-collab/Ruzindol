// =============================================================================
//  Edge Function:  generuj-tyzdenny-sumar
//  AI novinár (Google Gemini) pre modul "Ružindolské noviny".
//
//  • Beží VÝHRADNE na pozadí – bez UI a bez vstupu od používateľa.
//  • Zdroje dát (v presnom poradí, nič iné sa nepoužíva):
//      1. DÁTA Z APLIKÁCIE: events (kalendár obce), announcements (oznamy),
//         okolite_akcie (tipy) – čítané priamo z DB cez service_role.
//      2. INTERNET – len overené zdroje: priamy fetch RSS z povolených domén
//         (ruzindol.sk, trnava.sk, trnavareport.com); berú sa len položky
//         za posledných RSS_MAX_AGE_MS. Žiadne iné stránky.
//      3. ŽIVÉ VYHĽADÁVANIE – Google Search grounding v Gemini (iba ak kvóta
//         plánu dovolí; inak sa preskočí a ostane bod 1 + 2).
//  • ANTI-FABRIKÁCIA: odpoveď sa pred uložením overí voči podkladom – odkaz
//    mimo povolených domén = zamietnuté; článok musí odkazovať na poskytnutý
//    podklad (inak sa pokus zopakuje a napokon sa NIČ neuloží).
//  • STARÉ VYDANIA: pri každom úspešnom behu sa vymažú vydania staršie ako
//    RETENTION_DAYS (7 dní) – archív sa tak každý týždeň sám aktualizuje.
//    Ručné čistenie: POST {"action":"cleanup"} (voliteľne {"days":0} = všetko).
//  • Nové vydanie sa uloží do tabuľky public.tyzdenne_sumare.
//
//  Nasadenie:
//    supabase functions deploy generuj-tyzdenny-sumar --no-verify-jwt
//  Naplánovanie (raz týždenne) cez Supabase Dashboard -> Edge Functions
//  -> Schedules, alebo cez pg_cron -> net.http_post na URL funkcie.
//
//  ENV premenné (Supabase -> Project Settings -> Edge Functions -> Secrets):
//    GEMINI_API_KEY = tvoj Google AI Studio kľúč
//    GEMINI_MODEL (voliteľné) = konkrétny model (inak sa vyberie automaticky)
//  (SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY sú dostupné automaticky.)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLE = "tyzdenne_sumare";

// Model možno prepínať cez secret GEMINI_MODEL. Ak model pre API kľúč
// neexistuje (HTTP 404), funkcia automaticky skúsi ďalší v poradí.
const GEMINI_MODELS = [
  Deno.env.get("GEMINI_MODEL"),
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
].filter((m): m is string => Boolean(m && m.trim()));

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// --- Overené internetové zdroje (jediné povolené domény v článku) -----------
const FEEDS = [
  {
    label: "Obec Ružindol – oficiálne aktuality (ruzindol.sk)",
    url: "https://www.ruzindol.sk/?rss=200",
    host: "ruzindol.sk",
  },
  {
    label: "Mesto Trnava – oficiálne aktuality (trnava.sk)",
    url: "https://www.trnava.sk/rss/news",
    host: "trnava.sk",
  },
  {
    label: "TRNAVA REPORT – lokálne noviny Trnavska (trnavareport.com)",
    url: "https://trnavareport.com/feed/",
    host: "trnavareport.com",
  },
];
const ALLOWED_HOSTS = FEEDS.map((f) => f.host);
const RSS_MAX_AGE_MS = 8 * 86_400_000; // články staršie ako 8 dní sa nepoužijú
const RSS_MAX_ITEMS = 8; // max položiek z jedného feedu
const FETCH_TIMEOUT_MS = 9000;

// Retencia archívu: staré vydania sa mažú pri každom úspešnom týždennom behu.
const RETENTION_DAYS = 7;
// Rezerva 1 hodina, aby predchádzajúce týždenné vydanie (vek presne 7 dní)
// zmizlo hneď pri najbližom behu aj pri drobnom sklze cronu.
const RETENTION_MS = RETENTION_DAYS * 86_400_000 - 3_600_000;

// Pevne daný systémový prompt – AI vystupuje ako lokálny novinár viazaný podkladmi.
const SYSTEM_PROMPT = `
Si redaktor týždenníka "Ružindolské noviny" obce Ružindol (okres Trnava).
Zostavíš pútavý, vecný a ľudsky písaný týždenný súhrn diania – VÝHRADNE
z podkladov, ktoré ti doručí používateľský prompt (dáta z aplikácie a výpis
z overených RSS zdrojov, prípadne výsledky živého vyhľadávania).

ZAKÁZANÉ (okamžite diskvalifikuje odpoveď):
- vymýšľať udalosti, dátumy, časy, miesta, mená, citáty, výsledky zápasov,
  zásahy, sumy, stavby, projekty alebo rozhodnutia, ktoré nie sú v podkladoch,
- spájať podklady do udalostí, ktoré sa nestali, alebo meniť ich zmysel,
- používať fakty, ktoré nie sú v podkladoch (ani "zo svojej pamäte"), pokiaľ
  nejde o všeobecne známe nemenné skutočnosti (napr. Ružindol leží v okrese
  Trnava).

AKO PÍSAŤ:
1. Každá konkrétnejšia informácia musí byť prevzatá z podkladov; uveď k nej
   dátum (deň. mesiac) tak, ako je uvedený v podkladoch.
2. Oddel časť UPYNULÝ TÝŽDEŇ (už sa stalo – len udalosti s dátumom v minulosti
   z podkladov) od časti PRICHÁDZA (budúce podujatia – jasne označ ako
   pripravované, s dátumom). Termíny zberu odpadu uveď stručne ako
   "Kalendár odpadu".
3. Na konci článku pridaj sekciu "Zdroje:" – každý zdroj na samostatnom riadku
   v tvare "Zdroj: <názov> – <úplná URL>", najviac 5 zdrojov, IBA z podkladov.
4. Ak podklady neobsahujú nič použiteľné, napíš to priamo v prvom odseku:
   konkrétne udalosti uplynulého týždňa sa nepodarilo overiť, uverejňuje sa
   len všeobecný prehľad. Nikdy si nevymýšľaj "tento týždeň sa stalo".
5. Štýl: slovensky, slušne, pútavo, 3–6 krátkych odsekov, žiadne emoji.
6. Vráť IBA čistý JSON podľa schémy, žiadny text navyše.
`.trim();

// Schéma výstupu – presne podľa tabuľky public.tyzdenne_sumare.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    titulok: { type: "STRING", description: "Pravdivý, pútavý titulok článku" },
    obsah: {
      type: "STRING",
      description:
        "Celý článok (odseky oddelené prázdnym riadkom), na konci sekcia Zdroje: s odkazmi z podkladov",
    },
    obdobie: { type: "STRING", description: "Obdobie, ktoré súhrn pokrýva" },
  },
  required: ["titulok", "obsah", "obdobie"],
};

/**
 * Ak model nepodporí responseSchema, schému pošleme v prompte ako text;
 * výstup aj tak vynútime cez responseMimeType: application/json.
 */
function schemaHint(): string {
  return (
    `\n\nSchéma JSON (vráť presne túto štruktúru): ` +
    `{"titulok":string,"obsah":string,"obdobie":string}` +
    `\nV poli "obsah" ukonči článok sekciou "Zdroje:" s odkazmi z podkladov.`
  );
}

/** Z ľubovoľného textu vytiahne JSON objekt (fallback, ak prídu markdown fence). */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("AI nevrátila platný JSON objekt.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Krátky backoff pri HTTP 429/503 (kvóta / rate limit / preťaženie). */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Odstráni HTML značky a nadbytočné medzery z textu. */
function stripHtml(text: string): string {
  return (
    text
      // 1) odomkni escapované značky (&lt;p&gt; ...), aby sa dali odstrániť
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      // 2) odstráň všetky HTML značky (aj tie, čo boli v RSS escapované)
      .replace(/<[^>]*>/g, " ")
      // 3) doprekladaj zvyšné entity (&amp; až nakoniec)
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#8211;|&ndash;/g, "–")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&#\d+;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Zníži text na malé písmená bez diakritiky (na porovnávanie so zdrojmi). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const fmtDate = (ts: number | string): string =>
  new Date(ts).toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Bratislava",
  });

const fmtDateTime = (ts: number | string): string =>
  new Date(ts).toLocaleString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bratislava",
  });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
// =============================================================================
//  1. PODKLAD 1 – dáta z aplikácie (DB cez service_role)
// =============================================================================

type Db = ReturnType<typeof createClient>;

type EventRow = {
  title: string;
  starts_at: string;
  type: string | null;
  location: string | null;
  description: string | null;
};
type AnnouncementRow = {
  title: string;
  content: string | null;
  link: string | null;
  published_at: string;
  priority: string | null;
};
type TipRow = {
  nazov: string;
  obec: string;
  datum_cas: string;
  kategoria: string;
  miesto: string;
  popis: string | null;
};
type DbBundle = { events: EventRow[]; announcements: AnnouncementRow[]; tips: TipRow[] };
type FeedItem = { source: string; title: string; link: string; ts: number; summary: string };

/**
 * Načíta dáta, ktoré aplikácia už má (kalendár obce, oznamy, tipy na víkend).
 * Chyba jednej tabuľky nikdy nezruší celý beh – len sa tá časť podkladov vynechá.
 */
type DbLoad = { bundle: DbBundle; errors: string[] };

async function loadDbBundle(db: Db): Promise<DbLoad> {
  const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const errors: string[] = [];

  // Jeden dopyt môže zlyhať predočasným JWT (clock skew) – vždy skúsime dvakrát.
  const run = async <T>(
    label: string,
    build: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ): Promise<T> => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await build();
        if (!r.error) return (r.data ?? []) as T;
        if (attempt === 2) {
          errors.push(`${label}: ${r.error.message}`);
          console.warn(`[sumar] ${label}:`, r.error.message);
        }
      } catch (e) {
        if (attempt === 2) {
          errors.push(`${label}: ${String(e)}`);
          console.warn(`[sumar] ${label} výnimka:`, e);
        }
      }
      await sleep(400);
    }
    return [] as T;
  };

  const [events, announcements, tips] = await Promise.all([
    run<EventRow[]>("events", () =>
      db
        .from("events")
        .select("title, starts_at, type, location, description")
        .gte("starts_at", iso(-8))
        .lte("starts_at", iso(21))
        .order("starts_at", { ascending: true })
        .limit(50),
    ),
    run<AnnouncementRow[]>("announcements", () =>
      db
        .from("announcements")
        .select("title, content, link, published_at, priority")
        .gte("published_at", iso(-10))
        .order("published_at", { ascending: false })
        .limit(20),
    ),
    run<TipRow[]>("okolite_akcie", () =>
      db
        .from("okolite_akcie")
        .select("nazov, obec, datum_cas, kategoria, miesto, popis")
        .order("vzdialenost_km", { ascending: true })
        .limit(15),
    ),
  ]);

  return { bundle: { events, announcements, tips }, errors };
}

// =============================================================================
//  2. PODKLAD 2 – overené RSS zdroje z internetu (povolené domény)
// =============================================================================

/** Prevedie jednu RSS/Atom položku; staršie ako RSS_MAX_AGE_MS sa vynechajú. */
function parseFeed(xml: string, feedLabel: string): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const cutoff = Date.now() - RSS_MAX_AGE_MS;
  const items: FeedItem[] = [];

  for (const node of Array.from(doc.querySelectorAll("item, entry"))) {
    const title = stripHtml(node.querySelector("title")?.textContent ?? "");
    const linkEl = node.querySelector("link");
    const link = (linkEl?.getAttribute("href") ?? linkEl?.textContent ?? "").trim();
    const dateRaw =
      node.querySelector("pubDate")?.textContent ??
      node.querySelector("published")?.textContent ??
      node.querySelector("updated")?.textContent ??
      "";
    const ts = Date.parse(dateRaw);

    // Bez overiteľného dátumu alebo príliš staré → do novín nepatria.
    if (!title || Number.isNaN(ts) || ts < cutoff) continue;

    const summary = stripHtml(
      node.querySelector("description")?.textContent ??
        node.querySelector("summary")?.textContent ??
        "",
    );
    items.push({ source: feedLabel, title, link, ts, summary: truncate(summary, 260) });
    if (items.length >= RSS_MAX_ITEMS) break;
  }

  return items;
}

type FeedStatus = { label: string; url: string; count: number; error: string | null };
type FeedLoad = { items: FeedItem[]; statuses: FeedStatus[] };

/** Stiahne jeden feed; akýkoľvek problém sa zaznamená a feed sa vynechá. */
async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<FeedLoad> {
  const status = (count: number, error: string | null): FeedLoad => ({
    items: [],
    statuses: [{ label: feed.label, url: feed.url, count, error }],
  });

  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "RuzindolskeNoviny/1.0 (+supabase-edge-fn)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return status(0, `HTTP ${res.status}`);
    const items = parseFeed(await res.text(), feed.label);
    return {
      items,
      statuses: [{ label: feed.label, url: feed.url, count: items.length, error: null }],
    };
  } catch (e) {
    return status(0, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }
}

async function fetchFeeds(): Promise<FeedLoad> {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  return {
    items: results.flatMap((r) => r.items).sort((a, b) => b.ts - a.ts),
    statuses: results.flatMap((r) => r.statuses),
  };
}

// =============================================================================
//  3. Zostavenie podkladov pre AI
// =============================================================================

function formatDbText(db: DbBundle): string {
  const now = Date.now();
  const blocks: string[] = [];
  const isWaste = (e: EventRow) => (e.type ?? "").toLowerCase() === "odpad";
  const notable = (list: EventRow[]) => list.filter((e) => !isWaste(e));

  const past = notable(db.events.filter((e) => Date.parse(e.starts_at) <= now));
  const future = notable(db.events.filter((e) => Date.parse(e.starts_at) > now));
  const waste = db.events.filter(isWaste);

  if (past.length) {
    const lines = ["A) PODUJATIA A TERMÍNY UPYNULÉHO TÝŽDŇA (kalendár obce – dáta z aplikácie):"];
    for (const e of past) {
      lines.push(
        `- [${fmtDateTime(e.starts_at)}] ${e.title}` +
          `${e.location ? ` (miesto: ${e.location})` : ""}` +
          `${e.description ? ` — ${truncate(stripHtml(e.description), 220)}` : ""}`,
      );
    }
    blocks.push(lines.join("\n"));
  }

  if (future.length) {
    const lines = ["B) PRIPRAVOVANÉ PODUJATIA (kalendár obce – dáta z aplikácie):"];
    for (const e of future) {
      lines.push(
        `- [${fmtDateTime(e.starts_at)}] ${e.title}` +
          `${e.location ? ` (miesto: ${e.location})` : ""}` +
          `${e.description ? ` — ${truncate(stripHtml(e.description), 220)}` : ""}`,
      );
    }
    blocks.push(lines.join("\n"));
  }

  if (db.announcements.length) {
    const lines = ["C) OZNAMY OBCE (oznamy v aplikácii, napr. z webu obce):"];
    for (const a of db.announcements) {
      lines.push(
        `- [${fmtDate(a.published_at)}] ${a.title}` +
          `${a.link ? ` — ${a.link}` : ""}` +
          ` — ${truncate(stripHtml(a.content ?? ""), 220)}`,
      );
    }
    blocks.push(lines.join("\n"));
  }

  if (waste.length) {
    const lines = ["D) KALENDÁR ZBERU ODPADU (kalendár obce – dáta z aplikácie):"];
    for (const e of waste) lines.push(`- [${fmtDateTime(e.starts_at)}] ${e.title}`);
    blocks.push(lines.join("\n"));
  }

  if (db.tips.length) {
    const lines = [
      "E) AKCIE V OKOLÍ – tip modulu aplikácie (uvádzaj len ako tip, presne s dátumom z podkladu):",
    ];
    for (const t of db.tips) {
      lines.push(
        `- ${t.nazov} (${t.obec}) — ${t.datum_cas}${t.miesto ? `, ${t.miesto}` : ""}` +
          `${t.popis ? ` — ${truncate(stripHtml(t.popis), 160)}` : ""}`,
      );
    }
    blocks.push(lines.join("\n"));
  }

  if (!blocks.length) return "(žiadne dáta z aplikácie)";
  return blocks.join("\n\n");
}

function formatFeedsText(items: FeedItem[]): string {
  if (!items.length) return "(žiadne nové články z RSS zdrojov za posledných 8 dní)";
  return items
    .map(
      (i) =>
        `- [${fmtDate(i.ts)}] ${i.title}\n  Zdroj: ${i.source}\n  Odkaz: ${i.link}` +
        `${i.summary ? `\n  Zhrnutie: ${i.summary}` : ""}`,
    )
    .join("\n");
}

function buildUserPrompt(dbText: string, feedText: string, searchEnabled: boolean): string {
  const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  const today = new Date();
  const from = new Date(Date.now() - 6 * 86_400_000);

  const parts = [
    `Dnešný dátum: ${fmt(today)}. Sledované obdobie (uplynulý týždeň): ${fmt(from)} – ${fmt(today)}.`,
    `Čerpaj V PRVOM RADE z PODKLADU 1 (dáta, ktoré aplikácia už má) a až potom z PODKLADU 2 (overené RSS články z internetu).`,
    `=== PODKLAD 1: DÁTA Z APLIKÁCIE ===\n${dbText}`,
    `=== PODKLAD 2: OVERENÉ RSS ČLÁNKY Z INTERNETU (len povolené zdroje, posledné dni) ===\n${feedText}`,
  ];

  if (searchEnabled) {
    parts.push(
      `=== PODKLAD 3: ŽIVÉ VYHĽADÁVANIE ===\n` +
        `Máš k dispozícii aktuálne výsledky vyhľadávania. Použi IBA len výsledky priamo ` +
        `súvisiace s Ružindolom, Trnavou alebo blízkym okolím a uveď pri nich zdroj s odkazom. ` +
        `Ak výsledky nič relevantné nepriniesli, buď o tom úprimný – nič si nedoplňuj.`,
    );
  } else {
    parts.push(
      `ŽIVÉ VYHĽADÁVANIE NIE JE k dispozícii – pracuj výhradne s PODKLADOM 1 a PODKLADOM 2. ` +
        `Ak podklady neobsahujú relevantnú udalosť, povedz to priamo; nič si nedoplňuj.`,
    );
  }

  parts.push(
    `Pole "obdobie" vyplň ako rozsah uplynulého týždňa, napr. "Týždeň 29.9. – 5.10.2026".`,
  );
  return parts.join("\n\n");
}

// =============================================================================
//  4. Kontrola pravdivosti pred uložením (anti-fabrikácia)
// =============================================================================

const extractUrls = (text: string): string[] => text.match(/https?:\/\/[^\s)\]">]+/g) ?? [];

function isAllowedUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Kľúčové slová z názvov poskytnutých podkladov (na viazanie článku na zdroj). */
function sourceKeywords(db: DbBundle, feeds: FeedItem[]): string[] {
  const titles = [
    ...db.events.map((e) => e.title),
    ...db.announcements.map((a) => a.title),
    ...db.tips.map((t) => t.nazov),
    ...feeds.map((f) => f.title),
  ];
  const words = new Set<string>();
  for (const title of titles) {
    for (const word of normalize(title).split(" ")) {
      if (word.length >= 6) words.add(word);
    }
  }
  return [...words];
}

type Verdict = { ok: boolean; reason?: string };

/**
 * Overí článok voči podkladom:
 *  – bez živého vyhľadávania smie obsahovať len odkazy z povolených domén,
 *  – článok musí byť naviazaný na poskytnuté podklady (odkaz alebo kľúčové
 *    slovo z ich názvov), inak ide o potenciálne vymyslený obsah,
 *  – poctivé "nepodarilo sa overiť" prejde aj bez väzby.
 */
function verifyArticle(obsah: string, db: DbBundle, feeds: FeedItem[], grounded: boolean): Verdict {
  const urls = extractUrls(obsah);

  if (!grounded) {
    const bad = urls.find((u) => !isAllowedUrl(u));
    if (bad) return { ok: false, reason: `odkaz mimo povolených zdrojov: ${bad.slice(0, 70)}` };
  }

  const hasContext = db.events.length + db.announcements.length + db.tips.length + feeds.length > 0;
  if (hasContext) {
    const honest = /nepodarilo sa overi|overiť sa nepodarilo|nepodarilo overi/i.test(obsah);
    if (!honest && urls.length === 0) {
      const norm = normalize(obsah);
      const bound = sourceKeywords(db, feeds).some((k) => norm.includes(k));
      if (!bound) return { ok: false, reason: "článok sa neodkazuje na žiadny podklad" };
    }
  }

  return { ok: true };
}

// =============================================================================
//  5. Volanie Gemini API (s podporou Google Search grounding + spätným ťahom)
// =============================================================================

type GenResult = {
  status: number;
  text: string;
  errText: string;
  error: string | null;
  retryAfterMs: number | null;
  groundingBlocked: boolean;
};

const RETRYABLE = new Set([429, 503]);
const MAX_TRIES = 2; // 1 pokus + 1 reštart
const BASE_BACKOFF_MS = 1500;
const MAX_CALLS = 6; // celkový strop Gemini volaní na jeden beh

/**
 * Zavolá Gemini API. Pri HTTP 503 (preťaženie) a 429 (kvóta) skúsi volanie
 * ešte raz so spätným ťahom 2,5 s × poradové číslo pokusu.
 */
async function geminiGenerate(
  model: string,
  key: string,
  grounding: boolean | null,
  includeSchema: boolean,
  userPrompt: string,
): Promise<GenResult> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.4,
    maxOutputTokens: 2560,
    responseMimeType: "application/json",
  };

  // iba novšie modely podporujú responseSchema – pri chybe 400 skúsime bez neho
  if (includeSchema) generationConfig.responseSchema = RESPONSE_SCHEMA;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + userPrompt }] }],
    generationConfig,
    // živé vyhľadávanie cez Google Search grounding (vyžaduje platený plán)
    ...(grounding ? { tools: [{ google_search: {} }] } : {}),
  };

  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      if (tries === MAX_TRIES) {
        return {
          status: 0,
          text: "",
          errText: "",
          error: `Chyba siete pri volaní Gemini: ${e}`,
          retryAfterMs: null,
          groundingBlocked: false,
        };
      }
      await sleep(BASE_BACKOFF_MS * tries);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      return {
        status: res.status,
        text: parts
          .map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim(),
        errText: "",
        error: null,
        retryAfterMs: null,
        groundingBlocked: false,
      };
    }

    const errText = await res.text().catch(() => "");
    const retryAfter = Number(res.headers.get("retry-after") ?? "0");
    const out: GenResult = {
      status: res.status,
      text: "",
      errText: errText.slice(0, 300),
      error: `HTTP ${res.status}`,
      retryAfterMs: retryAfter > 0 ? retryAfter * 1000 : null,
      groundingBlocked:
        (res.status === 400 || res.status === 429) && /search|grounding/i.test(errText),
    };

    if (RETRYABLE.has(res.status) && tries < MAX_TRIES) {
      await sleep(out.retryAfterMs ?? BASE_BACKOFF_MS * tries);
      continue;
    }
    return out;
  }

  return {
    status: 0,
    text: "",
    errText: "",
    error: "Neznáma chyba volania Gemini",
    retryAfterMs: null,
    groundingBlocked: false,
  };
}

// =============================================================================
//  6. Týždenné mazanie starých vydaní (archív sa sám aktualizuje)
// =============================================================================

/** Vymaže vydania staršie než `olderThanMs`; vráti počet zmazaných riadkov. */
async function cleanupOld(db: Db, olderThanMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  try {
    const { data, error } = await db.from(TABLE).delete().lt("created_at", cutoff).select("id");
    if (error) {
      console.error("[sumar] Mazanie starých vydaní zlyhalo:", error.message);
      return 0;
    }
    return data?.length ?? 0;
  } catch (e) {
    console.error("[sumar] Mazanie starých vydaní výnimka:", e);
    return 0;
  }
}

// =============================================================================
//  7. Hlavný beh funkcie
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    // --- manuálne čistenie archívu (bez generovania) ------------------------
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const qs = new URL(req.url).searchParams;
    const action = String(body.action ?? qs.get("action") ?? "");
    if (action === "cleanup") {
      const days = Number(body.days ?? qs.get("days") ?? RETENTION_DAYS);
      const ms = Number.isFinite(days) && days >= 0 ? days * 86_400_000 : RETENTION_MS;
      const deleted = await cleanupOld(supabase, ms);
      return json({ success: true, action: "cleanup", deleted });
    }

    if (!geminiKey) {
      return json({ success: false, error: "Chýba GEMINI_API_KEY." }, 500);
    }

    // --- PODKLADY: dáta z aplikácie + overené RSS (paralelne) ---------------
    const [dbLoad, feedLoad] = await Promise.all([loadDbBundle(supabase), fetchFeeds()]);
    const db = dbLoad.bundle;
    const feeds = feedLoad.items;
    const dbText = formatDbText(db);
    const feedText = formatFeedsText(feeds);
    const sourceCounts = {
      dbEvents: db.events.length,
      dbAnnouncements: db.announcements.length,
      dbTips: db.tips.length,
      rssItems: feeds.length,
    };

    // --- diagnostika podkladov (bez volania Gemini) ------------------------
    if (action === "debug") {
      return json({
        success: true,
        action: "debug",
        sources: sourceCounts,
        dbErrors: dbLoad.errors,
        feedStatuses: feedLoad.statuses,
        dbTextLength: dbText.length,
        feedTextLength: feedText.length,
        dbText: dbText.slice(0, 1500),
        feedText: feedText.slice(0, 1500),
      });
    }

    // --- generovanie: grounding → schema → plain, grounded varianty sa po
    //     prvej kvótovej 429 preskočia, pri 503/429 sa vždy skúsi retry ------
    const attempts: string[] = [];
    let article: { titulok: string; obsah: string; obdobie: string } | null = null;
    let grounded = false;
    let usedModel = "";
    let groundingBlocked = false;
    let calls = 0;
    const buildPrompt = (searchEnabled: boolean, withSchema: boolean) =>
      buildUserPrompt(dbText, feedText, searchEnabled) + (withSchema ? "" : schemaHint());

    const variants: { grounding: boolean | null; schema: boolean; label: string }[] = [
      { grounding: true, schema: true, label: "grounding+schema" },
      { grounding: true, schema: false, label: "grounding" },
      { grounding: null, schema: true, label: "schema" },
      { grounding: null, schema: false, label: "plain" },
    ];

    outer: for (const model of GEMINI_MODELS) {
      for (const v of variants) {
        if (v.grounding && groundingBlocked) continue;
        if (calls >= MAX_CALLS) break outer;
        calls++;
        const result = await geminiGenerate(
          model,
          geminiKey,
          v.grounding,
          v.schema,
          buildPrompt(Boolean(v.grounding), v.schema),
        );
        if (result.status === 404) {
          attempts.push(`${model} -> 404 model neexistuje`);
          break;
        }
        if (result.groundingBlocked) {
          attempts.push(`${model}/${v.label} -> ${result.status} search grounding quota`);
          groundingBlocked = true;
          continue;
        }
        if (result.status === 429 || result.status === 503) {
          attempts.push(`${model}/${v.label} -> ${result.status} ${result.errText}`);
          continue;
        }
        if (result.error || !result.text) {
          attempts.push(`${model}/${v.label} -> ${result.error ?? "prázdna odpoveď"}`);
          continue;
        }

        try {
          const candidate = extractJson(result.text) as Record<string, unknown>;
          const titulok = String(candidate.titulok ?? "").trim();
          const obsah = String(candidate.obsah ?? "").trim();
          if (!titulok || !obsah) throw new Error("chýba titulok alebo obsah");

          const verdict = verifyArticle(obsah, db, feeds, Boolean(v.grounding));
          if (!verdict.ok) {
            attempts.push(`${model}/${v.label} -> zamietnuté: ${verdict.reason}`);
            continue;
          }

          article = {
            titulok: truncate(titulok, 160),
            obsah,
            obdobie: truncate(String(candidate.obdobie ?? "").trim(), 80),
          };
          grounded = Boolean(v.grounding);
          usedModel = model;
          break outer;
        } catch (e) {
          attempts.push(`${model}/${v.label} -> ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
      }
    }

    if (!article) {
      console.error("[sumar] Žiadny overený výstup – ukladám nič. Pokusy:", attempts);
      return json(
        {
          success: false,
          error: "Nepodarilo sa vygenerovať overený (pravdivý) súhrn – nič sa neuložilo.",
          attempts: attempts.slice(-10),
          sources: sourceCounts,
        },
        502,
      );
    }

    const obdobie =
      article.obdobie ||
      (() => {
        const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
        return `Týždeň ${fmt(new Date(Date.now() - 6 * 86_400_000))} – ${fmt(new Date())}`;
      })();

    const { error: insertError } = await supabase.from(TABLE).insert({
      titulok: article.titulok,
      obsah: article.obsah,
      obdobie,
    });
    if (insertError) {
      console.error("Vloženie do tyzdenne_sumare zlyhalo:", insertError);
      return json({ success: false, error: insertError.message }, 500);
    }

    // Staré vydania sa mažú až PO úspešnom uložení nového – pri výpadku
    // generovania vždy ostane v archíve posledné platné vydanie.
    const deleted = await cleanupOld(supabase, RETENTION_MS);

    console.log(
      `[sumar] OK model=${usedModel} grounded=${grounded} deletedOld=${deleted} zdroje=${JSON.stringify(sourceCounts)}`,
    );
    return json({
      success: true,
      model: usedModel,
      grounded,
      inserted: 1,
      deletedOld: deleted,
      obdobie,
      sources: sourceCounts,
      attempts: attempts.slice(-5),
    });
  } catch (e) {
    console.error("[sumar] Všeobecná chyba:", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
