import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  Landmark,
  Church,
  CalendarDays,
  MapPin,
  Plus,
  Loader2,
  X,
  Trash2,
  Maximize2,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { syncMunicipalEventsIfNeeded } from "@/lib/municipal-events-sync";
import { isIosDevice } from "@/lib/pwa";

type EventCategory = "Samosprava" | "Kostol";

type DbEvent = {
  id: string;
  author_id: string | null;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  end_date: string | null;
  end_time: string | null;
  source_url: string | null;
  image_url: string | null;
  type: EventCategory;
};

type EventAttendance = {
  event_id: string;
  user_id: string;
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
    label: "Samosprava",
    icon: <Landmark className="h-3.5 w-3.5" />,
    ring: "border-[color:var(--border-card)]",
    bg: "bg-[color:var(--bg-surface)]",
    chip: "border border-[color:rgba(255,107,0,0.24)] bg-[rgba(255,107,0,0.12)] text-[#ffb26a]",
    accent: "text-[#ff6b00]",
  },
  Kostol: {
    label: "Kostol",
    icon: <Church className="h-3.5 w-3.5" />,
    ring: "border-[color:var(--border-card)]",
    bg: "bg-[color:var(--bg-surface)]",
    chip: "border border-[color:rgba(148,163,184,0.18)] bg-[rgba(30,34,43,0.96)] text-[#f8fafc]",
    accent: "text-[#f8fafc]",
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

function toLocalDatetimeInput(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function toDatePart(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toTimePart(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16);
}

async function uploadEventImage(input: File, userId: string) {
  const compressed = await imageCompression(input, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.78,
  });

  const filename = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("events_images").upload(filename, compressed, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("events_images").getPublicUrl(filename);
  return data.publicUrl;
}

export function SharedCalendar() {
  const { profile, userId } = useCurrentUser();
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DbEvent | null>(null);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [attendanceBusyId, setAttendanceBusyId] = useState<string | null>(null);

  const canManage = profile?.role === "Starosta" || profile?.role === "Uradnik" || profile?.role === "Farar";
  const canUseDom = typeof document !== "undefined";
  const useIosBackNav = isIosDevice();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select(
        "id, author_id, title, description, location, starts_at, ends_at, end_date, end_time, source_url, image_url, type",
      )
      .gte("starts_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(80);

    const eventList = (data as DbEvent[]) ?? [];
    setEvents(eventList);

    if (eventList.length === 0) {
      setAttendingIds(new Set());
      setAttendanceCounts({});
      return;
    }

    const eventIds = eventList.map((event) => event.id);
    const { data: attendanceRows } = await supabase
      .from("event_attendees")
      .select("event_id, user_id")
      .in("event_id", eventIds);

    const counts: Record<string, number> = {};
    const myIds = new Set<string>();

    (attendanceRows as EventAttendance[] | null)?.forEach((row) => {
      counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
      if (row.user_id === userId) myIds.add(row.event_id);
    });

    setAttendanceCounts(counts);
    setAttendingIds(myIds);
  }, [userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      await syncMunicipalEventsIfNeeded();
      await load();
      setLoading(false);
    })();
  }, [load]);

  const upcoming = useMemo(() => events, [events]);

  async function handleDelete(id: string) {
    if (!confirm("Naozaj vymazat tuto udalost?")) return;
    await supabase.from("events").delete().eq("id", id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (selectedEvent?.id === id) setSelectedEvent(null);
  }

  async function toggleAttendance(eventId: string) {
    if (!userId || attendanceBusyId) return;

    const isAttending = attendingIds.has(eventId);
    setAttendanceBusyId(eventId);

    if (isAttending) {
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);

      setAttendanceBusyId(null);
      if (error) return;

      setAttendingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      setAttendanceCounts((prev) => ({ ...prev, [eventId]: Math.max((prev[eventId] ?? 1) - 1, 0) }));
      return;
    }

    const { error } = await supabase.from("event_attendees").insert({ event_id: eventId, user_id: userId });

    setAttendanceBusyId(null);
    if (error) return;

    setAttendingIds((prev) => new Set(prev).add(eventId));
    setAttendanceCounts((prev) => ({ ...prev, [eventId]: (prev[eventId] ?? 0) + 1 }));
  }

  function openExpanded() {
    if (showForm) return;
    setExpanded(true);
  }

  function closeExpanded() {
    setExpanded(false);
  }

  const renderCalendarContent = ({ fullscreen }: { fullscreen: boolean }) => (
    <>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#f8fafc]" />
          <h3 className="text-sm font-semibold tracking-tight text-[#f8fafc]">Zdielany kalendar obce</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(255,107,0,0.24)] bg-[rgba(255,107,0,0.12)] px-2 py-0.5 font-medium text-[#ffb26a]">
            <Landmark className="h-3 w-3" /> Samosprava
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] px-2 py-0.5 font-medium text-[#f8fafc]">
            <Church className="h-3 w-3" /> Kostol
          </span>
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowForm(true);
              }}
              className="ml-1 flex items-center gap-1 rounded-full border border-[color:rgba(255,107,0,0.24)] bg-[rgba(255,107,0,0.12)] px-2 py-1 text-[10px] font-semibold text-[#f8fafc] hover:bg-[rgba(255,107,0,0.18)]"
              title="Pridat udalost"
            >
              <Plus className="h-3 w-3" /> Pridat
            </button>
          )}
          {fullscreen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeExpanded();
              }}
              className={`ml-1 h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] text-[#f8fafc] hover:bg-[color:var(--bg-surface-hover)] ${useIosBackNav ? "hidden md:flex" : "flex"}`}
              aria-label="Zavriet"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className={`${fullscreen ? "flex-1 overflow-y-auto pr-1" : "max-h-72 overflow-y-auto pr-1"}`}>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-[#94a3b8]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#94a3b8]">Momentalne nie su naplanovane ziadne udalosti.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {upcoming.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                attendanceCount={attendanceCounts[e.id] ?? 0}
                attending={attendingIds.has(e.id)}
                attendanceBusy={attendanceBusyId === e.id}
                canDelete={canManage || e.author_id === userId}
                canAttend={Boolean(userId)}
                onOpen={() => setSelectedEvent(e)}
                onToggleAttendance={() => void toggleAttendance(e.id)}
                onDelete={() => void handleDelete(e.id)}
              />
            ))}
          </ol>
        )}
      </div>
    </>
  );

  return (
    <>
      <section
        className="app-card rounded-3xl p-4 shadow-sm backdrop-blur-xl transition hover:bg-[color:var(--bg-surface-hover)] hover:shadow-md"
        onClick={openExpanded}
        title="Kliknite pre rozsirenie"
      >
        <div onClick={(e) => e.stopPropagation()}>{renderCalendarContent({ fullscreen: false })}</div>
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-neutral-400">
          <Maximize2 className="h-3 w-3" />
          <span>Kliknite pre rozsirenie</span>
        </div>
      </section>

      {expanded && canUseDom &&
        createPortal(
          <div className="fixed inset-0 z-[150] flex h-[100dvh] w-full min-h-[100dvh] flex-col bg-[color:var(--bg-app)]/95 p-4 pt-safe backdrop-blur-xl">
            <div className={`flex h-full min-h-0 flex-col ${useIosBackNav ? "pb-20" : ""}`}>
              {renderCalendarContent({ fullscreen: true })}
            </div>
            {useIosBackNav && (
              <div className="absolute inset-x-0 bottom-0 border-t border-[color:var(--border-card)] bg-[color:var(--bg-surface)]/95 px-4 py-3 pb-safe md:hidden">
                <button
                  type="button"
                  onClick={closeExpanded}
                  className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
                  aria-label="Späť"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Späť
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}

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

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          attendanceCount={attendanceCounts[selectedEvent.id] ?? 0}
          attending={attendingIds.has(selectedEvent.id)}
          attendanceBusy={attendanceBusyId === selectedEvent.id}
          canAttend={Boolean(userId)}
          onClose={() => setSelectedEvent(null)}
          onToggleAttendance={() => void toggleAttendance(selectedEvent.id)}
        />
      )}
    </>
  );
}

