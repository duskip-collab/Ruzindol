// =============================================================================
//  Edge Function:  aktualizuj-akcie
//  Autonómny AI agent (Google Gemini) pre modul "Akcie v okolí".
//
//  • Beží VÝHRADNE na pozadí – nemá UI a neprijíma vstup od používateľa.
//  • Vyhľadá podujatia/trhy/kultúru/šport/hody/gastro v okruhu do 30 km od
//    obce Ružindol (Trnava, Smolenice, Modra, Trstín, ...).
//  • Vyžaduje grounding zdroj pre každú položku a atomicky nahrádza dáta v
//    tabuľke `okolite_akcie` až po úspešnej validácii celej odpovede.
//  • Využíva VÝHRADNE Google Gemini (žiadni iní poskytovatelia). Pred hľadaním
//    si stiahne zoznam dostupných modelov cez Gemini REST API a postupne preverí
//    VŠETKY flash modely od verzie 1.5 a vyššie, kým jedna odpoveď prejde
//    kontrolou grounding zdrojov.
//
//  Nasadenie:
//    supabase functions deploy aktualizuj-akcie --no-verify-jwt
//  Naplánovanie (napr. raz denne) v Supabase Dashboard -> Edge Functions ->
//  Schedules, alebo cez pg_cron (net.http_post na URL funkcie).
//
//  ENV premenné (Supabase -> Project Settings -> Edge Functions -> Secrets):
//    GEMINI_API_KEY = tvoj Google AI Studio kľúč
//    GEMINI_MODEL (voliteľné) = model preverený ako prvý (predvolene gemini-2.5-flash)
//  (SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY sú dostupné automaticky.)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Preverujú sa len "flash" modely od tejto verzie (vrátane).
const MIN_FLASH_VERSION_MAJOR = 1;
const MIN_FLASH_VERSION_MINOR = 5;

// Záložný zoznam ID (ak zoznam modelov cez REST API nepríde). Slúži len ako
// sieťová poistka – filtre nižšie naň rovnako aplikujú podmienku flash >= 1.5.
const FALLBACK_FLASH_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

/** Vráti verziu [major, minor] pre flash model od 1.5 (vrátane), inak null. */
function parseFlashVersion(modelId: string): [number, number] | null {
  if (!/flash/i.test(modelId)) return null;
  const match = modelId.match(/gemini-(\d+)\.(\d+)/i);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (
    major < MIN_FLASH_VERSION_MAJOR ||
    (major === MIN_FLASH_VERSION_MAJOR && minor < MIN_FLASH_VERSION_MINOR)
  ) {
    return null;
  }
  return [major, minor];
}

/**
 * Načíta VŠETKY dostupné flash modely (>= 1.5) z Gemini REST API a zoradí ich
 * od najnovšej verzie po najstaršiu. Pri chybe siete alebo HTTP chybe použije
 * záložný zoznam, aby vyhľadávanie nikdy nezostalo bez kandidátov.
 */
async function listFlashModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(GEMINI_API_BASE, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const payload = await res.json();
    const rawModels: unknown[] = Array.isArray(payload?.models) ? payload.models : [];

    const candidates: { id: string; version: [number, number] }[] = [];
    const seen = new Set<string>();
    for (const raw of rawModels) {
      if (!raw || typeof raw !== "object") continue;
      const model = raw as { name?: unknown; supportedGenerationMethods?: unknown };
      const id = typeof model.name === "string" ? model.name.replace(/^models\//, "") : "";
      if (!id || seen.has(id)) continue;
      // Vylúčime generátory obrázkov/zvuku a modely bez generateContent.
      if (/image|video|audio|embedding|tts|aqa/i.test(id)) continue;
      const methods = Array.isArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods.filter((m): m is string => typeof m === "string")
        : [];
      if (methods.length > 0 && !methods.includes("generateContent")) continue;
      const version = parseFlashVersion(id);
      if (!version) continue;
      seen.add(id);
      candidates.push({ id, version });
    }

    candidates.sort(
      (a, b) =>
        b.version[0] - a.version[0] || b.version[1] - a.version[1] || a.id.localeCompare(b.id),
    );
    return candidates.map((candidate) => candidate.id);
  } catch (error) {
    console.warn(`Zoznam Gemini modelov sa nepodarilo načítať, použijem záložný: ${error}`);
    return FALLBACK_FLASH_MODELS.filter((id) => parseFlashVersion(id) !== null);
  }
}

