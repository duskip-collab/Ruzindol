import { Trash2, CalendarDays, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type CalendarEvent = {
  id: string;
  title: string;
  start_date: string;
  location?: string | null;
  category?: string | null;
};

type WasteItem = {
  id: string;
  collection_date: string;
  waste_types: string;
};

// Bezpečné parsovanie dátumu bez UTC posunu (iOS vs Android timezone fix)
function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  const cleanStr = dateStr.split("T")[0];
  const parts = cleanStr.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  return new Date(dateStr);
}

export function CommunityPlanRow() {
  const today = new Date().toISOString().split("T")[0];

  // Načítanie nadchádzajúcich akcií z kalendára Supabase
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["community-plan-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar")
        .select("*")
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .limit(5);

      if (error) {
        console.error("Error fetching calendar events:", error);
        return [];
      }
      return data as CalendarEvent[];
    },
  });

  // Dynamické načítanie najbližšieho zberu odpadu zo Supabase
  const { data: nextWaste, isLoading: isLoadingWaste } = useQuery({
    queryKey: ["community-plan-next-waste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_collection")
        .select("*")
        .gte("collection_date", today)
        .order("collection_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching waste collection:", error);
        return null;
      }
      return data as WasteItem | null;
    },
  });

  return (
    <div className="my-5">
      {/* Hlavička sekcie */}
      <div className="flex items-center justify-between px-4 md:px-6 mb-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
          <span>📅</span> Komunitný plán
        </h2>
        <Link
          to="/kalendar"
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 transition-colors"
        >
          Celý kalendár <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Horizontálny posuvný kontajner s čistým skrytím scrollbaru cez Tailwind */}
      <div className="flex gap-3 px-4 md:px-6 overflow-x-auto [&-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory pb-2">
        {/* 1. Dynamická dlaždica: Najbližší zber odpadu */}
        {isLoadingWaste ? (
          <div className="shrink-0 w-44 h-28 rounded-2xl border border-border bg-card p-3.5 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : nextWaste ? (
          (() => {
            const wasteDateObj = parseLocalDate(nextWaste.collection_date);
            const dateShort = wasteDateObj.toLocaleDateString("sk-SK", {
              day: "numeric",
              month: "short",
            }).toUpperCase();
            const dayOfWeek = wasteDateObj.toLocaleDateString("sk-SK", {
              weekday: "long",
            });
            // Prvé písmeno dňa veľké
            const formattedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

            return (
              <Link
                to="/kalendar"
                search={{ category: "odpad" }}
                className="snap-start group shrink-0 w-44 h-28 rounded-2xl border border-border bg-card p-3.5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-amber-500/50"
              >
                <div className="flex items-center gap-1.5 text-foreground">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-amber-500/10 text-amber-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Zber odpadu</span>
                </div>

                <div className="mt-1.5">
                  <p className="text-lg font-bold text-foreground leading-none">{dateShort}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">{formattedDay}</p>
                  <p className="text-[10px] text-muted-foreground/90 mt-1 truncate group-hover:text-primary transition-colors">
                    {nextWaste.waste_types}
                  </p>
                </div>
              </Link>
            );
          })()
        ) : null}

        {/* 2. Dynamické dlaždice: Komunitné podujatia */}
        {isLoadingEvents ? (
          <div className="shrink-0 w-40 h-28 rounded-2xl border border-border bg-card p-3.5 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length > 0 ? (
          events.map((event) => {
            const eventDate = parseLocalDate(event.start_date);
            const dateShort = eventDate.toLocaleDateString("sk-SK", {
              day: "numeric",
              month: "short",
            });
            const timeStr = event.start_date.includes("T")
              ? new Date(event.start_date).toLocaleTimeString("sk-SK", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Celý deň";

            return (
              <Link
                to="/kalendar"
                key={event.id}
                className="snap-start group shrink-0 w-40 h-28 rounded-2xl border border-border bg-card p-3.5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-emerald-500/50"
              >
                <div className="flex items-center gap-1.5 text-foreground">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                    {timeStr !== "00:00" ? timeStr : "Celý deň"}
                  </span>
                </div>

                <div className="mt-1.5">
                  <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {event.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">{dateShort}</p>
                </div>
              </Link>
            );
          })
        ) : !nextWaste ? (
          <div className="shrink-0 w-full h-28 rounded-2xl border border-dashed border-border bg-card p-3.5 flex items-center justify-center text-center">
            <p className="text-xs text-muted-foreground">Žiadne ďalšie plánované akcie</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}