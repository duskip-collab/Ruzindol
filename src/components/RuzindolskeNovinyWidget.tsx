import { useEffect, useState } from "react";
import { Loader2, Newspaper, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * "Ružindolské noviny" (týždenný komunitný prehľad)
 * ------------------------------------------------------------------
 * Modul pre sekciu Aktuality. Zobrazuje sa ako dlaždica; po kliknutí otvára
 * overlay okno s najnovším týždenným súhrnom z tabuľky `tyzdenne_sumare`.
 * Dáta plní na pozadí Edge Function "generuj-tyzdenny-sumar" (AI + Google Search).
 */

type TydennySumar = {
  id: string;
  titulok: string;
  obsah: string;
  obdobie: string | null;
  created_at: string;
};

export function RuzindolskeNovinyWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [sumar, setSumar] = useState<TydennySumar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Načítanie najnovšieho vydania prebehne len pri otvorení okna / obnovení.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);

      const { data, error: queryError } = await supabase
        .from("tyzdenne_sumare")
        .select("id, titulok, obsah, obdobie, created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      if (cancelled) return;

      if (queryError) {
        console.error("Chyba pri načítavaní Ružindolských novín:", queryError);
        setSumar(null);
        setError(true);
      } else {
        setSumar((data as unknown as TydennySumar[] | null)?.[0] ?? null);
      }

      setLoading(false);
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
        <span className="flex h-12 w-12 items-center justify-center rounded-full shadow-sm bg-indigo-500 text-white">
          <Newspaper className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold leading-tight text-foreground">
          Ružindolské noviny
        </span>
      </button>

      {/* 2. Overlay modal s najnovším týždenným súhrnom */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-background w-full h-full sm:h-[85vh] sm:max-h-[800px] sm:max-w-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-border">
            {/* Hlavička modalu */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <Newspaper className="h-5 w-5 text-indigo-500" />
                <div>
                  <h2 className="text-base font-bold text-foreground">Ružindolské noviny</h2>
                  <p className="text-xs text-muted-foreground">Týždenný prehľad diania v obci</p>
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
                  title="Obnoviť noviny"
                  aria-label="Obnoviť noviny"
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

            {/* Obsah – najnovší článok */}
            <div className="p-6 overflow-y-auto flex-1 bg-muted/10">
              {loading && !sumar ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <p className="text-xs">Načítavam Ružindolské noviny...</p>
                </div>
              ) : error ? (
                <p className="py-16 text-center text-xs text-muted-foreground">
                  Noviny sa nepodarilo načítať. Skúste obnoviť.
                </p>
              ) : !sumar ? (
                <p className="py-16 text-center text-xs text-muted-foreground">
                  Zatiaľ nevyšlo žiadne vydanie. Skúste to neskôr.
                </p>
              ) : (
                <article className="app-card rounded-2xl p-5 shadow-sm border border-border/60 bg-background">
                  {sumar.obdobie && (
                    <span className="chip-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
                      {sumar.obdobie}
                    </span>
                  )}
                  <h3 className="mt-2 text-lg font-bold leading-snug text-foreground">
                    {sumar.titulok}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Vydané {new Date(sumar.created_at).toLocaleDateString("sk-SK")}
                  </p>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {sumar.obsah}
                  </div>
                </article>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
