import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Camera,
  ShieldAlert,
  Ticket,
  Megaphone,
  Church,
  Trash2,
  Plus,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppMode } from "@/context/AppModeContext";
import { useCurrentUser, type ProfileRole } from "@/hooks/useCurrentUser";
import type { PostPriority } from "@/types";

type ReviewPost = {
  id: string;
  title: string;
  userName: string;
};

// =============================================================
// VIP Firma — Dashboard, business profile, mini-web builder
// =============================================================

export function VipDashboard({ postsCount, itemsCount }: { postsCount: number; itemsCount: number }) {
  const [ico, setIco] = useState("");
  const [dic, setDic] = useState("");
  const [companyName, setCompanyName] = useState("Pekáreň u Anny");
  const [description, setDescription] = useState(
    "Rodinná pekáreň, čerstvé pečivo každý deň od 6:00.",
  );
  const [contact, setContact] = useState("+421 900 000 000");
  const [photos, setPhotos] = useState<string[]>([]);

  const analytics = useMemo(
    () => ({
      visits: 128 + itemsCount * 7,
      leads: 12 + postsCount,
      shares: 5 + Math.floor(itemsCount / 2),
    }),
    [itemsCount, postsCount],
  );

  function addPhoto(file: File | null) {
    if (!file || photos.length >= 3) return;
    const url = URL.createObjectURL(file);
    setPhotos((p) => [...p, url]);
  }

  return (
    <section className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm dark:border-amber-500/20 dark:from-amber-500/10 dark:to-white/5">
      <PanelHeader
        icon={<Building2 className="h-4 w-4" />}
        title="VIP Dashboard"
        subtitle="Analytika, firemný profil a mini-web"
        tone="amber"
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Návštevy" value={analytics.visits} />
        <Stat label="Kontakty" value={analytics.leads} />
        <Stat label="Zdieľania" value={analytics.shares} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <TextField label="IČO" value={ico} onChange={setIco} placeholder="12345678" />
        <TextField label="DIČ" value={dic} onChange={setDic} placeholder="SK1234567890" />
      </div>

      <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Mini-Web
        </p>
        <TextField label="Názov" value={companyName} onChange={setCompanyName} />
        <label className="mt-3 block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Popis
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-100"
          />
        </label>
        <TextField label="Kontakt" value={contact} onChange={setContact} />

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Fotky ({photos.length}/3)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <label
                key={i}
                className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white/60 text-neutral-400 dark:border-white/15 dark:bg-white/5"
              >
                {photos[i] ? (
                  <img
                    src={photos[i]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => addPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================
// Panel Starostu — municipal metrics, moderation, batch invites
// =============================================================

export function PanelStarostu({
  posts,
  itemsCount,
  usersCount,
  onDeleted,
}: {
  posts: ReviewPost[];
  itemsCount: number;
  usersCount: number;
  onDeleted: () => void;
}) {
  const { generateInviteCode } = useAppMode();
  const [batch, setBatch] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  function generateBatch(n: number) {
    const codes: string[] = [];
    for (let i = 0; i < n; i++) {
      const res = generateInviteCode();
      if (res.ok) codes.push(res.code);
    }
    setBatch(codes);
  }

  function copy(c: string) {
    navigator.clipboard?.writeText(c).then(() => {
      setCopied(c);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  async function deletePost(id: string) {
    setDeletingPostId(id);
    await supabase.from("posts").delete().eq("id", id);
    setDeletingPostId(null);
    onDeleted();
  }

  return (
    <section className="rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm dark:border-blue-500/20 dark:from-blue-500/10 dark:to-white/5">
      <PanelHeader
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Panel Starostu"
        subtitle="Metriky obce, moderácia a pozvánky"
        tone="blue"
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Občania" value={usersCount} />
        <Stat label="Príspevky" value={posts.length} />
        <Stat label="Inzeráty" value={itemsCount} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Posledné príspevky ({posts.length})
        </p>
        {posts.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-500">Žiadne príspevky.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {posts.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-2 text-xs dark:border-white/10 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                    {p.title}
                  </p>
                  <p className="truncate text-neutral-500">{p.userName}</p>
                </div>
                <button
                  onClick={() => void deletePost(p.id)}
                  disabled={deletingPostId === p.id}
                  className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-60"
                >
                  {deletingPostId === p.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" /> Hromadné pozvánky
          </span>
        </p>
        <div className="mt-2 flex gap-1.5">
          {[5, 10, 25].map((n) => (
            <button
              key={n}
              onClick={() => generateBatch(n)}
              className="flex-1 rounded-xl bg-neutral-900 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
            >
              +{n}
            </button>
          ))}
        </div>
        {batch.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {batch.map((c) => (
              <li
                key={c}
                onClick={() => copy(c)}
                className="flex cursor-pointer items-center justify-between gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] dark:border-white/10 dark:bg-white/5"
              >
                <span className="truncate">{c}</span>
                {copied === c ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 text-neutral-400" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// =============================================================
// Digitalny Rozhlas — Uradnik alert composer
// =============================================================

const EXPIRY_OPTIONS: { label: string; hours: number }[] = [
  { label: "24 hodín", hours: 24 },
  { label: "3 dni", hours: 72 },
  { label: "5 dní", hours: 120 },
];

const PRIORITIES: { key: PostPriority; label: string; color: string }[] = [
  { key: "urgent", label: "Vysoká", color: "bg-rose-500 text-white" },
  { key: "high", label: "Stredná", color: "bg-amber-500 text-white" },
  { key: "normal", label: "Nízka", color: "bg-emerald-500 text-white" },
];

export function DigitalnyRozhlas({
  userId,
  onPosted,
}: {
  userId: string | null;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<PostPriority>("high");
  const [expiryH, setExpiryH] = useState(72);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !userId) return;

    setBusy(true);
    const safeExpiryH = Math.min(expiryH, 120);
    const expiresAtIso = new Date(Date.now() + safeExpiryH * 3600_000).toISOString();
    const expiry = new Date(expiresAtIso).toLocaleString("sk-SK");
    const finalContent = `${content.trim()}\n\nPlatnosť do: ${expiry}`;
    const category = priority === "urgent" ? "Výstraha" : "Hlasnik";

    const { error } = await supabase.from("posts").insert({
      user_id: userId,
      type: "hlasnik",
      category,
      title: title.trim(),
      content: finalContent,
      expires_at: expiresAtIso,
    });

    setBusy(false);
    if (error) return;

    setTitle("");
    setContent("");
    setSent(true);
    onPosted();
    setTimeout(() => setSent(false), 1500);
  }

  return (
    <section className="rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:to-white/5">
      <PanelHeader
        icon={<Megaphone className="h-4 w-4" />}
        title="Digitálny Rozhlas"
        subtitle="Úradník — vysielanie oznamov"
        tone="orange"
      />
      <form onSubmit={send} className="mt-4 space-y-3">
        <TextField label="Titulok" value={title} onChange={setTitle} />
        <label className="block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Obsah
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-100"
            required
          />
        </label>

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Priorita
          </p>
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPriority(p.key)}
                className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                  priority === p.key
                    ? p.color
                    : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Platnosť
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {EXPIRY_OPTIONS.map((o) => (
              <button
                key={o.hours}
                type="button"
                onClick={() => setExpiryH(o.hours)}
                className={`rounded-xl px-1 py-2 text-[11px] font-semibold ${
                  expiryH === o.hours
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !userId}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-orange-600 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sent ? (
            <Check className="h-4 w-4" />
          ) : (
            <Megaphone className="h-4 w-4" />
          )}
          {sent ? "Odoslané" : "Vysielať"}
        </button>
      </form>
    </section>
  );
}

// =============================================================
// Farsky Urad — Farar
// =============================================================

export function FarskyUrad({
  userId,
  municipalityId,
  onPosted,
}: {
  userId: string | null;
  municipalityId: string | null;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("Kostol sv. Martina");
  const [dt, setDt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600_000);
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !userId) return;

    setBusy(true);
    const startsAt = new Date(dt).toISOString();

    const postResult = await supabase.from("posts").insert({
      user_id: userId,
      type: "farsky_oznam",
      category: "Farský oznam",
      title: title.trim(),
      content: content.trim(),
    });

    if (!postResult.error) {
      await supabase.from("events").insert({
        author_id: userId,
        municipality_id: municipalityId,
        title: title.trim(),
        description: content.trim(),
        location,
        starts_at: startsAt,
        type: "Kostol",
      });
      onPosted();
    }

    setBusy(false);
    if (postResult.error) return;

    setOk(true);
    setTitle("");
    setContent("");
    setTimeout(() => setOk(false), 1500);
  }

  return (
    <section className="rounded-3xl border border-purple-200/60 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm dark:border-purple-500/20 dark:from-purple-500/10 dark:to-white/5">
      <PanelHeader
        icon={<Church className="h-4 w-4" />}
        title="Farský Úrad"
        subtitle="Farár — oznamy synchronizované s kalendárom"
        tone="purple"
      />
      <form onSubmit={submit} className="mt-4 space-y-3">
        <TextField label="Titulok" value={title} onChange={setTitle} />
        <label className="block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Obsah
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-100"
            required
          />
        </label>
        <TextField label="Miesto" value={location} onChange={setLocation} />
        <label className="block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Termín
          </span>
          <input
            type="datetime-local"
            value={dt}
            onChange={(e) => setDt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-100"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !userId}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-purple-600 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : ok ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {ok ? "Pridané do kalendára" : "Publikovať oznam"}
        </button>
      </form>
    </section>
  );
}

// =============================================================
// Role router — decides which panels to show for currentRole
// =============================================================

export function RolePanels({ role }: { role: ProfileRole }) {
  const { profile, userId } = useCurrentUser();
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);

  const loadStats = useCallback(async () => {
    const [postsRes, usersRes, itemsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, user_id, profiles(name)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("warehouse_items").select("id", { count: "exact", head: true }),
    ]);

    const mappedPosts: ReviewPost[] = ((postsRes.data as any[] | null) ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      userName: p.profiles?.name ?? "Sused",
    }));

    setPosts(mappedPosts);
    setUsersCount(usersRes.count ?? 0);
    setItemsCount(itemsRes.count ?? 0);
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <div className="flex flex-col gap-4">
      {role === "VIP_Firma" && <VipDashboard postsCount={posts.length} itemsCount={itemsCount} />}
      {role === "Starosta" && (
        <PanelStarostu
          posts={posts}
          itemsCount={itemsCount}
          usersCount={usersCount}
          onDeleted={() => {
            void loadStats();
          }}
        />
      )}
      {role === "Uradnik" && (
        <DigitalnyRozhlas
          userId={userId}
          onPosted={() => {
            void loadStats();
          }}
        />
      )}
      {role === "Farar" && (
        <FarskyUrad
          userId={userId}
          municipalityId={profile?.municipality_id ?? null}
          onPosted={() => {
            void loadStats();
          }}
        />
      )}
    </div>
  );
}

// ---------- Shared UI atoms ----------

function PanelHeader({
  icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "amber" | "blue" | "orange" | "purple";
}) {
  const toneMap: Record<string, string> = {
    amber: "bg-amber-500",
    blue: "bg-blue-600",
    orange: "bg-orange-500",
    purple: "bg-purple-600",
  };
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white ${toneMap[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          <BarChart3 className="h-3.5 w-3.5 opacity-50" /> {title}
        </p>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 p-3 text-center dark:border-white/10 dark:bg-white/5">
      <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-100"
      />
    </label>
  );
}
