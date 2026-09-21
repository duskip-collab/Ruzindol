import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { resolveWarehouseExpiry, type WarehouseItemType } from "@/lib/warehouse";

/**
 * Obecný hlásnik – jednotná dynamická časová os (feed) najnovších informácií.
 *
 * Zdrojové tabuľky:
 *  - `posts`             → príspevky a oznamy (badge „Oznam“)
 *  - `announcements`      → obecné oznamy (`internal`) a RSS aktuality (`rss`)
 *  - `events`             → udalosti z kalendára mimo odpadu (badge „Kalendár“)
 *  - `events` + `odpad`   → zberový kalendár / harmonogram vývozu (badge „Odpad“)
 *  - `warehouse_items`    → aktívne položky susedského skladu (badge „Susedský sklad“)
 *
 * Ak niektorý zdroj v databáze neexistuje (alebo naň RLS nepustí), chyba sa iba
 * zaloguje a feed pokračuje s ostatnými zdrojmi. Bez dát hook vráti prázdne pole,
 * takže sa komponent vôbec nevykreslí.
 */

/** Koľko najnovších záznamov ťaháme z jedného zdroja pred zlúčením. */
const PER_SOURCE_LIMIT = 6;

/** Koľko položiek napokon zostane v zlúčenej časovej osi. */
const FEED_LIMIT = 6;

/** Termíny vývozu odpadu sa v časovej osi zobrazujú len najbližšie dva. */
const WASTE_LIMIT = 2;

/** Maximálna dĺžka skráteného textu v jednej položke feedu. */
const SNIPPET_MAX_LENGTH = 130;

/** Životnosť susedského príspevku (rovnaká ako na nástenke). */
const POST_TTL_MS = 4 * 24 * 3600_000;

export type FeedSource = "oznam" | "aktuality" | "kalendar" | "odpad" | "sklad";

export type FeedItem = {
  /** Unikátny kľúč naprieč všetkými zdrojmi (React key). */
  id: string;
  source: FeedSource;
  title: string;
  snippet: string;
  /** ISO dátum, podľa ktorého sa celá časová os zoraďuje zostupne. */
  date: string;
  /** Doplňujúca informácia (autor, miesto, cena…). */
  meta?: string;
  /** Pôvodné ID záznamu – používa sa pri prekliku na detail. */
  itemId?: string;
  /** Typ položky skladu – určuje spätnú navigáciu v detaile. */
  warehouseType?: WarehouseItemType;
};

type PostFeedRow = {
  id: string;
  user_id: string;
  type: string;
  category: string | null;
  title: string;
  content: string;
  created_at: string;
  expires_at: string | null;
  profiles: { name: string | null } | null;
};

type AnnouncementFeedRow = {
  id: string;
  source: string;
  title: string;
  content: string;
  priority: string;
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

type WarehouseFeedRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  price: number;
  created_at: string;
  expires_at: string | null;
};

const WAREHOUSE_TYPES: WarehouseItemType[] = ["trh", "darovanie", "sklad_ponuka", "sklad_dopyt"];

const WAREHOUSE_TYPE_LABEL: Record<WarehouseItemType, string> = {
  trh: "Susedský trh",
  darovanie: "Darovanie",
  sklad_ponuka: "Požičovňa",
  sklad_dopyt: "Rýchly dopyt",
};

const ANNOUNCEMENT_PRIORITY_LABEL: Record<string, string> = {
  oznam: "Oznam",
  prioritne: "Prioritné",
  urgentne: "Urgentné",
  vystraha: "Výstraha",
};

function toWarehouseType(value: string | null | undefined): WarehouseItemType {
  return WAREHOUSE_TYPES.includes(value as WarehouseItemType)
    ? (value as WarehouseItemType)
    : "sklad_ponuka";
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildSnippet(...values: Array<string | null | undefined>): string {
  const text = values.map(normalizeText).find((value) => value.length > 0) ?? "";
  if (text.length <= SNIPPET_MAX_LENGTH) return text;
  return `${text.slice(0, SNIPPET_MAX_LENGTH).trimEnd()}…`;
}

function isExpiredIso(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) && ts <= Date.now();
}

/** Zhodná logika s nástenkou – expirované príspevky sa do feedu nedostanú. */
function isPostExpired(row: PostFeedRow): boolean {
  const createdMs = new Date(row.created_at).getTime();

  if (row.type === "hlasnik" || row.type === "official_alert") {
    const explicitMs = row.expires_at ? new Date(row.expires_at).getTime() : Number.NaN;
    const expiryMs = Number.isFinite(explicitMs) ? explicitMs : createdMs + POST_TTL_MS;
    return expiryMs <= Date.now();
  }

  if (row.type === "susedsky_zivot") {
    return createdMs + POST_TTL_MS <= Date.now();
  }

  return false;
}

/**
 * Aktívna položka skladu = neexpirovaná (rovnako ako RPC `get_active_warehouse_counts`).
 * Ak by databáza obsahovala aj stĺpec `status`, rešpektujeme ho – aktívna je len
 * položka so statusom „active“.
 */
function isWarehouseActive(row: WarehouseFeedRow, nowMs: number): boolean {
  const status = (row as unknown as Record<string, unknown>).status;
  if (typeof status === "string" && status.length > 0 && status.toLowerCase() !== "active") {
    return false;
  }

  const expiry = resolveWarehouseExpiry(toWarehouseType(row.type), row.created_at, row.expires_at);
  return expiry.getTime() > nowMs;
}

