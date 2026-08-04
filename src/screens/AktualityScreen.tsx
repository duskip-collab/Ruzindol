import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Megaphone,
  Loader2,
  Pin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncRssIfNeeded, cleanupExpiredAnnouncements } from "@/lib/rss-sync";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SharedCalendar } from "@/components/SharedCalendar";
import { AktualityGroupsPanel } from "@/components/AktualityGroupsPanel";
import { DigitalnyRozhlas } from "@/components/RolePanels";

type Priority = "oznam" | "prioritne" | "urgentne" | "vystraha";
type Source = "rss" | "internal";
const RSS_ITEMS_LIMIT = 8;

type Announcement = {
  id: string;
  source: Source;
  title: string;
  content: string;
  audio_url: string | null;
  expires_at: string | null;
  link: string | null;
  priority: Priority;
  published_at: string;
  author_id: string | null;
};

const PRIORITY_META: Record<Priority, { label: string; dot: string; ring: string; badge: string }> =
  {
    oznam: {
      label: "⚪ Oznam",
      dot: "bg-neutral-300",
      ring: "border-neutral-200",
      badge: "bg-neutral-100 text-neutral-700",
    },
    prioritne: {
      label: "🟡 Prioritné",
      dot: "bg-yellow-400",
      ring: "border-yellow-300",
      badge: "bg-yellow-100 text-yellow-800",
    },
    urgentne: {
      label: "🟠 Urgentné",
      dot: "bg-orange-500",
      ring: "border-orange-400",
      badge: "bg-orange-100 text-orange-800",
    },
    vystraha: {
      label: "🔴 Výstraha",
      dot: "bg-red-600",
      ring: "border-red-500",
      badge: "bg-red-100 text-red-800",
    },
  };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return `pred ${Math.floor(s / 86400)} dňami`;
}

function isExpired(item: Announcement) {
  if (!item.expires_at) return false;
  return new Date(item.expires_at).getTime() <= Date.now();
}