const EVENT_WINDOW_DAYS = 30;
const TIME_ZONE = "Europe/Bratislava";
const ALLOWED_MUNICIPALITIES = new Set(
  [
    "Ružindol",
    "Trnava",
    "Smolenice",
    "Modra",
    "Častá",
    "Píla",
    "Dolné Orešany",
    "Horné Orešany",
    "Trstín",
    "Naháč",
    "Dechtice",
    "Cífer",
    "Šúrovce",
    "Križovany nad Dudváhom",
    "Suchá nad Parnou",
    "Zvončín",
    "Biely Kostol",
    "Hrnčiarovce nad Parnou",
    "Voderady",
    "Košolná",
    "Borová",
    "Dolná Krupá",
    "Horná Krupá",
    "Dolné Dubové",
    "Jaslovské Bohunice",
    "Dlhá",
    "Lošonec",
    "Budmerice",
    "Jablonec",
    "Kaplna",
    "Igram",
    "Báhoň",
    "Vištuk",
    "Dubová",
    "Vinosady",
    "Zeleneč",
    "Bohdanovce nad Trnavou",
    "Špačince",
    "Zavar",
    "Brestovany",
    "Opoj",
    "Vlčkovce",
    "Majcichov",
    "Pavlice",
    "Siladice",
    "Dolné Zelenice",
    "Vinohrady nad Váhom",
    "Červeník",
    "Kľačany",
    "Pusté Úľany",
    "Hoste",
    "Abrahám",
    "Kátlovce",
    "Nižná",
    "Dobrá Voda",
    "Radošovce",
    "Pezinok",
    "Šenkvice",
    "Limbach",
    "Hlohovec",
    "Sereď",
    "Dolná Streda",
    "Váhovce",
    "Dvorníky",
    "Senec",
    "Blatné",
    "Veľké Úľany",
    "Sládkovičovo",
    "Kráľová pri Senci",
    "Bernolákovo",
    "Slovenský Grob",
    "Dolné Lovčice",
    "Veľké Kostoľany",
    "Chtelnica",
    "Šintava",
  ].map((name) => normalize(name)),
);

const KATEGORIE = ["trhy", "kultura", "sport", "hodove", "gastronomia"] as const;
type Kategoria = (typeof KATEGORIE)[number];

type AkciaRow = {
  nazov: string;
  popis: string | null;
  obec: string;
  vzdialenost_km: number;
  kategoria: Kategoria;
  datum_cas: string;
  konanie_dna: string;
  miesto: string;
  zdroj_url: string;
};

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