function EventRow({
  event,
  attendanceCount,
  attending,
  attendanceBusy,
  canAttend,
  canDelete,
  onOpen,
  onToggleAttendance,
  onDelete,
}: {
  event: DbEvent;
  attendanceCount: number;
  attending: boolean;
  attendanceBusy: boolean;
  canAttend: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onToggleAttendance: () => void;
  onDelete: () => void;
}) {
  const theme = THEME[event.type ?? "Samosprava"];
  const d = formatDate(event.starts_at);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full gap-3 rounded-2xl border ${theme.ring} ${theme.bg} p-2.5 text-left transition hover:bg-[color:var(--bg-surface-hover)] hover:shadow-sm`}
      >
        <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-[color:var(--border-card)] bg-[#1e222b] py-1 text-center shadow-sm">
          <span className={`text-lg font-bold leading-none ${theme.accent}`}>{d.day}</span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">{d.month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${theme.chip}`}
            >
              {theme.icon}
              {theme.label}
            </span>
            <span className="text-[10px] text-[#94a3b8]">
              {d.weekday} · {d.time}
            </span>
            {event.image_url && (
              <span className="chip-muted inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
                <ImageIcon className="h-3 w-3" /> Foto
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-[#f8fafc]">{event.title}</p>
          <p className="line-clamp-1 text-[11px] text-[#94a3b8]">{event.description}</p>
          {event.location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[#94a3b8]">
              <MapPin className="h-3 w-3" />
              {event.location}
            </p>
          )}
          {event.source_url && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[#ffb26a]">
              <ExternalLink className="h-3 w-3" /> Zdroj dostupny
            </span>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] px-2 py-1 text-[10px] font-medium text-[#94a3b8] shadow-sm">
              Zaujemcovia: {attendanceCount}
            </span>
            {canAttend && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAttendance();
                }}
                disabled={attendanceBusy}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                  attending
                    ? "border border-[color:rgba(255,107,0,0.24)] bg-[rgba(255,107,0,0.12)] text-[#f8fafc] hover:bg-[rgba(255,107,0,0.18)]"
                    : "border border-[color:rgba(255,107,0,0.3)] bg-[#ff6b00] text-white hover:bg-[#e85f00]"
                } disabled:opacity-60`}
              >
                {attendanceBusy ? "Ukladam..." : attending ? "Zucastnim sa" : "Pridem"}
              </button>
            )}
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="self-start rounded-full p-1 text-muted-foreground hover:bg-[color:var(--bg-surface-hover)] hover:text-red-600"
            title="Zmazat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </button>
    </li>
  );
}

function EventDetailModal({
  event,
  attendanceCount,
  attending,
  attendanceBusy,
  canAttend,
  onClose,
  onToggleAttendance,
}: {
  event: DbEvent;
  attendanceCount: number;
  attending: boolean;
  attendanceBusy: boolean;
  canAttend: boolean;
  onClose: () => void;
  onToggleAttendance: () => void;
}) {
  const useIosBackNav = isIosDevice();
  const theme = THEME[event.type ?? "Samosprava"];
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;

  return createPortal(
    <div className="fixed inset-0 z-[170] flex h-[100dvh] w-full min-h-[100dvh] flex-col overflow-hidden bg-[color:var(--bg-app)] pt-safe">
      <div className="app-toolbar flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className={`header-action-button h-9 w-9 items-center justify-center rounded-full ${useIosBackNav ? "hidden md:flex" : "flex"}`}
          aria-label="Zavriet detail"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="line-clamp-1 text-sm font-semibold text-[#f8fafc] md:text-base">{event.title}</h2>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${useIosBackNav ? "pb-24" : ""} md:p-6 md:pb-6`}>
        <div className={`rounded-2xl border ${theme.ring} ${theme.bg} p-4`}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${theme.chip}`}>
              {theme.icon}
              {theme.label}
            </span>
            <span className="rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] px-2 py-1 text-[#94a3b8]">
              {start.toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            {end && (
              <span className="rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] px-2 py-1 text-[#94a3b8]">
                Koniec: {end.toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#f8fafc]">{event.description}</p>

          {event.location && (
            <p className="mt-3 flex items-center gap-1 text-xs text-[#94a3b8]">
              <MapPin className="h-3.5 w-3.5" /> {event.location}
            </p>
          )}

          {event.image_url && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border-card)] bg-[color:var(--bg-surface)]">
              <img src={event.image_url} alt={event.title} className="h-auto w-full object-contain" />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[#94a3b8]">
              Zaujemcovia: {attendanceCount}
            </span>
            {canAttend && (
              <button
                type="button"
                onClick={onToggleAttendance}
                disabled={attendanceBusy}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  attending
                    ? "border border-[color:rgba(255,107,0,0.24)] bg-[rgba(255,107,0,0.12)] text-[#f8fafc] hover:bg-[rgba(255,107,0,0.18)]"
                    : "border border-[color:rgba(255,107,0,0.3)] bg-[#ff6b00] text-white hover:bg-[#e85f00]"
                } disabled:opacity-60`}
              >
                {attendanceBusy ? "Ukladam..." : attending ? "Zucastnim sa" : "Pridem"}
              </button>
            )}
            {event.source_url && (
              <a
                href={event.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] hover:bg-[color:var(--bg-surface-hover)]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Zdroj podujatia
              </a>
            )}
          </div>
        </div>
      </div>

      {useIosBackNav && (
        <div className="border-t border-[color:var(--border-card)] bg-[color:var(--bg-surface)]/95 px-4 py-3 pb-safe md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
            aria-label="Späť"
          >
            <ArrowLeft className="h-4 w-4" />
            Späť
          </button>
        </div>
      )}
    </div>,
    document.body,
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
  const useIosBackNav = isIosDevice();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<EventCategory>("Samosprava");
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return toLocalDatetimeInput(d);
  });
  const [endsAt, setEndsAt] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim()) return;

    const startsIso = new Date(startsAt).toISOString();
    const endsIso = endsAt ? new Date(endsAt).toISOString() : null;

    if (endsIso && new Date(endsIso).getTime() <= new Date(startsIso).getTime()) {
      setErr("Koniec podujatia musi byt neskor ako zaciatok.");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      let imageUrl: string | null = null;
      if (photo) {
        imageUrl = await uploadEventImage(photo, userId);
      }

      const { error } = await supabase.from("events").insert({
        author_id: userId,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        type,
        starts_at: startsIso,
        ends_at: endsIso,
        end_date: toDatePart(endsIso),
        end_time: toTimePart(endsIso),
        source_url: null,
        image_url: imageUrl,
      });

      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }

      onCreated();
    } catch (error) {
      console.error("Nepodarilo sa ulozit udalost", error);
      setErr("Nepodarilo sa ulozit udalost. Skus to znova.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[160] flex h-[100dvh] w-full min-h-[100dvh] flex-col bg-[color:var(--bg-app)] pt-safe">
      <div className="app-toolbar flex items-center gap-3 border-b px-4 py-3">
        <button
          onClick={onClose}
          className={`header-action-button h-9 w-9 items-center justify-center rounded-full ${useIosBackNav ? "hidden md:flex" : "flex"}`}
          aria-label="Zavriet"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-semibold">Nova udalost</h2>
      </div>

      <form onSubmit={submit} className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 ${useIosBackNav ? "pb-24" : ""}`}>
        <div>
          <label className="text-sm font-medium text-[color:var(--text-secondary)]">Kategoria</label>
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
                      ? "btn-primary-glow border-primary"
                      : "app-surface-muted text-muted-foreground hover:bg-[color:var(--bg-surface-hover)]"
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
          <label className="text-sm font-medium text-[color:var(--text-secondary)]">Nazov</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="app-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[color:var(--text-secondary)]">Popis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="app-input mt-1 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[color:var(--text-secondary)]">Miesto</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            maxLength={200}
            className="app-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">Zaciatok</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="app-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">Koniec</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="app-surface-muted rounded-xl p-3">
          <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Fotografia</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setPhoto(file);
              setPhotoName(file?.name ?? null);
            }}
            className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-[color:var(--primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Obrazok sa pred uploadom automaticky komprimuje v prehliadaci.
          </p>
          {photoName && <p className="mt-1 text-[11px] font-medium text-[color:var(--text-secondary)]">{photoName}</p>}
        </div>

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {err}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ulozit udalost
          </button>
        </div>
      </form>

      {useIosBackNav && (
        <div className="border-t border-[color:var(--border-card)] bg-[color:var(--bg-surface)]/95 px-4 py-3 pb-safe md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
            aria-label="Späť"
          >
            <ArrowLeft className="h-4 w-4" />
            Späť
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
