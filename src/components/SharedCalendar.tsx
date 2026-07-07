import { useMemo } from "react";
import { Landmark, Church, CalendarDays, MapPin } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { EventItem, EventCategory } from "@/types";

const THEME: Record<
  EventCategory,
  {
    label: string;
    icon: React.ReactNode;
    ring: string;
    bg: string;
    chip: string;
    accent: string;
  }
> = {
  Samosprava: {
    label: "Samospráva",
    icon: <Landmark className="h-3.5 w-3.5" />,
    ring: "border-blue-300",
    bg: "bg-blue-50/70",
    chip: "bg-blue-600 text-white",
    accent: "text-blue-700",
  },
  Kostol: {
    label: "Kostol",
    icon: <Church className="h-3.5 w-3.5" />,
    ring: "border-amber-300",
    bg: "bg-gradient-to-br from-purple-50/80 to-amber-50/80",
    chip: "bg-gradient-to-r from-purple-600 to-amber-600 text-white",
    accent: "text-purple-700",
  },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("sk-SK", { day: "2-digit" }),
    month: d.toLocaleDateString("sk-SK", { month: "short" }).replace(".", ""),
    time: d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }),
    weekday: d.toLocaleDateString("sk-SK", { weekday: "short" }),
  };
}

export function SharedCalendar() {
  const { events } = useApp();

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => new Date(e.startsAt).getTime() >= now - 3 * 60 * 60 * 1000)
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
  }, [events]);

  return (
    <section className="rounded-3xl border border-neutral-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-neutral-700" />
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900">
            Zdieľaný kalendár obce
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
            <Landmark className="h-3 w-3" /> Samospráva
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-100 to-amber-100 px-2 py-0.5 font-medium text-purple-700">
            <Church className="h-3 w-3" /> Kostol
          </span>
        </div>
      </header>

      {upcoming.length === 0 ? (
        <p className="py-6 text-center text-xs text-neutral-500">
          Momentálne nie sú naplánované žiadne udalosti.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {upcoming.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </ol>
      )}
    </section>
  );
}

function EventRow({ event }: { event: EventItem }) {
  const theme = THEME[event.type ?? "Samosprava"];
  const d = formatDate(event.startsAt);

  return (
    <li
      className={`flex gap-3 rounded-2xl border ${theme.ring} ${theme.bg} p-2.5`}
    >
      <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white/80 py-1 text-center shadow-sm">
        <span className={`text-lg font-bold leading-none ${theme.accent}`}>
          {d.day}
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
          {d.month}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${theme.chip}`}
          >
            {theme.icon}
            {theme.label}
          </span>
          <span className="text-[10px] text-neutral-500">
            {d.weekday} · {d.time}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-neutral-900">
          {event.title}
        </p>
        <p className="line-clamp-1 text-[11px] text-neutral-600">
          {event.description}
        </p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-neutral-500">
            <MapPin className="h-3 w-3" />
            {event.location}
          </p>
        )}
      </div>
    </li>
  );
}
