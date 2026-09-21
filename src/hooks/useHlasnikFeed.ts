import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Obecný hlásnik – kompaktný feed oficiálnych a dôležitých informácií.
 *
 * Zdrojové tabuľky (zámerne len oficiálne zdroje):
 *  - `announcements` (`source = 'rss'`)  → RSS aktuality
 *  - `events` (typ ≠ `odpad`, od dneška) → udalosti z kalendára
 *  - `events` (typ = `odpad`, od dneška) → zberový kalendár / harmonogram vývozu
 *
 * Susedské príspevky (`posts`), susedské dopyty/ponuky zo skladu (`warehouse_items`)
 * a ostatné komunitné moduly tu zámerne nie sú – majú vlastné záložky a nesmú sa
 * duplikovať.
 *
 * Ak niektorý zdroj v databáze neexistuje (alebo naň RLS nepustí), chyba sa iba
 * zaloguje a feed pokračuje s ostatnými zdrojmi. Bez dát hook vráti prázdne pole,
 * takže sa komponent vôbec nevykreslí.
 */

/** Koľko najnovších záznamov ťaháme z jedného zdroja pred zlúčením. */
const PER_SOURCE_LIMIT = 4;

/** Koľko položiek napokon zostane v kompaktnom feede (kvôli miestu na obrazovke). */
const FEED_LIMIT = 4;

/** Zberový kalendár – v kompaktnom feede stačia najbližšie dva termíny. */
const WASTE_LIMIT = 2;

/** Maximálna dĺžka doplňujúcej informácie (zobrazuje sa len ako tooltip). */
const META_MAX_LENGTH = 160;

export type FeedSource = "aktuality" | "kalendar" | "odpad";

export type FeedItem = {
  /** Unikátny kľúč naprieč všetkými zdrojmi (React key). */
  id: string;
  source: FeedSource;
  title: string;
  /** ISO dátum, podľa ktorého sa celý feed zoraďuje zostupne. */
  date: string;
  /** Doplňujúca informácia – zobrazuje sa ako tooltip, nie vizuálne. */
  meta?: string;
};

type AnnouncementFeedRow = {
  id: string;
  title: string;
  content: string;
  published_at: string;
  expires_at: string | null;
};

type EventFeedRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  type: string;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isExpiredIso(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) && ts <= Date.now();
}

function buildMeta(...values: Array<string | null | undefined>): string | undefined {
  const text = values
    .map(normalizeText)
    .filter((value) => value.length > 0)
    .join(" · ");

  if (text.length === 0) return undefined;
  if (text.length <= META_MAX_LENGTH) return text;
  return `${text.slice(0, META_MAX_LENGTH).trimEnd()}…`;
}

function mapAnnouncements(rows: AnnouncementFeedRow[] | null): FeedItem[] {
  return (rows ?? [])
    .filter((row) => !isExpiredIso(row.expires_at))
    .slice(0, PER_SOURCE_LIMIT)
    .map((row) => ({
      id: `aktuality:${row.id}`,
      source: "aktuality",
      title: normalizeText(row.title) || "Aktualita",
      date: row.published_at,
      meta: buildMeta("RSS obecného úradu", row.content),
    }));
}

function mapCalendarEvents(rows: EventFeedRow[] | null): FeedItem[] {
  return (rows ?? [])
    .filter((row) => (row.type ?? "").toLowerCase() !== "odpad")
    .slice(0, PER_SOURCE_LIMIT)
    .map((row) => ({
      id: `kalendar:${row.id}`,
      source: "kalendar",
      title: normalizeText(row.title) || "Udalosť",
      date: row.starts_at,
      meta: buildMeta(row.location ? `Miesto: ${row.location}` : undefined, row.description),
    }));
}

function mapWasteEvents(rows: EventFeedRow[] | null): FeedItem[] {
  return (rows ?? [])
    .filter((row) => (row.type ?? "").toLowerCase() === "odpad")
    .slice(0, WASTE_LIMIT)
    .map((row) => ({
      id: `odpad:${row.id}`,
      source: "odpad",
      title: normalizeText(row.title) || "Zber odpadu",
      date: row.starts_at,
      meta: buildMeta(row.location || "Harmonogram vývozu", row.description),
    }));
}

async function loadHlasnikFeed(): Promise<FeedItem[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  const [announcementsRes, eventsRes, wasteRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, content, published_at, expires_at")
      .eq("source", "rss")
      .order("published_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT * 2),
    supabase
      .from("events")
      .select("id, title, description, location, starts_at, type")
      .neq("type", "odpad")
      .gte("starts_at", todayIso)
      .order("starts_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("events")
      .select("id, title, description, location, starts_at, type")
      .eq("type", "odpad")
      .gte("starts_at", todayIso)
      .order("starts_at", { ascending: true })
      .limit(WASTE_LIMIT),
  ]);

  if (announcementsRes.error) {
    console.error("Hlásnik: RSS aktuality sa nepodarilo načítať:", announcementsRes.error);
  }
  if (eventsRes.error) {
    console.error("Hlásnik: udalosti kalendára sa nepodarilo načítať:", eventsRes.error);
  }
  if (wasteRes.error) {
    console.error("Hlásnik: harmonogram vývozu sa nepodarilo načítať:", wasteRes.error);
  }

  const items: FeedItem[] = [
    ...mapAnnouncements(announcementsRes.data as unknown as AnnouncementFeedRow[] | null),
    ...mapCalendarEvents(eventsRes.data as unknown as EventFeedRow[] | null),
    ...mapWasteEvents(wasteRes.data as unknown as EventFeedRow[] | null),
  ];

  return items
    .filter((item) => Number.isFinite(new Date(item.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, FEED_LIMIT);
}

/**
 * Načíta najnovšie oficiálne informácie (RSS aktuality, udalosti kalendára a termíny
 * vývozu odpadu) paralelne a zlúči ich do jednej kompaktnej časovej osi.
 */
export function useHlasnikFeed() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["obecny-hlasnik-feed"],
    queryFn: loadHlasnikFeed,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const items = data ?? [];

  return {
    items,
    /** `true` len ak existujú reálne dáta na zobrazenie (inak sa komponent nevykreslí). */
    hasItems: items.length > 0,
    isLoading,
    isError,
    refetch,
  };
}
