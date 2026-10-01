import { useEffect, useRef, useState } from "react";
import { ExternalLink, ImageOff, Loader2, MapPinned, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * "Správy z regiónu" (RSS prehľad regiónu)
 * ------------------------------------------------------------------
 * Modul pre sekciu Aktuality. Zobrazuje sa ako dlaždica; po kliknutí otvára
 * overlay okno so zoznamom článkov z tabuľky `region_spravy`.
 * Obsah plní na pozadí Edge Function "aktualizuj-region-spravy", ktorá
 * sťahuje RSS feed Trnavského hlasu. Žiadny AI agent, žiadne generovanie
 * textu – zobrazuje sa výhradne to, čo bolo v RSS feede.
 */

type RegionSprava = {
  id: string;
  guid: string;
  titulok: string;
  popis: string | null;
  obrazok_url: string | null;
  zdroj_url: string;
  zdroj_nazov: string;
  publikovane_at: string;
  stazena: boolean;
};

function formatPublished(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("sk-SK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SpravyZRegionuWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<RegionSprava[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const initialFetchAttempted = useRef(false);

  // Načítanie prebehne len pri otvorení okna / obnovení.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const loadItems = async (): Promise<RegionSprava[]> => {
        const { data, error: queryError } = await supabase
          .from("region_spravy")
          .select(
            "id, guid, titulok, popis, obrazok_url, zdroj_url, zdroj_nazov, publikovane_at, stazena",
          )
          .order("publikovane_at", { ascending: false })
          .limit(50);

        if (queryError) throw queryError;
        return (data as unknown as RegionSprava[] | null) ?? [];
      };

      try {
        let nextItems = await loadItems();
        if (cancelled) return;

        // Prázdny zoznam a ešte sme ho nikdy nenaplnili -> skúsiť načítať RSS.
        if (nextItems.length === 0 && !initialFetchAttempted.current) {
          initialFetchAttempted.current = true;
          const { error: invokeError } = await supabase.functions.invoke(
            "aktualizuj-region-spravy",
          );
          if (invokeError) console.warn("Načítanie RSS zlyhalo:", invokeError);
          nextItems = await loadItems();
        }

        if (!cancelled) setItems(nextItems);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Chyba pri načítavaní správ z regiónu:", loadError);
          setItems([]);
          setError(loadError instanceof Error ? loadError.message : "Neznáma chyba.");
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshKey]);

  return (
    <>
      {/* 1. Dlaždica v mriežke sekcie Aktuality (rovnaký dizajn ako ostatné) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          setIsOpen(true);
        }}
        className="app-card flex flex-col items-center justify-center gap-3 rounded-2xl p-4 text-center transition hover:scale-[1.02] hover:bg-[color:var(--bg-surface-hover)] shadow-sm"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full shadow-sm bg-sky-500 text-white">
          <MapPinned className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold leading-tight text-foreground">
          Správy z regiónu
        </span>
      </button>

      {/* 2. Modálne okno (Overlay) na celú plochu so zatváracím krížikom */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-background w-full h-full sm:h-[85vh] sm:max-h-[800px] sm:max-w-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-border">
            {/* Hlavička modalu */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <MapPinned className="h-5 w-5 text-sky-500" />
                <div>
                  <h2 className="text-base font-bold text-foreground">Správy z regiónu</h2>
                  <p className="text-xs text-muted-foreground">
                    Trnava a okolie · priamo z RSS Trnavského hlasu
                  </p>
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
                  title="Obnoviť správy"
                  aria-label="Obnoviť správy"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </button>

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

            {/* Obsah – zoznam článkov */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-muted/10">
              {loading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                  <p className="text-xs">Načítavam správy z regiónu...</p>
                </div>
              ) : error && items.length === 0 ? (
                <p className="py-16 text-center text-xs text-muted-foreground">
                  Správy sa nepodarilo načítať: {error}
                </p>
              ) : items.length === 0 ? (
                <p className="py-16 text-center text-xs text-muted-foreground">
                  Zatiaľ nie sú dostupné žiadne správy. Skúste to neskôr.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <SpravaCard key={item.id} item={item} />
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

function SpravaCard({ item }: { item: RegionSprava }) {
  const [imageFailed, setImageFailed] = useState(false);
  const published = formatPublished(item.publikovane_at);

  return (
    <article className="app-card flex flex-col overflow-hidden rounded-2xl shadow-sm border border-border/60 bg-background">
      {item.obrazok_url && !imageFailed ? (
        <img
          src={item.obrazok_url}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-36 w-full object-cover bg-muted"
        />
      ) : item.obrazok_url ? (
        <div className="flex h-36 w-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="h-6 w-6" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-3.5">
        {published && (
          <span className="chip-muted inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
            {published}
          </span>
        )}

        <h4 className="mt-2 line-clamp-3 text-sm font-semibold leading-snug text-foreground">
          {item.titulok}
        </h4>

        {item.popis && (
          <p className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">
            {item.popis}
          </p>
        )}

        <a
          href={item.zdroj_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => triggerHaptic("light")}
          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-sm"
        >
          Čítať na webe
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Zdroj: {item.zdroj_nazov}
        </p>
      </div>
    </article>
  );
}
