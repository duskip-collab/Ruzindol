import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Church,
  CalendarDays,
  MapPin,
  Plus,
  Loader2,
  X,
  Trash2,
  Maximize2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type EventCategory = "Samosprava" | "Kostol";

type DbEvent = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  type: EventCategory;
};

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
  const { profile, userId } = useCurrentUser();
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const canManage =
    profile?.role === "Starosta" || profile?.role === "Uradnik";

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, author_id, title, description, location, starts_at, ends_at, type")
      .gte("starts_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    setEvents((data as DbEvent[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const upcoming = useMemo(() => events, [events]);

  async function handleDelete(id: string) {
    if (!confirm("Naozaj vymazať túto udalosť?")) return;
    await supabase.from("events").delete().eq("id", id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function toggleExpand() {
    if (showForm) return; // neexpanuj ak je otvorený formulár
    setExpanded((v) => !v);
  }

  function handleClose() {
    setExpanded(false);
  }

  const CalendarContent = () => (
    <>
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
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
                setShowForm(true);
              }}
              className="ml-1 flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-neutral-800"
              title="Pridať udalosť"
            >
              <Plus className="h-3 w-3" /> Pridať
            </button>
          )}
          {expanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              aria-label="Zatvoriť"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className={`${expanded ? "flex-1 overflow-y-auto pr-1" : "max-h-72 overflow-y-auto pr-1"}`}>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-500">
            Momentálne nie sú naplánované žiadne udalosti.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {upcoming.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                canDelete={canManage || e.author_id === userId}
                onDelete={() => handleDelete(e.id)}
              />
            ))}
          </ol>
        )}
      </div>
    </>
  );

  if (expanded) {
    return (
      <div
        className="absolute inset-0 z-[60] flex flex-col bg-white/95 backdrop-blur-xl p-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={handleClose}
      >
        <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
          <CalendarContent />

          {showForm && canManage && userId && (
            <EventForm
              userId={userId}
              onClose={() => setShowForm(false)}
              onCreated={async () => {
                setShowForm(false);
                await load();
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      className="rounded-3xl border border-neutral-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-xl cursor-pointer transition hover:shadow-md hover:bg-white/90"
      onClick={toggleExpand}
      title="Kliknite pre zobrazenie na celú obrazovku"
    >
      <div onClick={(e) => e.stopPropagation()}>
        <CalendarContent />
      </div>
      <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-neutral-400">
        <Maximize2 className="h-3 w-3" />
        <span>Kliknite pre rozšírenie</span>
      </div>

      {showForm && canManage && userId && (
        <EventForm
          userId={userId}
          onClose={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}
    </section>
  );
}

function EventRow({
  event,
  canDelete,
  onDelete,
}: {
  event: DbEvent;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const theme = THEME[event.type ?? "Samosprava"];
  const d = formatDate(event.starts_at);

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
      {canDelete && (
        <button
          onClick={onDelete}
          className="self-start rounded-full p-1 text-neutral-400 hover:bg-white/60 hover:text-red-600"
          title="Zmazať"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function EventForm({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<EventCategory>("Samosprava");
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim()) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from("events").insert({
      author_id: userId,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      type,
      starts_at: new Date(startsAt).toISOString(),
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
          aria-label="Zavrieť"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-semibold">📅 Nová udalosť</h2>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
      >
        <div>
          <label className="text-sm font-medium text-neutral-700">
            Kategória
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(THEME) as EventCategory[]).map((t) => {
              const m = THEME[t];
              const active = type === t;
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Názov</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Popis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Miesto</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            maxLength={200}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">
            Začiatok
          </label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Uložiť udalosť
          </button>
        </div>
      </form>
    </div>
  );
}
