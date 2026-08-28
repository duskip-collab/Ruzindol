import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  Megaphone,
  Loader2,
  Pin,
  Plus,
  RefreshCw,
  Trash2,
  X,
  CalendarDays,
  Rss,
  Recycle,
  Building2,
  Radio,
  Flame,
  Trophy,
  HeartHandshake,
  Church,
  Wrench,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cleanupExpiredAnnouncements, syncRssIfNeeded } from "@/lib/rss-sync";
import { isIosDevice } from "@/lib/pwa";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SharedCalendar } from "../components/SharedCalendar";
import { AktualityGroupsPanel } from "@/components/AktualityGroupsPanel";
import { DigitalnyRozhlas } from "@/components/RolePanels";

type Priority = "oznam" | "prioritne" | "urgentne" | "vystraha";
type Source = "rss" | "internal";
const RSS_ITEMS_LIMIT = 6;

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

const TILES = [
  { id: "calendar", label: "Zdieľaný kalendár", icon: <CalendarDays className="h-5 w-5" /> },
  { id: "rss", label: "RSS oznamy obce", icon: <Rss className="h-5 w-5" /> },
  { id: "odpad", label: "Kalendár zberu odpadu", icon: <Recycle className="h-5 w-5" /> },
  { id: "kontakty", label: "Stránkové dni & Kontakty OÚ", icon: <Building2 className="h-5 w-5" /> },
  { id: "rozhlas", label: "Digitálny rozhlas", icon: <Radio className="h-5 w-5" /> },
  { id: "dhz", label: "DHZ Ružindol", icon: <Flame className="h-5 w-5" /> },
  { id: "osk", label: "OŠK Ružindol", icon: <Trophy className="h-5 w-5" /> },
  { id: "seniori", label: "Dôchodcovia", icon: <HeartHandshake className="h-5 w-5" /> },
  { id: "farnost", label: "Farnosť", icon: <Church className="h-5 w-5" /> },
  { id: "sluzby", label: "Služby & Firmy", icon: <Wrench className="h-5 w-5" /> },
];

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
  const [activeTile, setActiveTile] = useState<string | null>(null);

  type OfficeInfo = {
    id: string;
    municipality_id: string | null;
    office_hours: string;
    address: string;
    phone: string;
    email: string;
    mayor: string;
  };
  const [officeInfo, setOfficeInfo] = useState<OfficeInfo | null>(null);
  const [editingKontakty, setEditingKontakty] = useState(false);
  const [editOfficeHours, setEditOfficeHours] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMayor, setEditMayor] = useState("");
  const [kontaktyBusy, setKontaktyBusy] = useState(false);
  const [kontaktyError, setKontaktyError] = useState<string | null>(null);

  const isAdmin = profile?.role === "Starosta" || profile?.role === "Uradnik";
  const useIosBackNav = isIosDevice();

  const load = useCallback(async () => {
    const [rssRes, internalRes, officeRes] = await Promise.all([
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
      supabase
        .from("municipality_office_info")
        .select("*")
        .maybeSingle(),
    ]);

    if (rssRes.error) console.warn("[RSS] Supabase načítanie zlyhalo, zobrazujem dostupné dáta.", rssRes.error);
    if (internalRes.error) console.error("Internal announcements load failed", internalRes.error);

    const rssItems = (rssRes.data as Announcement[] | null) ?? [];
    const internalItems = (internalRes.data as Announcement[] | null) ?? [];
    console.log("[RSS] Záznamov vrátených zo Supabase pre UI:", rssItems.length);
    if (rssRes.error) console.error("[RSS] Supabase chyba pri načítaní:", rssRes.error);

    const merged = [...rssItems, ...internalItems]
      .filter((item) => !isExpired(item))
      .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));

    setItems(merged);

    if (officeRes.data) {
      const data = officeRes.data as OfficeInfo;
      setOfficeInfo(data);
      setEditOfficeHours(data.office_hours);
      setEditAddress(data.address);
      setEditPhone(data.phone);
      setEditEmail(data.email);
      setEditMayor(data.mayor);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
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

  async function saveKontakty(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !userId) return;
    setKontaktyBusy(true);
    setKontaktyError(null);

    const payload = {
      office_hours: editOfficeHours,
      address: editAddress,
      phone: editPhone,
      email: editEmail,
      mayor: editMayor,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    let res;
    if (officeInfo?.id) {
      res = await supabase
        .from("municipality_office_info")
        .update(payload)
        .eq("id", officeInfo.id);
    } else {
      res = await supabase
        .from("municipality_office_info")
        .insert({
          ...payload,
          municipality_id: profile?.municipality_id ?? null,
        });
    }

    if (res.error) {
      setKontaktyError(res.error.message);
    } else {
      setEditingKontakty(false);
      await load();
    }
    setKontaktyBusy(false);
  }

  const pinOrder: Priority[] = ["vystraha", "urgentne"];
  const pinned = items
    .filter((i) => pinOrder.includes(i.priority))
    .sort(
      (a, b) =>
        pinOrder.indexOf(a.priority) - pinOrder.indexOf(b.priority) ||
        +new Date(b.published_at) - +new Date(a.published_at),
    );
  const rest = items.filter((i) => !pinOrder.includes(i.priority));
  const rssAnnouncements = items.filter((i) => i.source === "rss");
  const internalAnnouncements = items.filter((i) => i.source === "internal");

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
      <header className="app-toolbar flex items-center justify-between border-b px-4 py-3 backdrop-blur md:px-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">📰 Aktuality a oznamy</h1>
          <p className="text-[11px] text-muted-foreground">RSS z obce + oznamy úradu</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={forceSync}
            disabled={syncing}
            className="header-action-button flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40"
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
              className="btn-primary-glow flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Nový oznam
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 overscroll-y-contain md:px-6">
        {activeTile === null ? (
          <div className="flex flex-col gap-6 py-4">
            <div className="text-center md:text-left">
              <h2 className="text-lg font-bold text-foreground">Vyberte si sekciu</h2>
              <p className="text-xs text-muted-foreground">Kliknutím na dlaždicu otvoríte príslušný modul na celú stranu.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {TILES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTile(t.id)}
                  className="app-card flex flex-col items-center justify-center gap-3 rounded-2xl p-4 text-center transition hover:scale-[1.02] hover:bg-[color:var(--bg-surface-hover)] shadow-sm"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl app-surface-muted text-foreground shadow-sm">
                    {t.icon}
                  </span>
                  <span className="text-xs font-semibold leading-tight text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <button
                type="button"
                onClick={() => setActiveTile(null)}
                className="btn-primary-glow flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
                aria-label="Zatvoriť a späť na ponuku"
              >
                <ArrowLeft className="h-4 w-4" /> Zatvoriť / Späť na ponuku ikon
              </button>
              <span className="text-xs font-semibold text-primary">
                {TILES.find((t) => t.id === activeTile)?.label}
              </span>
            </div>

            <div className="flex-1 pb-8">
            {activeTile === "calendar" && <SharedCalendar />}
            {activeTile === "odpad" && <SharedCalendar categoryFilter="odpad" />}
            {activeTile === "rss" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Oficiálne oznamy a RSS obce</h2>
                  <span className="text-xs text-muted-foreground">{rssAnnouncements.length} oznamov</span>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-neutral-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : rssAnnouncements.length === 0 ? (
                  <p className="py-12 text-center text-xs text-neutral-500">Zatiaľ žiadne oznamy.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {rssAnnouncements
                      .filter((it) => pinOrder.includes(it.priority))
                      .map((it) => (
                      <AnnouncementCard
                        key={it.id}
                        item={it}
                        pinned
                        canDelete={isAdmin}
                        onDelete={() => handleDelete(it.id)}
                      />
                    ))}
                    {rssAnnouncements
                      .filter((it) => !pinOrder.includes(it.priority))
                      .map((it) => (
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
            )}
            {activeTile === "rozhlas" && (
              <div className="flex flex-col gap-5">
                <div className="app-card rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Radio className="h-4 w-4 text-primary" /> Digitálny rozhlas
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {internalAnnouncements.length} aktívnych hlásení
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="border-b pb-4 mb-4">
                      <DigitalnyRozhlas
                        userId={userId}
                        onPosted={() => {
                          setSyncing(true);
                          void load().finally(() => setSyncing(false));
                        }}
                      />
                    </div>
                  )}

                  {internalAnnouncements.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {internalAnnouncements.map((it) => (
                        <AnnouncementCard
                          key={it.id}
                          item={it}
                          canDelete={isAdmin}
                          onDelete={() => handleDelete(it.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
                      Aktuálne nie je k dispozícii
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTile === "kontakty" && (
              <div className="app-card rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" /> Stránkové dni & Kontakty OÚ Ružindol
                  </h2>
                  {isAdmin && !editingKontakty && (
                    <button
                      onClick={() => setEditingKontakty(true)}
                      className="btn-primary-glow px-3 py-1.5 text-xs font-semibold rounded-xl"
                    >
                      Upraviť kontakty
                    </button>
                  )}
                </div>

                {editingKontakty ? (
                  <form onSubmit={saveKontakty} className="space-y-4 pt-2">
                    {kontaktyError && (
                      <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                        {kontaktyError}
                      </div>
                    )}
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Úradné hodiny (každý deň na nový riadok)</span>
                      <textarea
                        value={editOfficeHours}
                        onChange={(e) => setEditOfficeHours(e.target.value)}
                        rows={5}
                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        required
                      />
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-medium text-muted-foreground">Adresa</span>
                        <input
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-muted-foreground">Telefón</span>
                        <input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-muted-foreground">E-mail</span>
                        <input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-muted-foreground">Starosta / Predstaviteľ</span>
                        <input
                          value={editMayor}
                          onChange={(e) => setEditMayor(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                          required
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={kontaktyBusy}
                        className="btn-primary-glow px-4 py-2 text-xs font-semibold rounded-xl disabled:opacity-50"
                      >
                        {kontaktyBusy ? "Ukladá sa..." : "Uložiť zmeny"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKontakty(false);
                          if (officeInfo) {
                            setEditOfficeHours(officeInfo.office_hours);
                            setEditAddress(officeInfo.address);
                            setEditPhone(officeInfo.phone);
                            setEditEmail(officeInfo.email);
                            setEditMayor(officeInfo.mayor);
                          }
                        }}
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                      >
                        Zrušiť
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="app-surface-muted p-4 rounded-2xl space-y-2">
                      <h3 className="font-semibold text-foreground">Úradné hodiny</h3>
                      {(officeInfo?.office_hours ?? "Pondelok: 8:00 - 12:00 | 12:30 - 15:30\nUtorok: nestránkový deň\nStreda: 8:00 - 12:00 | 12:30 - 17:00\nŠtvrtok: nestránkový deň\nPiatok: 8:00 - 13:00")
                        .split("\n")
                        .map((line, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground">{line}</p>
                        ))}
                    </div>
                    <div className="app-surface-muted p-4 rounded-2xl space-y-2">
                      <h3 className="font-semibold text-foreground">Kontaktné údaje</h3>
                      <p className="text-xs text-muted-foreground">Adresa: {officeInfo?.address ?? "Obecný úrad Ružindol, 919 61 Ružindol"}</p>
                      <p className="text-xs text-muted-foreground">Telefón: {officeInfo?.phone ?? "033 / 5511 223"}</p>
                      <p className="text-xs text-muted-foreground">E-mail: {officeInfo?.email ?? "ou@ruzindol.sk"}</p>
                      <p className="text-xs text-muted-foreground">Starosta: {officeInfo?.mayor ?? "PhDr. Starosta obce"}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTile === "dhz" && <AktualityGroupsPanel initialGroup="dhz" />}
            {activeTile === "osk" && <AktualityGroupsPanel initialGroup="osk_ruzindol" />}
            {activeTile === "seniori" && <AktualityGroupsPanel initialGroup="dochodcovia" />}
            {activeTile === "farnost" && <AktualityGroupsPanel initialGroup="farnost" />}
            {activeTile === "sluzby" && <AktualityGroupsPanel initialGroup="sluzby" />}
          </div>
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
  const isLegacyWebmOnIos =
    Boolean(item.audio_url) &&
    isIosDevice() &&
    (/\.webm(\?|$)/i.test(item.audio_url ?? "") || /format=webm/i.test(item.audio_url ?? ""));
  const meta = PRIORITY_META[item.priority];
  const emphasize = item.priority === "vystraha" || item.priority === "urgentne";

  return (
    <article
      className={`app-card relative rounded-2xl border-2 p-3 shadow-sm backdrop-blur ${
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

      <h3 className="mt-2 text-sm font-semibold text-foreground">{item.title}</h3>
      {item.source === "rss" ? (
        <div
          className="prose prose-sm mt-1 max-w-none text-xs leading-relaxed text-muted-foreground [&_a]:text-blue-400 [&_a]:underline [&_img]:my-2 [&_img]:rounded-lg"
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {item.content}
        </p>
      )}

      {item.audio_url && (
        <div className="app-surface-muted mt-2 rounded-2xl p-2">
          <audio controls preload="none" className="w-full" playsInline>
            <source src={item.audio_url} />
          </audio>
          {isLegacyWebmOnIos && (
            <p className="mt-1 text-[11px] text-amber-700">
              Staršia nahrávka WEBM môže mať na iPhone problém s prehratím. Pri nových nahrávkach už ukladáme iOS kompatibilný formát.
            </p>
          )}
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
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-[color:var(--bg-surface-hover)]"
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
  const useIosBackNav = isIosDevice();
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
      <div className="app-modal-surface flex h-full w-full flex-col pt-safe md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-[color:var(--border-card)] md:shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-card)] px-4 py-3">
          <button
            onClick={onClose}
            className={`h-9 w-9 items-center justify-center rounded-full hover:bg-[color:var(--bg-surface-hover)] ${useIosBackNav ? "hidden md:flex" : "flex"}`}
            aria-label="Zavrieť"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">📝 Nový oznam (admin)</h2>
        </div>

        <form onSubmit={submit} className={`flex flex-1 flex-col gap-4 overflow-y-auto p-5 ${useIosBackNav ? "pb-24" : ""}`}>
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
                        ? "border-primary btn-primary-glow text-primary-foreground"
                        : "app-surface-muted text-muted-foreground hover:bg-[color:var(--bg-surface-hover)]"
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
              className="app-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Obsah / Text</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              className="app-input mt-1 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Dátum publikovania</label>
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
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

        {useIosBackNav && (
          <div className="border-t border-neutral-200 bg-white/95 px-4 py-3 pb-safe dark:border-white/10 dark:bg-neutral-950/95 md:hidden">
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
              aria-label="Späť"
            >
              <ArrowLeft className="h-4 w-4" />
              Späť
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
