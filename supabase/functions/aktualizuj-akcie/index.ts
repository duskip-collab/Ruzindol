// =============================================================================
//  Edge Function:  aktualizuj-akcie
//  Autonómny AI agent (Google Gemini) pre modul "Akcie v okolí".
//
//  • Beží VÝHRADNE na pozadí – nemá UI a neprijíma vstup od používateľa.
//  • Vyhľadá podujatia/trhy/kultúru/šport/hody/gastro v okruhu do 30 km od
//    obce Ružindol (Trnava, Smolenice, Modra, Trstín, ...).
//  • Vynúti výstup ako čistý JSON (responseMimeType + responseSchema) a uloží
//    ho cez upsert do tabuľky `okolite_akcie`.
//  • GEMINI_API_KEY sa číta bezpečne z prostredia (nikdy nie je v klientovi).
//
//  Nasadenie:
//    supabase functions deploy aktualizuj-akcie --no-verify-jwt
//  Naplánovanie (napr. raz denne) v Supabase Dashboard -> Edge Functions ->
//  Schedules, alebo cez pg_cron (net.http_post na URL funkcie).
//
//  ENV premenné (Supabase -> Project Settings -> Edge Functions -> Secrets):
//    GEMINI_API_KEY = tvoj Google AI Studio kľúč
//    GEMINI_MODEL (voliteľné) = konkrétny model (inak sa vyberie automaticky)
//    OKOLITE_REPLACE (voliteľné) = "false" vypne úplný refresh (ostane len upsert)
//  (SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY sú dostupné automaticky.)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLE = "okolite_akcie";

// Model možno prepísať cez secret GEMINI_MODEL. Ak daný model pre API kľúč
// neexistuje (HTTP 404), funkcia automaticky skúsi ďalší v poradí. Google pre
// nové projekty obmedzil staršie 2.5 modely, preto sú prvé aktuálne Flash modely.
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

// Režim "svieži zoznam": predvolene najprv vyčistí tabuľku a vloží nový zoznam,
// takže neostanú staré ani duplicitné akcie. Vypne sa cez OKOLITE_REPLACE=false.
const REPLACE_MODE = (Deno.env.get("OKOLITE_REPLACE") ?? "true").toLowerCase() !== "false";
// Bezpečnostná poistka: tabuľku vyčistíme len ak AI vrátila aspoň toľko položiek,
// aby sme pri výpadku/výmene AI náhodou nezmazali všetky dáta.
const MIN_ITEMS_FOR_REPLACE = 3;

const KATEGORIE = ["trhy", "kultura", "sport", "hodove", "gastronomia"] as const;
type Kategoria = (typeof KATEGORIE)[number];

type AkciaRow = {
  nazov: string;
  popis: string | null;
  obec: string;
  vzdialenost_km: number;
  kategoria: Kategoria;
  datum_cas: string;
  miesto: string;
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
Zvončín, Biely Kostol, Hrnčiarovce nad Parnou, Voderady.

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
13. Vráť 8 až 15 položiek, iba ak existuje toľko overených podujatí; inak vráť
    všetky overené podujatia alebo prázdny zoznam.
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
          miesto: { type: "STRING", description: "Konkrétne miesto konania" },
        },
        required: ["nazov", "obec", "vzdialenost_km", "kategoria", "datum_cas", "miesto"],
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
  return `\n\nSchéma JSON (vráť presne túto štruktúru): {"akcie":[{"nazov":string,"popis":string,"obec":string,"vzdialenost_km":number,"kategoria":"trhy"|"kultura"|"sport"|"hodove"|"gastronomia","datum_cas":string,"miesto":string}]}`;
}

type GeminiAttempt = { ok: boolean; status: number; text?: string; details?: string };

/** Jedno volanie Gemini generateContent pre konkrétny model. */
async function geminiGenerate(
  model: string,
  apiKey: string,
  includeSchema: boolean,
): Promise<GeminiAttempt> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    responseMimeType: "application/json",
  };
  if (includeSchema) generationConfig.responseSchema = RESPONSE_SCHEMA;

  const userPrompt = buildUserPrompt() + (includeSchema ? "" : schemaHint());

  const res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig,
      tools: [{ google_search: {} }],
    }),
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

function buildUserPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `
Dnešný dátum: ${today}.
Zostav aktuálny zoznam verejných podujatí, trhov, hodov a kultúrnych/športových/gastro
akcií v okruhu do 30 km od obce Ružindol na najbližšie obdobie.
Vráť výsledok výhradne ako JSON objekt s poľom "akcie" podľa schémy.
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

/** Prevedie jednu AI položku na čistý riadok tabuľky (alebo null, ak je neplatná). */
function toRow(item: unknown): AkciaRow | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const nazov = String(raw.nazov ?? "").trim();
  const obec = String(raw.obec ?? "").trim();
  const miesto = String(raw.miesto ?? "").trim();
  const datumCas = String(raw.datum_cas ?? "").trim();
  const kategoria = normalizeKategoria(raw.kategoria);
  const distanceRaw = Number(raw.vzdialenost_km);

  if (!nazov || !obec || !miesto || !datumCas || !kategoria || !Number.isFinite(distanceRaw)) {
    return null;
  }

  const vzdialenost = Math.min(30, Math.max(0, Math.round(distanceRaw * 10) / 10));
  const popisRaw = raw.popis ? String(raw.popis).trim().slice(0, 400) : null;

  return {
    nazov: nazov.slice(0, 160),
    popis: popisRaw && popisRaw.length > 0 ? popisRaw : null,
    obec: obec.slice(0, 80),
    vzdialenost_km: vzdialenost,
    kategoria,
    datum_cas: datumCas.slice(0, 80),
    miesto: miesto.slice(0, 160),
  };
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

    // --- 1) Zavolanie AI agenta Gemini (structured JSON output) --------------
    // Modely skúšame po poradí; pri 404 (model pre kľúč neexistuje) prejdeme na
    // ďalší, pri 400 (nepodporí responseSchema) skúsime to isté bez schémy.
    let plainText = "";
    let usedModel = "";
    const attempts: string[] = [];

    for (const model of GEMINI_MODELS) {
      let text = "";

      const withSchema = await geminiGenerate(model, geminiKey, true);
      attempts.push(`${model} -> ${withSchema.status}`);

      if (withSchema.ok && withSchema.text) {
        text = withSchema.text;
      } else if (withSchema.status === 400) {
        // Model existuje, ale nepodporil responseSchema -> skús bez schémy.
        const noSchema = await geminiGenerate(model, geminiKey, false);
        attempts.push(`${model} (bez schémy) -> ${noSchema.status}`);
        if (noSchema.ok && noSchema.text) text = noSchema.text;
      }

      if (text) {
        plainText = text;
        usedModel = model;
        break;
      }
    }

    if (!plainText) {
      console.error("Gemini zlyhal pre všetky modely:", attempts);
      return json({ success: false, error: "gemini_request_failed", attempts }, 502);
    }

    // --- 2) Parsovanie + validácia výstupu ----------------------------------
    const parsed = extractJson(plainText) as { akcie?: unknown[] } | unknown[];
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { akcie?: unknown[] }).akcie)
        ? ((parsed as { akcie?: unknown[] }).akcie as unknown[])
        : [];

    const rows: AkciaRow[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const item of list) {
      const row = toRow(item);
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

    if (rows.length === 0) {
      return json({ success: true, inserted: 0, skipped, note: "no_valid_events" });
    }

    // --- 3) Uloženie do izolovanej tabuľky okolite_akcie --------------------
    // Režim "svieži zoznam" (predvolene ZAPNUTÝ): najprv vyčistí tabuľku a vloží
    // nový zoznam -> žiadne staré ani duplicitné akcie. Tabuľku vyčistíme LEN ak
    // AI vrátila dostatok platných položiek (ochrana proti výpadku).
    if (REPLACE_MODE && rows.length >= MIN_ITEMS_FOR_REPLACE) {
      const { error: clearError } = await supabase.from(TABLE).delete().not("id", "is", null);

      if (clearError) {
        console.error("Vyčistenie okolite_akcie zlyhalo:", clearError);
        return json({ success: false, error: clearError.message }, 500);
      }

      const { error: insertError } = await supabase.from(TABLE).insert(rows);

      if (insertError) {
        console.error("Vloženie do okolite_akcie zlyhalo:", insertError);
        return json({ success: false, error: insertError.message }, 500);
      }

      return json({
        success: true,
        model: usedModel,
        mode: "replace",
        inserted: rows.length,
        skipped,
      });
    }

    // Fallback: upsert podľa unikátneho kľúča (nazov, obec, datum_cas).
    const { error: upsertError } = await supabase
      .from(TABLE)
      .upsert(rows, { onConflict: "nazov,obec,datum_cas", ignoreDuplicates: false });

    if (upsertError) {
      console.error("Upsert do okolite_akcie zlyhal:", upsertError);
      return json({ success: false, error: upsertError.message }, 500);
    }

    return json({
      success: true,
      model: usedModel,
      mode: "upsert",
      inserted: rows.length,
      skipped,
    });
  } catch (error) {
    console.error("aktualizuj-akcie zlyhal:", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return json({ success: false, error: message }, 500);
  }
});
