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
//         publikované v sumarizovanom kalendárnom týždni.
//      3. ŽIVÉ VYHĽADÁVANIE – Google Search grounding v Gemini (iba ak kvóta
//         plánu dovolí; inak sa preskočí a ostane bod 1 + 2).
//  • ANTI-FABRIKÁCIA: dátumy aj obdobie sú obmedzené na posledný ukončený
//    pondelok–nedeľa týždeň; odkazy sa overujú voči načítaným zdrojom.
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
const TIME_ZONE = "Europe/Bratislava";

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
Zostavíš krátky, vecný súhrn za presne určený ukončený kalendárny týždeň.
Použi VÝHRADNE fakty z podkladov doručených v používateľskom prompte.

ZAKÁZANÉ (okamžite diskvalifikuje odpoveď):
- vymýšľať udalosti, dátumy, časy, miesta, mená, citáty, výsledky zápasov,
  zásahy, sumy, stavby, projekty alebo rozhodnutia, ktoré nie sú v podkladoch,
- vytvárať fiktívne správy o obecnom úrade, hasičoch, obci alebo neexistujúcich
  podujatiach,
- spájať podklady do udalostí, ktoré sa nestali, alebo meniť ich zmysel,
- používať fakty, ktoré nie sú v podkladoch (ani "zo svojej pamäte"), pokiaľ
  nejde o všeobecne známe nemenné skutočnosti (napr. Ružindol leží v okrese
  Trnava).

AKO PÍSAŤ:
1. Každá konkrétnejšia informácia musí byť prevzatá z podkladov; uveď k nej
   dátum (deň. mesiac) tak, ako je uvedený v podkladoch.
2. Zahrň iba udalosti, ktoré spadajú do určeného týždňa. Neuvádzaj budúce
   udalosti mimo tohto obdobia. Termíny zberu odpadu uveď stručne ako
   "Kalendár odpadu".
3. Na konci článku pridaj sekciu "Zdroje:" – každý zdroj na samostatnom riadku
   v tvare "Zdroj: <názov> – <úplná URL>", najviac 5 zdrojov, IBA z podkladov.
4. Ak podklady neobsahujú nič použiteľné, napíš iba stručne, že sa za daný
   týždeň nepodarilo overiť konkrétne udalosti. Nevytváraj všeobecný prehľad.
5. Štýl: slovensky, slušne, stručne, 2–4 krátke odseky, žiadne emoji.
6. Vráť IBA čistý JSON podľa schémy, žiadny text navyše. Pole "obdobie"
   musí presne zodpovedať určenému týždňu.
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

type WeekRange = {
  startKey: string;
  endKey: string;
  startIso: string;
  endExclusiveIso: string;
  label: string;
};