// Pevne daný systémový prompt (jediné zadanie agenta, žiadny vstup od usera).
const SYSTEM_PROMPT = `
Si autonómny AI agent komunálnej mobilnej aplikácie obce Ružindol (okres Trnava, Slovensko).
Tvojou jedinou úlohou je zostaviť zoznam REÁLNYCH verejných podujatí, trhov, hodov
a kultúrno-spoločenských akcií v okruhu DO 30 KM od obce Ružindol.

Prioritne pokrývaj tieto lokality (a ich blízke okolie):
Ružindol, Trnava, Smolenice, Modra, Častá, Píla, Dolné Orešany, Horné Orešany,
Trstín, Naháč, Dechtice, Cífer, Šúrovce, Križovany nad Dudváhom, Suchá nad Parnou,
Zvončín, Biely Kostol, Hrnčiarovce nad Parnou, Voderady, Košolná, Borová,
Dolná Krupá, Horná Krupá, Dolné Dubové, Jaslovské Bohunice, Dlhá, Lošonec,
Budmerice, Jablonec, Kaplna, Igram, Báhoň, Vištuk, Dubová, Vinosady, Zeleneč,
Bohdanovce nad Trnavou, Špačince, Zavar, Brestovany, Opoj, Vlčkovce, Majcichov,
Pavlice, Siladice, Dolné Zelenice, Vinohrady nad Váhom, Červeník, Kľačany,
Pusté Úľany, Hoste, Abrahám, Kátlovce, Nižná, Dobrá Voda, Radošovce, Pezinok,
Šenkvice, Limbach, Hlohovec, Sereď, Dolná Streda, Váhovce, Dvorníky, Senec,
Blatné, Veľké Úľany, Sládkovičovo, Kráľová pri Senci, Bernolákovo, Slovenský
Grob, Dolné Lovčice, Veľké Kostoľany, Chtelnica a Šintava.

Zameriavaj sa na akcie, ktoré sa konajú v najbližších dňoch až týždňoch: farmárske
a vianočné trhy, jarmoky, hody, koncerty, divadelné a folklórne predstavenia,
výstavy, športové podujatia (behy, zápasy, turnaje) a gastronomické akcie.

PRAVIDLÁ (dodrž ich bezpodmienečne):
1. Vráť IBA čistý JSON podľa poskytnutej schémy. Žiadny úvodný ani záverečný text.
2. Uveď iba podujatia potvrdené aktuálnymi a dôveryhodnými podkladmi alebo výsledkami
   vyhľadávania. Nepoužívaj vlastnú pamäť, odhady ani domýšľanie opakujúcich sa akcií.
3. Nikdy nevymýšľaj správy o obecnom úrade, hasičoch či obci ani fiktívne alebo
   neexistujúce podujatia. Ak pre akciu nemáš overiteľné podklady, vynechaj ju.
4. Ak sa nepodarí nájsť žiadnu overenú akciu v okruhu do 30 km, vráť
   {"akcie":[]} – kalendár nesmieš dopĺňať vymyslenými udalosťami.
5. "kategoria" musí byť presne jedna z hodnôt: trhy, kultura, sport, hodove, gastronomia.
6. "vzdialenost_km" = približná vzdialenosť vzdušnou čiarou od Ružindolu, číslo 0–30.
7. "datum_cas" = ľudsky čitateľný dátum a čas, napr. "Sobota 4.10.2026 od 09:00".
8. "miesto" = konkrétne miesto konania (námestie, kultúrny dom, park, športovisko...).
9. "obec" = názov obce alebo mesta.
10. "popis" = krátka, vecná 1–2 vetová pozvánka (max. 200 znakov).
11. Nikdy si nevymýšľaj kontakty ani ceny.
12. Zoraď akcie od najbližšej (najmenšia vzdialenosť) po najvzdialenejšiu.
13. Vráť všetky nájdené a overené podujatia v období; neobmedzuj ich počet na
    odhad a nevyplňuj chýbajúce položky vymyslenými udalosťami.
`.trim();

// Schéma výstupu – vynúti štruktúru presne podľa tabuľky `okolite_akcie`.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    akcie: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nazov: { type: "STRING", description: "Názov podujatia" },
          popis: { type: "STRING", description: "Krátka pozvánka (max 200 znakov)" },
          obec: { type: "STRING", description: "Názov obce/mesta" },
          vzdialenost_km: { type: "NUMBER", description: "Vzdialenosť od Ružindolu v km (0–30)" },
          kategoria: { type: "STRING", enum: [...KATEGORIE], description: "Kategória podujatia" },
          datum_cas: { type: "STRING", description: "Dátum a čas konania" },
          datum_iso: { type: "STRING", description: "Dátum podujatia vo formáte YYYY-MM-DD" },
          miesto: { type: "STRING", description: "Konkrétne miesto konania" },
          zdroj_url: {
            type: "STRING",
            description: "Presná URL overiteľného zdroja z výsledkov Google Search",
          },
        },
        required: [
          "nazov",
          "obec",
          "vzdialenost_km",
          "kategoria",
          "datum_cas",
          "datum_iso",
          "miesto",
          "zdroj_url",
        ],
      },
    },
  },
  required: ["akcie"],
};

