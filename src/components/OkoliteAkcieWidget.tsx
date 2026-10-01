import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, MapPin, MapPinned, Navigation, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * "Akcie v okolí" (Tip na víkend)
 * ------------------------------------------------------------------
 * Plne izolovaný modul pre sekciu Aktuality. Iba ČÍTA z novej tabuľky
 * `okolite_akcie` (RLS = verejné SELECT). Nikdy nezapisuje a nemení žiadne
 * existujúce tabuľky ani nastavenia aplikácie.
 *
 * Dáta plní na pozadí Edge Function "aktualizuj-akcie" (AI agent Gemini).
 */

type Kategoria = "trhy" | "kultura" | "sport" | "hodove" | "gastronomia";

type OkolitaAkcia = {
  id: string;
  nazov: string;
  popis: string | null;
  obec: string;
  vzdialenost_km: number;
  kategoria: Kategoria;
  datum_cas: string;
  miesto: string;
  created_at: string;
};

const KATEGORIA_META: Record<Kategoria, { label: string; emoji: string; accent: string }> = {
  trhy: { label: "Trhy", emoji: "🛒", accent: "from-emerald-500 to-teal-500" },
  kultura: { label: "Kultúra", emoji: "🎭", accent: "from-violet-500 to-indigo-500" },
  sport: { label: "Šport", emoji: "⚽", accent: "from-sky-500 to-blue-500" },
  hodove: { label: "Hody", emoji: "🎉", accent: "from-amber-500 to-orange-500" },
  gastronomia: { label: "Gastro", emoji: "🍽️", accent: "from-rose-500 to-pink-500" },
};

type DistanceFilter = "all" | "10" | "20" | "30";

const DISTANCE_FILTERS: { key: DistanceFilter; label: string; max: number }[] = [
  { key: "all", label: "Všetko do 30 km", max: Number.POSITIVE_INFINITY },
  { key: "10", label: "📍 do 10 km", max: 10 },
  { key: "20", label: "🚗 do 20 km", max: 20 },
  { key: "30", label: "🗺️ do 30 km", max: 30 },
];

export function OkoliteAkcieWidget() {
  const [items, setItems] = useState<OkolitaAkcia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<DistanceFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);

      const { data, error: queryError } = await supabase
        .from("okolite_akcie")
        .select("id, nazov, popis, obec, vzdialenost_km, kategoria, datum_cas, miesto, created_at")
        .order("vzdialenost_km", { ascending: true })
        .limit(100);

      if (cancelled) return;

      if (queryError) {
        console.error("Chyba pri načítavaní akcií v okolí:", queryError);
        setItems([]);
        setError(true);
      } else {
        setItems((data as unknown as OkolitaAkcia[] | null) ?? []);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const active = DISTANCE_FILTERS.find((f) => f.key === filter) ?? DISTANCE_FILTERS[0];
    return items.filter((it) => Number(it.vzdialenost_km) <= active.max);
  }, [items, filter]);

  return (
    <section className="app-card rounded-3xl p-4 shadow-sm backdrop-blur-xl">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-[color:var(--text-main)]" />
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Akcie v okolí</h3>
            <p className="text-[10px] text-muted-foreground">
              Tip na víkend · do 30 km od Ružindolu
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setRefreshKey((k) => k + 1);
          }}
          className="header-action-button flex h-7 w-7 items-center justify-center rounded-full"
          title="Obnoviť akcie v okolí"
          aria-label="Obnoviť akcie v okolí"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </header>

      {/* Interaktívne filtre vzdialenosti – moderné kapsuly */}
      <div className="mb-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {DISTANCE_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setFilter(f.key);
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "btn-primary-glow shadow-sm"
                  : "chip-muted hover:bg-[color:var(--bg-surface-hover)]",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Akcie sa nepodarilo načítať. Skúste obnoviť.
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          V tejto vzdialenosti zatiaľ nie sú žiadne akcie.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {filtered.map((it) => (
            <AkciaCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}

function AkciaCard({ item }: { item: OkolitaAkcia }) {
  const meta = KATEGORIA_META[item.kategoria] ?? KATEGORIA_META.kultura;
  const distance = Number(item.vzdialenost_km);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${item.miesto}, ${item.obec}`,
  )}`;

  return (
    <article className="app-card flex flex-col overflow-hidden rounded-2xl p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${meta.accent} px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm`}
        >
          <span>{meta.emoji}</span>
          {meta.label}
        </span>
        <span className="chip-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
          <MapPin className="h-2.5 w-2.5" />
          {distance} km
        </span>
      </div>

      <h4 className="line-clamp-2 text-sm font-semibold text-foreground">{item.nazov}</h4>

      {item.popis && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {item.popis}
        </p>
      )}

      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.datum_cas}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {item.miesto} · {item.obec}
          </span>
        </p>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => triggerHaptic("light")}
        className="btn-primary-glow mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
      >
        <Navigation className="h-3.5 w-3.5" /> Navigovať
      </a>
    </article>
  );
}
