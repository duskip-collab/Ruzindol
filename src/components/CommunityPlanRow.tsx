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

type WasteCollection = {
  date: string;
  dayOfWeek: string;
  types: string;
};

export function CommunityPlanRow() {
  // Načítanie nadchádzajúcich akcií z kalendára Supabase
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["community-plan-events"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
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

  // Najbližší zber odpadu (môže byť dynamický alebo statický konfigurovateľný)
  const nextWaste: WasteCollection = {
    date: "22. SEP",
    dayOfWeek: "Utorok",
    types: "Zmesový + Plasty",
  };

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
        {/* 1. Fixná dlaždica: Najbližší zber odpadu */}
        <Link
          to="/kalendar"
          className="snap-start group shrink-0 w-44 h-32 rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-amber-500/50"
        >
          <div className="flex items-center gap-2 text-foreground">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
              <Trash2 className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Zber odpadu</span>
          </div>

          <div className="mt-2">
            <p className="text-xl font-bold text-foreground leading-none">{nextWaste.date}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{nextWaste.dayOfWeek}</p>
            <p className="text-[10px] text-muted-foreground/90 mt-1 truncate group-hover:text-primary transition-colors">
              {nextWaste.types}
            </p>
          </div>
        </Link>

        {/* 2. Dynamické dlaždice: Komunitné podujatia */}
        {isLoadingEvents ? (
          <div className="shrink-0 w-40 h-32 rounded-2xl border border-border bg-card p-4 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length > 0 ? (
          events.map((event) => {
            const eventDate = new Date(event.start_date);
            const dateShort = eventDate.toLocaleDateString("sk-SK", {
              day: "numeric",
              month: "short",
            });
            const timeStr = eventDate.toLocaleTimeString("sk-SK", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Link
                to="/kalendar"
                key={event.id}
                className="snap-start group shrink-0 w-40 h-32 rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-emerald-500/50"
              >
                <div className="flex items-center gap-2 text-foreground">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                    {timeStr !== "00:00" ? timeStr : "Celý deň"}
                  </span>
                </div>

                <div className="mt-2">
                  <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {event.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{dateShort}</p>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="shrink-0 w-40 h-32 rounded-2xl border border-dashed border-border bg-card p-4 flex items-center justify-center text-center">
            <p className="text-xs text-muted-foreground">Žiadne nadchádzajúce akcie</p>
          </div>
        )}
      </div>
    </div>
  );
}