/**
 * Ak model nepodporí responseSchema (napr. niektoré novšie modely), schému
 * pošleme v prompte ako text – výstup aj tak vynútime cez responseMimeType json.
 */
function schemaHint(): string {
  return `\n\nSchéma JSON (vráť presne túto štruktúru): {"akcie":[{"nazov":string,"popis":string,"obec":string,"vzdialenost_km":number,"kategoria":"trhy"|"kultura"|"sport"|"hodove"|"gastronomia","datum_cas":string,"datum_iso":"YYYY-MM-DD","miesto":string,"zdroj_url":string}]}`;
}

type GeminiAttempt = {
  ok: boolean;
  status: number;
  text?: string;
  details?: string;
  groundingUrls: string[];
  groundingSupports: { text: string; urls: string[] }[];
  provider?: string;
  model?: string;
};

/** Jedno volanie Gemini generateContent pre konkrétny model (s retry 429/503). */
async function geminiGenerate(
  model: string,
  apiKey: string,
  includeSchema: boolean,
): Promise<GeminiAttempt> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
  };
  if (includeSchema) generationConfig.responseSchema = RESPONSE_SCHEMA;

  const userPrompt = buildUserPrompt() + (includeSchema ? "" : schemaHint());
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig,
    tools: [{ google_search: {} }],
  });

  // Krátky spätný ťah pri preťažení (503) a vyčerpanej kvóte (429).
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      if (attempt === 2) {
        return {
          ok: false,
          status: 0,
          details: `Chyba siete pri volaní Gemini: ${e}`,
          groundingUrls: [],
          groundingSupports: [],
        };
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }

    if (res.ok) {
      const payload = await res.json();
      const candidate = payload?.candidates?.[0];
      const text: string =
        candidate?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
      const groundingUrls: string[] = groundingChunks
        .map((chunk: { web?: { uri?: string } }) => chunk.web?.uri)
        .filter((uri: unknown): uri is string => typeof uri === "string");
      const groundingSupports = (candidate?.groundingMetadata?.groundingSupports ?? [])
        .map((support: { segment?: { text?: string }; groundingChunkIndices?: number[] }) => ({
          text: support.segment?.text ?? "",
          urls: (support.groundingChunkIndices ?? [])
            .map((index) => groundingChunks[index]?.web?.uri)
            .filter((uri: unknown): uri is string => typeof uri === "string"),
        }))
        .filter(
          (support: { text: string; urls: string[] }) => support.text && support.urls.length > 0,
        );

      return {
        ok: true,
        status: res.status,
        text: text.trim(),
        groundingUrls,
        groundingSupports,
      };
    }

    const details = await res.text();
    // Opakovateľné len pri 429/503; pri 404 (neznámy model) rovno ďalší model.
    if ((res.status === 429 || res.status === 503) && attempt === 1) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "0");
      await new Promise((r) => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 1500));
      continue;
    }
    return {
      ok: false,
      status: res.status,
      details,
      groundingUrls: [],
      groundingSupports: [],
    };
  }

  return {
    ok: false,
    status: 0,
    details: "Neznáma chyba volania Gemini",
    groundingUrls: [],
    groundingSupports: [],
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLocalDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function displayDateMatches(dateText: string, dateKey: string): boolean {
  if (dateText.includes(dateKey)) return true;
  const [expectedYear, expectedMonth, expectedDay] = dateKey.split("-");
  const matches = dateText.matchAll(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/g);
  for (const [, day, month, year] of matches) {
    if (
      Number(day) === Number(expectedDay) &&
      Number(month) === Number(expectedMonth) &&
      (!year || Number(year) === Number(expectedYear))
    ) {
      return true;
    }
  }
  return false;
}

function buildUserPrompt(): string {
  const today = getLocalDateKey();
  const until = addDays(today, EVENT_WINDOW_DAYS);
  return `
Dnešný miestny dátum v Ružindole: ${today}. Hľadaj podujatia konajúce sa od ${today}
do ${until} vrátane. Vyhľadaj čo najúplnejšie verejné podujatia v Ružindole,
Trnave a uvedených blízkych obciach, ktoré sú najviac 30 km vzdušnou čiarou
od Ružindolu. Použi aktuálne vyhľadávanie Google Search.

Systematicky prehľadaj obecné a mestské kalendáre, kultúrne strediská a miesta
konania, organizátorov, športové kluby a dôveryhodné regionálne kalendáre.
Prever trhy/jarmoky, hody, koncerty/divadlo/výstavy, športové a gastro akcie
samostatne; neodvodzuj budúce termíny z minulých ročníkov.

Zahrň iba akcie, ktorých dátum, miesto a existencia sú potvrdené v konkrétnom
výsledku vyhľadávania od organizátora, obce/mesta, miesta konania alebo dôveryhodného
regionálneho kalendára. Pri každej položke skopíruj presnú URL zdroja z výsledkov
vyhľadávania do "zdroj_url". Ak sa zdroj alebo dátum nedá potvrdiť, akciu vynechaj.
Nevymýšľaj pravidelné/ročné akcie podľa minulých rokov. Ak nenájdeš overené
podujatia, vráť {"akcie":[]} a nič nedopĺňaj.

Výstup musí obsahovať len platné podujatia a polia podľa priloženej schémy.
`.trim();
}

/** Z ľubovoľného textu vytiahne JSON objekt (fallback, ak by prišli markdown fence). */
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

/** Znormalizuje kategóriu na povolený slovník (ošetrí diakritiku/synonymá). */
function normalizeKategoria(value: unknown): Kategoria | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if ((KATEGORIE as readonly string[]).includes(v)) return v as Kategoria;

  const synonyms: Record<string, Kategoria> = {
    trh: "trhy",
    jarmok: "trhy",
    market: "trhy",
    kultúra: "kultura",
    koncert: "kultura",
    divadlo: "kultura",
    výstava: "kultura",
    sport: "sport",
    šport: "sport",
    beh: "sport",
    zápas: "sport",
    turnaj: "sport",
    hody: "hodove",
    hodové: "hodove",
    hodovanie: "hodove",
    gastro: "gastronomia",
    gastronómia: "gastronomia",
    jedlo: "gastronomia",
  };

  return synonyms[v] ?? null;
}

function normalizeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return null;
    }
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

/** Prevedie len udalosti z doloženého zdroja a v povolenom časovom/priestorovom rozsahu. */
function toRow(
  item: unknown,
  groundingUrls: Set<string>,
  groundingSupports: { text: string; urls: string[] }[],
  today: string,
): AkciaRow | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const nazov = String(raw.nazov ?? "").trim();
  const obec = String(raw.obec ?? "").trim();
  const miesto = String(raw.miesto ?? "").trim();
  const datumCas = String(raw.datum_cas ?? "").trim();
  const konanieDna = String(raw.datum_iso ?? "").trim();
  const sourceUrl = normalizeSourceUrl(String(raw.zdroj_url ?? "").trim());
  const kategoria = normalizeKategoria(raw.kategoria);
  const distanceRaw = Number(raw.vzdialenost_km);
  const supportText = groundingSupports
    .filter((support) => support.urls.some((url) => normalizeSourceUrl(url) === sourceUrl))
    .map((support) => support.text)
    .join(" ");
  const normalizedSupport = normalize(supportText);
  const groundedEvent =
    Boolean(supportText) &&
    normalizedSupport.includes(normalize(nazov)) &&
    displayDateMatches(supportText, konanieDna);

  if (
    !nazov ||
    !obec ||
    !ALLOWED_MUNICIPALITIES.has(normalize(obec)) ||
    !miesto ||
    !datumCas ||
    !kategoria ||
    !Number.isFinite(distanceRaw) ||
    distanceRaw < 0 ||
    distanceRaw > 30 ||
    !isDateKey(konanieDna) ||
    konanieDna < today ||
    konanieDna > addDays(today, EVENT_WINDOW_DAYS) ||
    !displayDateMatches(datumCas, konanieDna) ||
    !sourceUrl ||
    !groundingUrls.has(sourceUrl) ||
    !groundedEvent
  ) {
    return null;
  }

  const popisRaw = raw.popis ? String(raw.popis).trim().slice(0, 400) : null;
  const groundedPopis =
    popisRaw && normalizedSupport.includes(normalize(popisRaw)) ? popisRaw : null;

  return {
    nazov: nazov.slice(0, 160),
    popis: groundedPopis && groundedPopis.length > 0 ? groundedPopis : null,
    obec: obec.slice(0, 80),
    vzdialenost_km: Math.round(distanceRaw * 10) / 10,
    kategoria,
    datum_cas: datumCas.slice(0, 80),
    konanie_dna: konanieDna,
    miesto: miesto.slice(0, 160),
    zdroj_url: sourceUrl,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // --- 1) Zavolanie AI agenta Gemini (structured JSON output) --------------
    // Najprv sa stiahne zoznam VŠETKÝCH dostupných flash modelov (>= 1.5) a
    // preveria sa postupne od najnovšieho; pri 404 (model pre kľúč neexistuje)
    // prejdeme na ďalší, pri 400 (nepodporí responseSchema) skúsime to isté
    // bez schémy. Odpoveď sa akceptuje, až keď prejde validáciou zdrojov.
    let plainText = "";
    let usedModel = "";
    let usedProvider = "";
    let groundingUrls: string[] = [];
    let groundingSupports: { text: string; urls: string[] }[] = [];
    const attempts: string[] = [];
    const today = getLocalDateKey();
    const hasValidatedPayload = (
      text: string,
      urls: string[],
      supports: { text: string; urls: string[] }[],
    ): boolean => {
      try {
        const parsed = extractJson(text);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !Array.isArray((parsed as { akcie?: unknown }).akcie)
        ) {
          return false;
        }
        const events = (parsed as { akcie: unknown[] }).akcie;
        if (events.length === 0) return true;
        const urlSet = new Set(
          urls.map(normalizeSourceUrl).filter((url): url is string => Boolean(url)),
        );
        return events.some((event) => toRow(event, urlSet, supports, today) !== null);
      } catch {
        return false;
      }
    };

    if (!geminiKey) {
      attempts.push("gemini -> preskočený: chýba GEMINI_API_KEY");
    } else {
      // Zoznam všetkých dostupných flash modelov (>= 1.5) z Gemini REST API,
      // zoradený od najnovšej verzie. GEMINI_MODEL (ak je nastavený) ide prvý.
      const discovered = await listFlashModels(geminiKey);
      const preferredRaw = Deno.env.get("GEMINI_MODEL")?.trim();
      // Predvolený model je gemini-2.5-flash; ďalej sa skúšajú ostatné flash modely.
      const preferred = preferredRaw || "gemini-2.5-flash";
      const modelQueue = [
        ...new Set([...(preferred && preferred.length > 0 ? [preferred] : []), ...discovered]),
      ];
      attempts.push(
        `gemini -> dostupné flash modely (>=1.5): ${modelQueue.join(", ") || "žiadne"}`,
      );

      for (const model of modelQueue) {
        let text = "";
        let urls: string[] = [];
        let supports: { text: string; urls: string[] }[] = [];

        const withSchema = await geminiGenerate(model, geminiKey, true);
        attempts.push(
          `gemini/${model} -> ${withSchema.status}${withSchema.details ? `: ${withSchema.details.slice(0, 240)}` : ""}`,
        );

        if (withSchema.ok && withSchema.text) {
          text = withSchema.text;
          urls = withSchema.groundingUrls;
          supports = withSchema.groundingSupports;
        } else if (withSchema.status === 400) {
          // Model existuje, ale nepodporil responseSchema -> skús bez schémy.
          const noSchema = await geminiGenerate(model, geminiKey, false);
          attempts.push(
            `gemini/${model} (bez schémy) -> ${noSchema.status}${noSchema.details ? `: ${noSchema.details.slice(0, 240)}` : ""}`,
          );
          if (noSchema.ok && noSchema.text) {
            text = noSchema.text;
            urls = noSchema.groundingUrls;
            supports = noSchema.groundingSupports;
          }
        }

        // Model preveril zadanie úspešne, až keď vrátil grounding zdroje
        // a aspoň jedno podujatie prešlo prísnou validáciou (hasValidatedPayload).
        if (
          text &&
          urls.length > 0 &&
          supports.length > 0 &&
          hasValidatedPayload(text, urls, supports)
        ) {
          plainText = text;
          groundingUrls = urls;
          groundingSupports = supports;
          usedModel = model;
          usedProvider = "gemini";
          break;
        }

        if (text) {
          attempts.push(
            `gemini/${model} -> odpoveď neprešla validáciou zdrojov, skúšam ďalší model`,
          );
        }
      }
    }

    if (!plainText || !groundingUrls.length || !groundingSupports.length) {
      console.error(
        "Gemini modely nevrátili overiteľné zdroje; kalendár zostáva nezmenený.",
        attempts,
      );
      return json(
        {
          success: false,
          error: "verified_search_sources_unavailable",
          used_provider: null,
          attempts,
        },
        502,
      );
    }

    // --- 2) Parsovanie + validácia výstupu ----------------------------------
    // Prísny režim: ak model nedodrží schému, celý beh zlyhá (žiadny voľný text).
    const parsed = extractJson(plainText);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as { akcie?: unknown }).akcie)
    ) {
      console.error(`[akcie] ${usedProvider}/${usedModel} nedodržal schému.`);
      return json(
        {
          success: false,
          error: "invalid_events_response",
          used_provider: usedProvider,
          model: usedModel,
          attempts,
        },
        502,
      );
    }
    const list = (parsed as { akcie: unknown[] }).akcie;

    const rows: AkciaRow[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    const groundingUrlSet = new Set(
      groundingUrls.map(normalizeSourceUrl).filter((url): url is string => Boolean(url)),
    );

    for (const item of list) {
      const row = toRow(item, groundingUrlSet, groundingSupports, today);
      if (!row) {
        skipped++;
        continue;
      }
      // Dedup v rámci dávky (rovnaký unikátny kľúč nazov + obec + datum_cas).
      const key = `${row.nazov}|${row.obec}|${row.datum_cas}`.toLowerCase();
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      rows.push(row);
    }

    if (list.length > 0 && rows.length === 0) {
      console.error(
        `${usedProvider} vrátil podujatia, ale žiadne neprešli kontrolou zdrojov a rozsahu.`,
      );
      return json(
        {
          success: false,
          error: "no_events_passed_validation",
          skipped,
          used_provider: usedProvider,
          model: usedModel,
          attempts,
        },
        502,
      );
    }

    if (list.length === 0) {
      const { error: replaceError } = await supabase.rpc("replace_okolite_akcie", {
        p_rows: [],
      });
      if (replaceError) {
        console.error("Vyčistenie overeného prázdneho zoznamu zlyhalo:", replaceError);
        return json({ success: false, error: replaceError.message }, 500);
      }
      console.log(
        `[akcie] OK provider=${usedProvider} model=${usedModel} inserted=0 attempts=${JSON.stringify(attempts)}`,
      );
      return json({
        success: true,
        provider: usedProvider,
        used_provider: usedProvider,
        model: usedModel,
        mode: "replace",
        inserted: 0,
        skipped,
        attempts,
      });
    }

    // --- 3) Uloženie nového zoznamu v jednej databázovej transakcii ----------
    const { error: replaceError } = await supabase.rpc("replace_okolite_akcie", {
      p_rows: rows,
    });

    if (replaceError) {
      console.error("Výmena okolite_akcie zlyhala:", replaceError);
      return json({ success: false, error: replaceError.message }, 500);
    }

    console.log(
      `[akcie] OK provider=${usedProvider} model=${usedModel} inserted=${rows.length} skipped=${skipped} attempts=${JSON.stringify(attempts)}`,
    );
    return json({
      success: true,
      provider: usedProvider,
      used_provider: usedProvider,
      model: usedModel,
      mode: "replace",
      inserted: rows.length,
      skipped,
      attempts,
    });
  } catch (error) {
    console.error("aktualizuj-akcie zlyhal:", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return json({ success: false, error: message }, 500);
  }
});
