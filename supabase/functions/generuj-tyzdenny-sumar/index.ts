// =============================================================================
//  Edge Function:  generuj-tyzdenny-sumar
//  AI novinár (Google Gemini + Google Search grounding) pre modul
//  "Ružindolské noviny".
//
//  • Beží VÝHRADNE na pozadí – bez UI a bez vstupu od používateľa.
//  • Pomocou vyhľadávania na webe (grounding) prejde internetové zdroje
//    o obci Ružindol za uplynulý týždeň (DHZ Ružindol, kluby, úrad, podujatia)
//    a napíše pútavý týždenný súhrn.
//  • Uloží ho ako nový riadok do tabuľky public.tyzdenne_sumare.
//  • GEMINI_API_KEY sa číta bezpečne z prostredia (nikdy nie je v klientovi).
//
//  Nasadenie:
//    supabase functions deploy generuj-tyzdenny-sumar --no-verify-jwt
//  Naplánovanie (napr. raz týždenne) cez Supabase Dashboard -> Edge Functions
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

// Model možno prepísať cez secret GEMINI_MODEL. Ak daný model pre API kľúč
// neexistuje (HTTP 404), funkcia automaticky skúsi ďalší v poradí.
const GEMINI_MODELS = [
  Deno.env.get("GEMINI_MODEL"),
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
].filter((m): m is string => Boolean(m && m.trim()));

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

// Pevne daný systémový prompt – AI vystupuje ako lokálny novinár.
const SYSTEM_PROMPT = `
Si skúsený lokálny novinár a redaktor týždenníka obce Ružindol (okres Trnava, Slovensko).
Na základe AKTUÁLNEHO VYHĽADÁVANIA NA WEBE zostavíš pútavý, vecný a ľudsky písaný
týždenný súhrn diania v obci Ružindol a jej okolí.

Zameraj sa najmä na:
- DHZ Ružindol (dobrovoľní hasiči) – zásahy, akcie, brigády, súťaže,
- miestne kluby a organizácie (OŠK Ružindol, dôchodcovia, farnosť, mládež),
- obecný úrad a samosprávu – oznamy, rozhodnutia, investície, zber odpadu,
- kultúrne, spoločenské a športové podujatia za uplynulý týždeň,
- dianie v blízkych obciach (Trnava, Smolenice, Modra), ak súvisí s Ružindolom.

PRAVIDLÁ:
1. Vychádzaj z reálne dohľadaných informácií. Nič si nevymýšľaj ani nedomýšľaj.
2. Ak sa informáciu nepodarí overiť, radšej ju vynechaj.
3. Píš pútavo a čítavo, ale vecne a slušne (štýl lokálneho týždenníka).
4. "obsah" je ucelený článok, môže mať viac odsekov oddelených prázdnym riadkom.
5. Vráť IBA čistý JSON podľa schémy, žiadny text navyše.
`.trim();

// Schéma výstupu – presne podľa tabuľky public.tyzdenne_sumare.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    titulok: { type: "STRING", description: "Pútavý titulok článku" },
    obsah: { type: "STRING", description: "Celý článok (odseky oddelené prázdnym riadkom)" },
    obdobie: { type: "STRING", description: "Obdobie, ktoré súhrn pokrýva" },
  },
  required: ["titulok", "obsah", "obdobie"],
};

/**
 * Ak model nepodporí responseSchema, schému pošleme v prompte ako text;
 * výstup aj tak vynútime cez responseMimeType: application/json.
 */
function schemaHint(): string {
  return `\n\nSchéma JSON (vráť presne túto štruktúru): {"titulok":string,"obsah":string,"obdobie":string}`;
}

