/**
 * Poloautomatický import termínov zberu odpadu z textu (napr. skopírovaného
 * z webu obce ruzindol.sk).
 *
 * DÔLEŽITÉ: zber odpadu je v aplikácii uložený v tabuľke `events` s `type = 'odpad'`
 * (nie v samostatnej tabuľke `waste_schedule`). Parser preto vracia položky priamo
 * kompatibilné s `events` (dátum + názov). Deduplikáciu rieši volajúci komponent
 * porovnaním kľúča (dátum + normalizovaný názov) proti existujúcim riadkom v DB,
 * takže nie je potrebná žiadna zmena schémy ani UNIQUE constraint.
 *
 * Podporované formáty dátumov (aj viac dátumov na jednom riadku):
 *  - `01.10.2026`, `1. 10. 2026`        (deň. mesiac. rok)
 *  - `01.10.` / `1. 10.`                (bez roku – rok sa odvodí; prešlý → ďalší rok)
 *  - `2026-10-01`                       (ISO)
 *
 * Typ odpadu sa rozpozná podľa kľúčových slov (zmesový, bio, plast, papier, sklo,
 * nebezpečný, elektro, veľkoobjemový, textil, tetrapak...). Ak riadok neobsahuje
 * známe kľúčové slovo, ako názov sa použije zvyšok riadku po odstránení dátumov.
 */

export type ParsedWasteEntry = {
  /** ISO čas začiatku pre `events.starts_at` (06:00 miestneho času – zber je dátumová udalosť). */
  startsAtISO: string;
  /** Lokálny kalendárny deň v tvare YYYY-MM-DD (pre deduplikáciu a zobrazenie). */
  dateKey: string;
  /** Názov položky (typ odpadu) pre `events.title`. */
  title: string;
};

export type WasteParseResult = {
  entries: ParsedWasteEntry[];
  skipped: { line: string; reason: string }[];
};

/** Zdrojový regex dátumov – používa sa na vyhľadanie aj na odstránenie z riadku. */
const DATE_SOURCE =
  "\\b(\\d{1,2})\\.\\s*(\\d{1,2})\\.\\s*(\\d{4})\\b" + // 1. 10. 2026 / 01.10.2026
  "|\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b" + // 2026-10-01
  "|\\b(\\d{1,2})\\.\\s*(\\d{1,2})\\.(?!\\s*\\d)"; // 1. 10. / 01.10. (bez roku)

/** Kľúčové slová → názov typu odpadu (poradie určuje zobrazenie v názve). */
const WASTE_KEYWORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /zmesov|smies|smieš|komunal|komunál/i, label: "Zmesový odpad" },
  { pattern: /\bbio/i, label: "Bioodpad" },
  { pattern: /plast/i, label: "Plast" },
  { pattern: /papi[eě]r/i, label: "Papier" },
  { pattern: /\bsklo/i, label: "Sklo" },
  { pattern: /nebezpe/i, label: "Nebezpečný odpad" },
  { pattern: /elektro/i, label: "Elektroodpad" },
  { pattern: /objem/i, label: "Veľkoobjemový odpad" },
  { pattern: /textil/i, label: "Textil" },
  { pattern: /tetrapak|tetro/i, label: "Nápojové kartóny" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Rok pre dátum bez roku: ak už prešiel (tento rok), použije sa ďalší rok. */
function inferYear(m: number, d: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const candidate = new Date(year, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return candidate.getTime() < today.getTime() ? year + 1 : year;
}

type RawDate = { y: number; m: number; d: number };

function extractDates(line: string): RawDate[] {
  const regex = new RegExp(DATE_SOURCE, "g");
  const found = new Map<string, RawDate>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    let y: number | undefined;
    let m: number | undefined;
    let d: number | undefined;

    if (match[1] !== undefined) {
      d = Number(match[1]);
      m = Number(match[2]);
      y = Number(match[3]);
    } else if (match[4] !== undefined) {
      y = Number(match[4]);
      m = Number(match[5]);
      d = Number(match[6]);
    } else if (match[7] !== undefined) {
      d = Number(match[7]);
      m = Number(match[8]);
      y = inferYear(m, d);
    }

    if (y === undefined || m === undefined || d === undefined) continue;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) continue;

    found.set(`${y}-${m}-${d}`, { y, m, d });
  }

  return Array.from(found.values());
}

/** Názov položky: najskôr kľúčové slová, inak zvyšok riadku bez dátumov. */
function buildTitle(line: string): string {
  const labels: string[] = [];
  for (const keyword of WASTE_KEYWORDS) {
    if (keyword.pattern.test(line) && !labels.includes(keyword.label)) {
      labels.push(keyword.label);
    }
  }
  if (labels.length > 0) return labels.join(" + ");

  const cleaned = line
    .replace(new RegExp(DATE_SOURCE, "g"), " ")
    .replace(/^[^\p{L}\d]+/u, "")
    .replace(/[\s\-–—•*]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned.slice(0, 200) : "";
}

/** ISO `starts_at` – 06:00 miestneho času (garantovaný kalendárny deň pre filtre appky). */
function wasteStartsAt(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d, 6, 0, 0, 0).toISOString();
}

/** Lokálny kalendárny deň ISO času v tvare YYYY-MM-DD. */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Normalizovaný názov pre deduplikáciu (malé písmená, zľahnuté medzery). */
export function normalizeWasteTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Kľúč položky na porovnanie s DB (deduplikácia). */
export function wasteEntryKey(dateKey: string, title: string): string {
  return `${dateKey}|${normalizeWasteTitle(title)}`;
}

/** Hlavná funkcia parsera – čistá (bez DB a Reactu), ľahko testovateľná. */
export function parseWasteScheduleText(raw: string): WasteParseResult {
  const entries: ParsedWasteEntry[] = [];
  const skipped: { line: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const dates = extractDates(line);
    if (dates.length === 0) {
      skipped.push({ line, reason: "Nenašiel sa dátum." });
      continue;
    }

    const title = buildTitle(line);
    if (!title) {
      skipped.push({ line, reason: "Nenašiel sa typ odpadu ani popis." });
      continue;
    }

    for (const date of dates) {
      const dateKey = `${date.y}-${pad(date.m)}-${pad(date.d)}`;
      const key = wasteEntryKey(dateKey, title);
      if (seen.has(key)) continue;
      seen.add(key);

      entries.push({
        startsAtISO: wasteStartsAt(date.y, date.m, date.d),
        dateKey,
        title,
      });
    }
  }

  return { entries, skipped };
}