export function AktualityScreen() {
  const { profile, userId } = useCurrentUser();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRozhlas, setShowRozhlas] = useState(false);

  const isAdmin = profile?.role === "Starosta" || profile?.role === "Uradnik";
  const isUradnik = profile?.role === "Uradnik";

  const load = useCallback(async () => {
    const [rssRes, internalRes] = await Promise.all([
      supabase
        .from("announcements")
        .select("*")
        .eq("source", "rss")
        .order("published_at", { ascending: false })
        .limit(RSS_ITEMS_LIMIT),
      supabase
        .from("announcements")
        .select("*")
        .eq("source", "internal")
        .order("published_at", { ascending: false })
        .limit(120),
    ]);

    if (rssRes.error) console.error("RSS announcements load failed", rssRes.error);
    if (internalRes.error) console.error("Internal announcements load failed", internalRes.error);

    const rssItems = (rssRes.data as Announcement[] | null) ?? [];
    const internalItems = (internalRes.data as Announcement[] | null) ?? [];

    const merged = [...rssItems, ...internalItems]
      .filter((item) => !isExpired(item))
      .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));

    setItems(merged);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);

      // RSS sync beží na pozadí, aby sa obsah zobrazil okamžite.
      setSyncing(true);
      const result = await syncRssIfNeeded();
      if (result.synced) {
        await load();
      }
      setSyncing(false);
    })();
  }, [load]);

  async function forceSync() {
    setSyncing(true);
    await syncRssIfNeeded(true);
    await load();
    setSyncing(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Naozaj vymazať tento oznam?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // Pin výstraha + urgentné navrch, zvyšok chronologicky.
  const pinOrder: Priority[] = ["vystraha", "urgentne"];
  const pinned = items
    .filter((i) => pinOrder.includes(i.priority))
    .sort(
      (a, b) =>
        pinOrder.indexOf(a.priority) - pinOrder.indexOf(b.priority) ||
        +new Date(b.published_at) - +new Date(a.published_at),
    );
  const rest = items.filter((i) => !pinOrder.includes(i.priority));

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200/70 bg-white/70 px-4 py-3 backdrop-blur md:px-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">📰 Aktuality a oznamy</h1>
          <p className="text-[11px] text-muted-foreground">RSS z obce + oznamy úradu</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={forceSync}
            disabled={syncing}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
            title="Aktualizovať RSS"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800"
            >
              <Plus className="h-3.5 w-3.5" /> Nový oznam
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {isUradnik && (
          <div className="mb-4 rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:to-white/5">
            <button
              type="button"
              onClick={() => setShowRozhlas(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-orange-200/70 bg-white/80 px-4 py-3 text-left shadow-sm transition hover:border-orange-300 hover:bg-white dark:border-orange-500/20 dark:bg-white/5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm">
                <Megaphone className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Digitálny rozhlas
                </span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  Otvor hlásenie pre obecné oznamy a urgentné správy.
                </span>
              </span>
            </button>
          </div>
        )}

        <div className="mb-4">
          <AktualityGroupsPanel />
        </div>

        <div className="mb-4">
          <SharedCalendar />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-xs text-neutral-500">Zatiaľ žiadne oznamy.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {pinned.map((it) => (
              <AnnouncementCard
                key={it.id}
                item={it}
                pinned
                canDelete={isAdmin}
                onDelete={() => handleDelete(it.id)}
              />
            ))}
            {rest.map((it) => (
              <AnnouncementCard
                key={it.id}
                item={it}
                canDelete={isAdmin}
                onDelete={() => handleDelete(it.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && isAdmin && userId && (
        <AdminForm
          userId={userId}
          onClose={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            await cleanupExpiredAnnouncements();
            await load();
          }}
        />
      )}

      {showRozhlas && isUradnik && userId && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/35 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
          <div className="relative h-full w-full bg-white md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-neutral-200 md:shadow-2xl dark:bg-neutral-950 dark:md:border-white/15">
            <button
              type="button"
              onClick={() => setShowRozhlas(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
              aria-label="Zavrieť digitálny rozhlas"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="max-h-[92vh] overflow-y-auto p-4 md:p-5">
              <DigitalnyRozhlas
                userId={userId}
                onPosted={() => {
                  setSyncing(true);
                  void load().finally(() => setSyncing(false));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({
  item,
  pinned,
  canDelete,
  onDelete,
}: {
  item: Announcement;
  pinned?: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const meta = PRIORITY_META[item.priority];
  const emphasize = item.priority === "vystraha" || item.priority === "urgentne";
  return (
    <article
      className={`relative rounded-2xl border-2 bg-white/90 p-3 text-neutral-900 shadow-sm backdrop-blur dark:bg-white ${
        emphasize ? meta.ring : "border-neutral-200/70"
      } ${item.priority === "vystraha" ? "ring-2 ring-red-200" : ""}`}
    >
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} />
          <span className={`rounded-full px-2 py-0.5 font-semibold ${meta.badge}`}>
            {meta.label}
          </span>
          {item.source === "rss" && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
              RSS
            </span>
          )}
          {pinned && (
            <span className="flex items-center gap-0.5 text-[10px] text-neutral-500">
              <Pin className="h-2.5 w-2.5" /> pripnuté
            </span>
          )}
        </div>
        <span className="text-neutral-500">{timeAgo(item.published_at)}</span>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-neutral-900">{item.title}</h3>
      {item.source === "rss" ? (
        <div
          className="prose prose-sm mt-1 max-w-none text-xs leading-relaxed text-neutral-700 [&_a]:text-blue-600 [&_a]:underline [&_img]:my-2 [&_img]:rounded-lg"
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">
          {item.content}
        </p>
      )}

      {item.audio_url && (
        <div className="mt-2 rounded-2xl border border-neutral-200/70 bg-neutral-50 p-2 dark:bg-neutral-100">
          <audio controls preload="none" className="w-full">
            <source src={item.audio_url} />
          </audio>
        </div>
      )}

      {item.priority === "vystraha" && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-700">
          <AlertTriangle className="h-3 w-3" /> Kritické upozornenie
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
          >
            Zobraziť pôvodný oznam <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span />
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100"
          >
            <Trash2 className="h-3 w-3" /> Zmazať
          </button>
        )}
      </div>
    </article>
  );
}

function AdminForm({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("oznam");
  const [publishedAt, setPublishedAt] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from("announcements").insert({
      source: "internal",
      title: title.trim(),
      content: content.trim(),
      priority,
      published_at: new Date(publishedAt).toISOString(),
      author_id: userId,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/30 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="flex h-full w-full flex-col bg-white dark:bg-neutral-950 md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-neutral-200 md:shadow-2xl dark:md:border-white/15">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-white/10"
            aria-label="Zavrieť"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">📝 Nový oznam (admin)</h2>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Typ / Priorita</label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => {
                const m = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                      active
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-100"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                    {m.label}
                  </button>
                );
              })}
            </div>
            {priority === "vystraha" && (
              <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:bg-red-500/10 dark:text-red-200">
                ⚠️ Táto výstraha sa pri otvorení aplikácie zobrazí ako fullscreen upozornenie.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Názov príspevku</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Obsah / Text</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Dátum publikovania</label>
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900"
            />
            <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
              Interné oznamy sa automaticky mažú po 4 dňoch.
            </p>
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-md active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Zverejniť oznam
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