function mapPosts(rows: PostFeedRow[] | null): FeedItem[] {
  return (rows ?? [])
    .filter((row) => !isPostExpired(row))
    .slice(0, PER_SOURCE_LIMIT)
    .map((row) => {
      const author = normalizeText(row.profiles?.name);
      return {
        id: `oznam:${row.id}`,
        source: "oznam",
        title: normalizeText(row.title) || "Oznam",
        snippet: buildSnippet(row.content, row.category),
        date: row.created_at,
        meta: author ? `Od ${author}` : undefined,
        itemId: row.id,
      };
    });
}

function mapAnnouncements(rows: AnnouncementFeedRow[] | null): FeedItem[] {
  const active = (rows ?? []).filter((row) => !isExpiredIso(row.expires_at));

  const rss: FeedItem[] = active
    .filter((row) => row.source === "rss")
    .slice(0, PER_SOURCE_LIMIT)
    .map((row) => ({
      id: `aktuality:${row.id}`,
      source: "aktuality",
      title: normalizeText(row.title) || "Aktualita",
      snippet: buildSnippet(row.content),
      date: row.published_at,
      meta: "RSS obecného úradu",
      itemId: row.id,
    }));

  const internal: FeedItem[] = active
    .filter((row) => row.source !== "rss")
    .slice(0, PER_SOURCE_LIMIT)
    .map((row) => ({
      id: `oznam:${row.id}`,
      source: "oznam",
      title: normalizeText(row.title) || "Oznam obce",
      snippet: buildSnippet(row.content),
      date: row.published_at,
      meta: ANNOUNCEMENT_PRIORITY_LABEL[row.priority] ?? "Oznam obce",
      itemId: row.id,
    }));

  return [...rss, ...internal];
}

function mapCalendarEvents(rows: EventFeedRow[] | null): FeedItem[] {
  return (rows ?? [])
    .filter((row) => (row.type ?? "").toLowerCase() !== "odpad")
    .slice(0, PER_SOURCE_LIMIT)
    .map((row) => ({
      id: `kalendar:${row.id}`,
      source: "kalendar",
      title: normalizeText(row.title) || "Udalosť",
      snippet: buildSnippet(row.description),
      date: row.starts_at,
      meta: normalizeText(row.location) ? `Miesto: ${normalizeText(row.location)}` : undefined,
      itemId: row.id,
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
      snippet: buildSnippet(row.description),
      date: row.starts_at,
      meta: normalizeText(row.location) || "Harmonogram vývozu",
      itemId: row.id,
    }));
}

function mapWarehouseItems(rows: WarehouseFeedRow[] | null, nowMs: number): FeedItem[] {
  return (rows ?? [])
    .filter((row) => isWarehouseActive(row, nowMs))
    .slice(0, PER_SOURCE_LIMIT)
    .map((row) => {
      const type = toWarehouseType(row.type);
      const priceLabel = row.price > 0 ? `${row.price} €` : null;
      return {
        id: `sklad:${row.id}`,
        source: "sklad" as const,
        title: normalizeText(row.title) || WAREHOUSE_TYPE_LABEL[type],
        snippet: buildSnippet(row.description),
        date: row.created_at,
        meta: [WAREHOUSE_TYPE_LABEL[type], priceLabel]
          .filter((value) => value !== null)
          .join(" · "),
        itemId: row.id,
        warehouseType: type,
      };
    });
}

async function loadHlasnikFeed(): Promise<FeedItem[]> {
  const nowMs = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  const [postsRes, announcementsRes, eventsRes, wasteRes, warehouseRes] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, user_id, type, category, title, content, created_at, expires_at, profiles!user_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT * 2),
    supabase
      .from("announcements")
      .select("id, source, title, content, priority, published_at, expires_at")
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
    supabase
      .from("warehouse_items")
      .select("id, type, title, description, price, created_at, expires_at")
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT * 2),
  ]);

  if (postsRes.error) console.error("Hlásnik: príspevky sa nepodarilo načítať:", postsRes.error);
  if (announcementsRes.error) {
    console.error("Hlásnik: oznamy sa nepodarilo načítať:", announcementsRes.error);
  }
  if (eventsRes.error) {
    console.error("Hlásnik: udalosti kalendára sa nepodarilo načítať:", eventsRes.error);
  }
  if (wasteRes.error) {
    console.error("Hlásnik: harmonogram vývozu sa nepodarilo načítať:", wasteRes.error);
  }
  if (warehouseRes.error) {
    console.error("Hlásnik: položky susedského skladu sa nepodarilo načítať:", warehouseRes.error);
  }

  const items: FeedItem[] = [
    ...mapPosts(postsRes.data as unknown as PostFeedRow[] | null),
    ...mapAnnouncements(announcementsRes.data as unknown as AnnouncementFeedRow[] | null),
    ...mapCalendarEvents(eventsRes.data as unknown as EventFeedRow[] | null),
    ...mapWasteEvents(wasteRes.data as unknown as EventFeedRow[] | null),
    ...mapWarehouseItems(warehouseRes.data as unknown as WarehouseFeedRow[] | null, nowMs),
  ];

  return items
    .filter((item) => Number.isFinite(new Date(item.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, FEED_LIMIT);
}

/**
 * Načíta najnovšie záznamy zo všetkých dostupných zdrojov paralelne a zlúči ich
 * do jednej časovej osi zoradenej od najnovších po najstaršie.
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