function dateKeyInTimeZone(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDaysToKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localMidnightIso(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(utcGuess))
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Nepodarilo sa určiť časové pásmo pre ${dateKey}.`);
  const sign = match[1] === "+" ? 1 : -1;
  const minutes = sign * (Number(match[2]) * 60 + Number(match[3]));
  return new Date(utcGuess - minutes * 60_000).toISOString();
}

function lastCompletedWeek(now = new Date()): WeekRange {
  const todayKey = dateKeyInTimeZone(now);
  const todayUtc = new Date(`${todayKey}T00:00:00.000Z`);
  const daysSinceMonday = (todayUtc.getUTCDay() + 6) % 7;
  const currentWeekStart = addDaysToKey(todayKey, -daysSinceMonday);
  const startKey = addDaysToKey(currentWeekStart, -7);
  const endKey = addDaysToKey(currentWeekStart, -1);
  const format = (key: string) =>
    new Date(`${key}T00:00:00.000Z`).toLocaleDateString("sk-SK", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return {
    startKey,
    endKey,
    startIso: localMidnightIso(startKey),
    endExclusiveIso: localMidnightIso(currentWeekStart),
    label: `Týždeň ${format(startKey)} – ${format(endKey)}`,
  };
}

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
  konanie_dna: string | null;
  kategoria: string;
  miesto: string;
  popis: string | null;
};
type DbBundle = { events: EventRow[]; announcements: AnnouncementRow[]; tips: TipRow[] };
type FeedItem = { source: string; title: string; link: string; ts: number; summary: string };

/**
 * Načíta dáta, ktoré aplikácia už má (kalendár obce, oznamy, tipy na víkend).
 * Chyby sa vrátia volajúcemu; pri neúplných podkladoch sa článok negeneruje.
 */
type DbLoad = { bundle: DbBundle; errors: string[] };

async function loadDbBundle(db: Db, week: WeekRange): Promise<DbLoad> {
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
        .gte("starts_at", week.startIso)
        .lt("starts_at", week.endExclusiveIso)
        .order("starts_at", { ascending: true })
        .limit(50),
    ),
    run<AnnouncementRow[]>("announcements", () =>
      db
        .from("announcements")
        .select("title, content, link, published_at, priority")
        .gte("published_at", week.startIso)
        .lt("published_at", week.endExclusiveIso)
        .order("published_at", { ascending: false })
        .limit(20),
    ),
    run<TipRow[]>("okolite_akcie", () =>
      db
        .from("okolite_akcie")
        .select("nazov, obec, datum_cas, konanie_dna, kategoria, miesto, popis")
        .gte("konanie_dna", week.startKey)
        .lte("konanie_dna", week.endKey)
        .order("vzdialenost_km", { ascending: true })
        .limit(15),
    ),
  ]);

  return { bundle: { events, announcements, tips }, errors };
}

// =============================================================================
//  2. PODKLAD 2 – overené RSS zdroje z internetu (povolené domény)
// =============================================================================

/** Prevedie iba položky publikované v týždni, ktorý sa sumarizuje. */
function parseFeed(xml: string, feedLabel: string, week: WeekRange): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items: FeedItem[] = [];
  const from = Date.parse(week.startIso);
  const until = Date.parse(week.endExclusiveIso);

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

    if (!title || Number.isNaN(ts) || ts < from || ts >= until || !isAllowedUrl(link)) continue;

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
async function fetchFeed(feed: (typeof FEEDS)[number], week: WeekRange): Promise<FeedLoad> {
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
    const items = parseFeed(await res.text(), feed.label, week);
    return {
      items,
      statuses: [{ label: feed.label, url: feed.url, count: items.length, error: null }],
    };
  } catch (e) {
    return status(0, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }
}

async function fetchFeeds(week: WeekRange): Promise<FeedLoad> {
  const results = await Promise.all(FEEDS.map((feed) => fetchFeed(feed, week)));
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
  if (!items.length) return "(žiadne články z RSS zdrojov v sledovanom týždni)";
  return items
    .map(
      (i) =>
        `- [${fmtDate(i.ts)}] ${i.title}\n  Zdroj: ${i.source}\n  Odkaz: ${i.link}` +
        `${i.summary ? `\n  Zhrnutie: ${i.summary}` : ""}`,
    )
    .join("\n");
}

function buildUserPrompt(
  dbText: string,
  feedText: string,
  searchEnabled: boolean,
  week: WeekRange,
): string {
  const parts = [
    `Dnešný dátum: ${fmtDate(Date.now())}. Sledované obdobie: ${week.label} ` +
      `(${week.startKey} až ${week.endKey}, vrátane).`,
    `Čerpaj V PRVOM RADE z PODKLADU 1 (dáta, ktoré aplikácia už má) a až potom z PODKLADU 2 (overené RSS články z internetu).`,
    `=== PODKLAD 1: DÁTA Z APLIKÁCIE ===\n${dbText}`,
    `=== PODKLAD 2: OVERENÉ RSS ČLÁNKY Z INTERNETU (len povolené zdroje, sledovaný týždeň) ===\n${feedText}`,
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
    `Pole "obdobie" vyplň presne takto: "${week.label}". ` +
      `Neuvádzaj udalosti pred ${week.startKey} ani po ${week.endKey}.`,
  );
  return parts.join("\n\n");
}

// =============================================================================
//  4. Kontrola pravdivosti pred uložením (anti-fabrikácia)
// =============================================================================

const extractUrls = (text: string): string[] => text.match(/https?:\/\/[^\s)\]">]+/g) ?? [];

function normalizeSourceUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return null;
    }
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

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

function containsOnlyWeekDates(text: string, week: WeekRange): boolean {
  const years = [...new Set([week.startKey.slice(0, 4), week.endKey.slice(0, 4)])].map(Number);
  const datePattern = /\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?\b/g;
  for (const match of text.matchAll(datePattern)) {
    const candidateYears = match[3] ? [Number(match[3])] : years;
    const inWeek = candidateYears.some((year) => {
      const key = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
      const timestamp = Date.parse(`${key}T00:00:00.000Z`);
      return (
        Number.isFinite(timestamp) &&
        new Date(timestamp).toISOString().slice(0, 10) === key &&
        key >= week.startKey &&
        key <= week.endKey
      );
    });
    if (!inWeek) return false;
  }
  return true;
}

type Verdict = { ok: boolean; reason?: string };

/**
 * Overí článok voči podkladom:
 *  – odkazy musia pochádzať z databázy, RSS alebo grounding metadata,
 *  – text musí byť naviazaný na načítané podklady a týždenné obdobie,
 *  – poctivé "nepodarilo sa overiť" prejde aj bez väzby.
 */
function verifyArticle(
  titulok: string,
  obsah: string,
  db: DbBundle,
  feeds: FeedItem[],
  groundingUrls: string[],
  week: WeekRange,
): Verdict {
  const urls = extractUrls(obsah);
  const groundedUrlSet = new Set(
    groundingUrls.map(normalizeSourceUrl).filter((url): url is string => Boolean(url)),
  );
  const knownUrls = new Set(
    [
      ...db.announcements.map((announcement) => announcement.link ?? ""),
      ...feeds.map((feed) => feed.link),
      ...groundingUrls,
    ]
      .map(normalizeSourceUrl)
      .filter((url): url is string => Boolean(url)),
  );
  const unknownUrl = urls.find((url) => {
    const normalized = normalizeSourceUrl(url);
    return !normalized || !knownUrls.has(normalized);
  });
  if (unknownUrl) {
    return { ok: false, reason: `odkaz nepatrí k načítaným zdrojom: ${unknownUrl.slice(0, 70)}` };
  }

  const text = `${titulok}\n${obsah}`;
  const textWithoutLinks = text.replace(/https?:\/\/\S+/g, "").split(/\n\s*Zdroje:/i)[0];
  if (!containsOnlyWeekDates(textWithoutLinks, week)) {
    return { ok: false, reason: "článok obsahuje dátum mimo sumarizovaného týždňa" };
  }
  const hasContext = db.events.length + db.announcements.length + db.tips.length + feeds.length > 0;
  const honest = /nepodarilo sa overi|overiť sa nepodarilo|nepodarilo overi/i.test(obsah);
  const sourceSection = obsah.split(/\n\s*Zdroje:/i)[1] ?? "";
  const hasDatabaseSourceLabel =
    /kalend[aá]r obce|oznamy obce|údaje aplikácie/i.test(sourceSection);
  const hasCitedSourceUrl = extractUrls(sourceSection).length > 0;
  const normalizedText = normalize(text);
  const boundToSource =
    sourceKeywords(db, feeds).some((keyword) => normalizedText.includes(keyword)) ||
    urls.some((url) => {
      const normalized = normalizeSourceUrl(url);
      return normalized !== null && groundedUrlSet.has(normalized);
    });
  if (!honest && (!hasContext || !boundToSource)) {
    return { ok: false, reason: "článok nemá overiteľnú väzbu na žiadny podklad" };
  }
  if (!honest && !hasCitedSourceUrl && !hasDatabaseSourceLabel) {
    return { ok: false, reason: "článku chýba zoznam použitých zdrojov" };
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
  groundingUrls: string[];
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
    maxOutputTokens: 2560,
    responseMimeType: "application/json",
    temperature: 0.1,
  };

  // iba novšie modely podporujú responseSchema – pri chybe 400 skúsime bez neho
  if (includeSchema) generationConfig.responseSchema = RESPONSE_SCHEMA;

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
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
          groundingUrls: [],
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
        groundingUrls: (data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
          .map((chunk: { web?: { uri?: string } }) => chunk.web?.uri)
          .filter((uri: unknown): uri is string => typeof uri === "string"),
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
      groundingUrls: [],
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
    groundingUrls: [],
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
    const week = lastCompletedWeek();
    const [dbLoad, feedLoad] = await Promise.all([
      loadDbBundle(supabase, week),
      fetchFeeds(week),
    ]);
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

    if (dbLoad.errors.length > 0) {
      console.error("[sumar] Podklady z databázy sa nepodarilo úplne načítať:", dbLoad.errors);
      return json(
        { success: false, error: "database_sources_unavailable", dbErrors: dbLoad.errors },
        503,
      );
    }

    // --- generovanie: grounding → schema → plain, grounded varianty sa po
    //     prvej kvótovej 429 preskočia, pri 503/429 sa vždy skúsi retry ------
    const attempts: string[] = [];
    let article: { titulok: string; obsah: string; obdobie: string } | null = null;
    let grounded = false;
    let usedModel = "";
    let groundingBlocked = false;
    let calls = 0;
    const hasInputs = db.events.length + db.announcements.length + db.tips.length + feeds.length > 0;
    if (!hasInputs) {
      article = {
        titulok: "Týždenný prehľad Ružindola",
        obsah: `Za obdobie ${week.label} sa z dostupných podkladov nepodarilo overiť konkrétne udalosti.`,
        obdobie: week.label,
      };
      usedModel = "no-data";
    }
    const buildPrompt = (searchEnabled: boolean, withSchema: boolean) =>
      buildUserPrompt(dbText, feedText, searchEnabled, week) + (withSchema ? "" : schemaHint());

    const variants: { grounding: boolean | null; schema: boolean; label: string }[] = [
      { grounding: true, schema: true, label: "grounding+schema" },
      { grounding: true, schema: false, label: "grounding" },
      { grounding: null, schema: true, label: "schema" },
      { grounding: null, schema: false, label: "plain" },
    ];

    outer: for (const model of GEMINI_MODELS) {
      if (article) break outer;
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

          const verdict = verifyArticle(
            titulok,
            obsah,
            db,
            feeds,
            result.groundingUrls,
            week,
          );
          if (!verdict.ok) {
            attempts.push(`${model}/${v.label} -> zamietnuté: ${verdict.reason}`);
            continue;
          }

          const articleText = obsah.split(/\n\s*Zdroje:/i)[0].trim();
          const paragraphCount = articleText.split(/\n\s*\n/).filter(Boolean).length;
          if (
            articleText.length > 1800 ||
            (!/nepodarilo sa overi|overiť sa nepodarilo|nepodarilo overi/i.test(obsah) &&
              (paragraphCount < 2 || paragraphCount > 4))
          ) {
            attempts.push(`${model}/${v.label} -> článok nespĺňa limit stručnosti`);
            continue;
          }

          article = {
            titulok: truncate(titulok, 160),
            obsah,
            obdobie: week.label,
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

    const obdobie = week.label;

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