function buildUserPrompt(): string {
  const today = new Date().toLocaleDateString("sk-SK");
  return `
Dnešný dátum je ${today}.
Vyhľadaj na internete najnovšie informácie o obci Ružindol (DHZ Ružindol, OŠK,
farnosť, obecný úrad, miestne podujatia) za uplynulých 7 dní a napíš týždenný súhrn.
Pole "obdobie" vyplň ako rozsah uplynulého týždňa, napr. "Týždeň 29.9. – 5.10.2026".
`.trim();
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

type GeminiAttempt = { ok: boolean; status: number; text?: string; details?: string };

/** Jedno volanie Gemini generateContent (s voliteľným groundingom a schémou). */
async function geminiGenerate(
  model: string,
  apiKey: string,
  grounding: string | null,
  includeSchema: boolean,
): Promise<GeminiAttempt> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.7,
    responseMimeType: "application/json",
  };
  if (includeSchema) generationConfig.responseSchema = RESPONSE_SCHEMA;

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      { role: "user", parts: [{ text: buildUserPrompt() + (includeSchema ? "" : schemaHint()) }] },
    ],
    generationConfig,
  };
  if (grounding) body.tools = [{ [grounding]: {} }];

  const res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const details = await res.text();
    return { ok: false, status: res.status, details };
  }

  const payload = await res.json();
  const text: string =
    payload?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? "")
      .join("") ?? "";

  return { ok: true, status: res.status, text: text.trim() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      console.error("Chýba GEMINI_API_KEY.");
      return json({ success: false, error: "missing_gemini_api_key" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // --- 1) Gemini s Google Search groundingom (skúšame modely aj varianty) --
    // Poradie pokusov: grounding + schéma -> grounding (bez schémy) -> starší
    // názov grounding toolu -> úplne bez groundingu. Pri 404 (model pre kľúč
    // neexistuje) -> ďalší model; pri 400 -> ďalší variant; iná chyba -> ďalší model.
    const VARIANTS = [
      { grounding: "google_search", schema: true },
      { grounding: "google_search", schema: false },
      { grounding: "google_search_retrieval", schema: false },
      { grounding: null, schema: false },
    ];

    let plainText = "";
    let usedModel = "";
    let grounded = false;
    const attempts: string[] = [];

    outer: for (const model of GEMINI_MODELS) {
      for (const v of VARIANTS) {
        const result = await geminiGenerate(model, geminiKey, v.grounding, v.schema);
        attempts.push(
          `${model}${v.grounding ? ` + ${v.grounding}` : ""}${v.schema ? " + schema" : ""} -> ${result.status}`,
        );

        if (result.ok && result.text) {
          plainText = result.text;
          usedModel = model;
          grounded = Boolean(v.grounding);
          break outer;
        }

        if (result.status === 404) continue outer; // model pre kľúč neexistuje
        if (result.status !== 400) continue outer; // iná chyba -> iný model
        // 400 -> skús ďalší variant (napr. bez responseSchema / bez tools)
      }
    }

    if (!plainText) {
      console.error("Gemini zlyhal pre všetky modely/varianty:", attempts);
      return json({ success: false, error: "gemini_request_failed", attempts }, 502);
    }

    // --- 2) Parsovanie a validácia výstupu ---------------------------------
    const parsed = extractJson(plainText) as {
      titulok?: unknown;
      obsah?: unknown;
      obdobie?: unknown;
    };
    const titulok = String(parsed.titulok ?? "").trim();
    const obsah = String(parsed.obsah ?? "").trim();
    let obdobie = String(parsed.obdobie ?? "").trim();

    if (!titulok || !obsah) {
      console.error("AI nevrátila titulok/obsah.", attempts);
      return json({ success: false, error: "empty_summary", attempts }, 502);
    }

    // Ak AI vynechá obdobie, doplníme rozsah posledných 7 dní.
    if (!obdobie) {
      const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
      obdobie = `Týždeň ${fmt(new Date(Date.now() - 6 * 86_400_000))} – ${fmt(new Date())}`;
    }

    // --- 3) Uloženie nového vydania ----------------------------------------
    const { error: insertError } = await supabase.from(TABLE).insert({ titulok, obsah, obdobie });

    if (insertError) {
      console.error("Vloženie do tyzdenne_sumare zlyhalo:", insertError);
      return json({ success: false, error: insertError.message }, 500);
    }

    return json({ success: true, model: usedModel, grounded, obdobie, inserted: 1 });
  } catch (error) {
    console.error("generuj-tyzdenny-sumar zlyhal:", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return json({ success: false, error: message }, 500);
  }
});
