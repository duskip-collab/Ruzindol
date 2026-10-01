import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, MapPin, MapPinned, Navigation, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * "Akcie v okolí" (Tip na víkend)
 * ------------------------------------------------------------------
 * Modul pre sekciu Aktuality. Zobrazuje sa ako tlačidlo/dlaždica,
 * po kliknutí otvára overlay okno so zoznamom akcií z tabuľky `okolite_akcie`.
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
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<OkolitaAkcia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<DistanceFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // Načítanie dát prebieha len vtedy, keď je modálne okno otvorené alebo sa vynúti obnovenie
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, refreshKey]);

  const filtered = useMemo(() => {
    const active = DISTANCE_FILTERS.find((f) => f.key === filter) ?? DISTANCE_FILTERS[0];
    return items.filter((it) => Number(it.vzdialenost_km) <= active.max);
  }, [items, filter]);

  return (
    <>
      {/* 1. Tlačidlo / Dlaždica v mriežke sekcie Aktuality */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          setIsOpen(true);
        }}
        className="app-card flex flex-col items-center justify-center p-4 rounded-3xl shadow-sm hover:scale-[1.02] transition-all text-center w-full group cursor-pointer border border-border/50"
      >
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-2 group-hover:bg-orange-500/20 transition-colors">
          <MapPinned className="w-6 h-6" />
        </div>
        <span className="font-semibold text-foreground text-sm">Akcie v okolí</span>
        <span className="text-[11px] text-muted-foreground">Tip na víkend</span>
      </button>

      {/* 2. Modálne okno (Overlay) na celú plochu so zatváracím krížikom */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-background w-full h-full sm:h-[85vh] sm:max-h-[800px] sm:max-w-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-border">
            
            {/* Hlavička modalu */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <MapPinned className="h-5 w-5 text-orange-500" />
                <div>
                  <h2 className="text-base font-bold text-foreground">Akcie v okolí</h2>
                  <p className="text-xs text-muted-foreground">Tip na víkend · do 30 km od Ružindolu</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setRefreshKey((k) => k + 1);
                  }}
                  className="header-action-button flex h-9 w-9 items-center justify-center rounded-full"
                  title="Obnoviť akcie v okolí"
                  aria-label="Obnoviť akcie v okolí"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </button>

                {/* Zatváracie tlačidlo (krížik) */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setIsOpen(false);
                  }}
                  className="header-action-button flex h-9 w-9 items-center justify-center rounded-full"
                  aria-label="Zatvoriť"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filtre vzdialenosti */}
            <div className="px-6 py-3 border-b border-border bg-muted/30">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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
                        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer",
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
            </div>

            {/* Obsah – zoznam akcií */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-muted/10">
              {loading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  <p className="text-xs">Načítavam akcie v okolí...</p>
                </div>
              ) : error ? (
                <p className="py-16 text-center text-xs text-muted-foreground">
                  Akcie sa nepodarilo načítať. Skúste obnoviť.
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-16 text-center text-xs text-muted-foreground">
                  V tejto vzdialenosti zatiaľ nie sú žiadne akcie.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filtered.map((it) => (
                    <AkciaCard key={it.id} item={it} />
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

function AkciaCard({ item }: { item: OkolitaAkcia }) {
  const meta = KATEGORIA_META[item.kategoria] ?? KATEGORIA_META.kultura;
  const distance = Number(item.vzdialenost_km);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${item.miesto},${item.obec}`,
  )}`;

  return (
    <article className="app-card flex flex-col justify-between overflow-hidden rounded-2xl p-3.5 shadow-sm border border-border/60 bg-background">
      <div>
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${meta.accent} px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm`}
          >
            <span>{meta.emoji}</span>
            {meta.label}
          </span>
          <span className="chip-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            <MapPin className="h-2.5 w-2.5" />
            {distance} km
          </span>
        </div>

        <h4 className="line-clamp-2 text-sm font-semibold text-foreground mb-1">{item.nazov}</h4>

        {item.popis && (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground mb-3">
            {item.popis}
          </p>
        )}
      </div>

      <div className="space-y-2.5 pt-2 border-t border-border/40">
        <div className="space-y-1 text-[11px] text-muted-foreground">
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
          className="btn-primary-glow w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer"
        >
          <Navigation className="h-3.5 w-3.5" /> Navigovať
        </a>
      </div>
    </article>
  );
}