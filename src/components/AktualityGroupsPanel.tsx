import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Church,
  Flame,
  Loader2,
  Plus,
  Wrench,
  Trophy,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { retryAsync, withTimeout } from "@/lib/async-guard";

type GroupKey = "osk_ruzindol" | "dochodcovia" | "dhz" | "farnost" | "sluzby";

type GroupAnnouncement = {
  id: string;
  group_key: GroupKey;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  expires_at: string;
};

type GroupAdmin = {
  id: string;
  group_key: GroupKey;
  user_id: string;
  granted_by: string | null;
  created_at: string;
};

type BasicProfile = {
  id: string;
  name: string;
  role: string;
};

const GROUPS: {
  key: GroupKey;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  ring: string;
  bg: string;
}[] = [
  {
    key: "osk_ruzindol",
    title: "OŠK Ružindol",
    subtitle: "Futbalový klub obce",
    icon: <Trophy className="h-4 w-4" />,
    ring: "ring-blue-200 border-blue-300",
    bg: "from-blue-50 to-cyan-50",
  },
  {
    key: "dochodcovia",
    title: "Dôchodcovia",
    subtitle: "Klub dôchodcov a aktivity",
    icon: <Users className="h-4 w-4" />,
    ring: "ring-emerald-200 border-emerald-300",
    bg: "from-emerald-50 to-lime-50",
  },
  {
    key: "dhz",
    title: "DHZ",
    subtitle: "Dobrovoľní hasiči",
    icon: <Flame className="h-4 w-4" />,
    ring: "ring-rose-200 border-rose-300",
    bg: "from-rose-50 to-orange-50",
  },
  {
    key: "farnost",
    title: "Farnosť",
    subtitle: "Oznamy a farské informácie",
    icon: <Church className="h-4 w-4" />,
    ring: "ring-violet-200 border-violet-300",
    bg: "from-violet-50 to-fuchsia-50",
  },
  {
    key: "sluzby",
    title: "Služby",
    subtitle: "Remeslá a obecné služby",
    icon: <Wrench className="h-4 w-4" />,
    ring: "ring-amber-200 border-amber-300",
    bg: "from-amber-50 to-yellow-50",
  },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return `pred ${Math.floor(s / 86400)} dňami`;
}

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AktualityGroupsPanel() {
  const { profile, userId } = useCurrentUser();
  const { isAdmin } = useIsAdmin(userId);

  const [active, setActive] = useState<GroupKey>("osk_ruzindol");
  const [openedGroup, setOpenedGroup] = useState<GroupKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<GroupAnnouncement[]>([]);
  const [admins, setAdmins] = useState<GroupAdmin[]>([]);
  const [people, setPeople] = useState<Record<string, BasicProfile>>({});
  const [neighbors, setNeighbors] = useState<BasicProfile[]>([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canManageGroups =
    !!isAdmin || profile?.role === "Starosta" || profile?.role === "Uradnik";

  const activeAdmins = useMemo(
    () => admins.filter((a) => a.group_key === active),
    [admins, active],
  );

  const isGroupAdmin = useMemo(() => {
    if (!userId) return false;
    return activeAdmins.some((a) => a.user_id === userId);
  }, [activeAdmins, userId]);

  const canCreateInGroup = canManageGroups || isGroupAdmin;

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [{ data: postRows }, { data: adminRows }, { data: profileRows }] =
        await Promise.all([
          withTimeout(
            () =>
              retryAsync(
                () =>
                  supabase
                    .from("group_announcements")
                    .select("id, group_key, author_id, title, content, created_at, expires_at")
                    .order("created_at", { ascending: false })
                    .limit(200),
                { retries: 1, delayMs: 250 },
              ),
            7000,
            "Načítanie skupinových oznamov trvalo príliš dlho.",
          ),
          withTimeout(
            () =>
              retryAsync(
                () =>
                  supabase
                    .from("group_admins")
                    .select("id, group_key, user_id, granted_by, created_at")
                    .order("created_at", { ascending: false }),
                { retries: 1, delayMs: 250 },
              ),
            7000,
            "Načítanie správcov skupín trvalo príliš dlho.",
          ),
          withTimeout(
            () =>
              retryAsync(
                () => supabase.from("profiles").select("id, name, role").order("name", { ascending: true }),
                { retries: 1, delayMs: 250 },
              ),
            7000,
            "Načítanie profilov trvalo príliš dlho.",
          ),
        ]);

      const postList = (postRows as GroupAnnouncement[] | null) ?? [];
      const adminList = (adminRows as GroupAdmin[] | null) ?? [];
      const profileList = (profileRows as BasicProfile[] | null) ?? [];

      setPosts(postList.filter((p) => new Date(p.expires_at).getTime() > Date.now()));
      setAdmins(adminList);

      const map: Record<string, BasicProfile> = {};
      for (const p of profileList) map[p.id] = p;
      setPeople(map);

      setNeighbors(profileList.filter((p) => p.role === "Sused"));
    } catch (e) {
      console.error("Failed to load group sections", e);
      setLoadError("Načítanie sekcií trvá príliš dlho. Skús to znova.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("aktuality-groups-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_announcements" },
        () => {
          void loadData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_admins" },
        () => {
          void loadData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  async function deletePost(id: string) {
    if (!confirm("Naozaj vymazať tento príspevok?")) return;
    try {
      await withTimeout(
        () =>
          retryAsync(
            () => supabase.from("group_announcements").delete().eq("id", id),
            { retries: 1, delayMs: 250 },
          ).then(() => undefined),
        7000,
        "Mazanie príspevku trvalo príliš dlho.",
      );
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error("Failed to delete group post", e);
      setLoadError("Mazanie príspevku sa nepodarilo. Skús to znova.");
    }
  }

  function openGroup(groupKey: GroupKey) {
    setActive(groupKey);
    setOpenedGroup(groupKey);
  }

  function closeGroup() {
    setOpenedGroup(null);
    setShowPostForm(false);
    setShowAdmins(false);
  }

  const activeMeta = GROUPS.find((g) => g.key === active)!;
  const visiblePosts = posts.filter((p) => p.group_key === active);

  return (
    <>
      <section className="rounded-3xl border border-neutral-200/70 bg-white/80 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {GROUPS.map((g) => {
            const isActive = g.key === active && openedGroup !== null;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => openGroup(g.key)}
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition ${
                  isActive
                    ? `bg-gradient-to-br ${g.bg} ${g.ring} ring-2`
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
                title={g.title}
                aria-label={g.title}
              >
                {g.icon}
              </button>
            );
          })}
        </div>
      </section>

      {openedGroup && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-white/95 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">{activeMeta.title}</p>
              <p className="text-[11px] text-neutral-600">{activeMeta.subtitle}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {canManageGroups && (
                <button
                  type="button"
                  onClick={() => setShowAdmins(true)}
                  className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Správcovia
                </button>
              )}
              {canCreateInGroup && (
                <button
                  type="button"
                  onClick={() => setShowPostForm(true)}
                  className="flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800"
                >
                  <Plus className="h-3.5 w-3.5" /> Pridať oznam
                </button>
              )}
              <button
                type="button"
                onClick={closeGroup}
                className="grid h-8 w-8 place-items-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                aria-label="Zavrieť sekciu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loadError && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                {loadError}
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-6 text-neutral-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : visiblePosts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 py-5 text-center text-xs text-neutral-500">
                V tejto sekcii zatiaľ nie sú žiadne oznamy.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visiblePosts.map((p) => {
                  const canDelete = canManageGroups || p.author_id === userId;
                  return (
                    <article
                      key={p.id}
                      className="rounded-2xl border border-neutral-200/80 bg-white/90 p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-[10px] text-neutral-500">
                        <span>{timeAgo(p.created_at)}</span>
                        <span>platné do {formatExpiry(p.expires_at)}</span>
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-neutral-900">{p.title}</h4>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">
                        {p.content}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-500">
                          Autor: {people[p.author_id]?.name ?? "Používateľ"}
                        </span>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              void deletePost(p.id);
                            }}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100"
                          >
                            <Trash2 className="h-3 w-3" /> Zmazať
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showPostForm && userId && (
        <GroupPostForm
          groupKey={active}
          userId={userId}
          onClose={() => setShowPostForm(false)}
          onCreated={async () => {
            setShowPostForm(false);
            await loadData();
          }}
        />
      )}

      {showAdmins && canManageGroups && (
        <GroupAdminModal
          groupKey={active}
          admins={activeAdmins}
          people={people}
          neighbors={neighbors}
          onClose={() => setShowAdmins(false)}
          onChanged={async () => {
            await loadData();
          }}
        />
      )}
    </>
  );
}

function GroupPostForm({
  groupKey,
  userId,
  onClose,
  onCreated,
}: {
  groupKey: GroupKey;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await withTimeout(
        () =>
          retryAsync(
            () =>
              supabase.from("group_announcements").insert({
                group_key: groupKey,
                author_id: userId,
                title: title.trim(),
                content: content.trim(),
              }),
            { retries: 1, delayMs: 250 },
          ),
        7000,
        "Ukladanie príspevku trvalo príliš dlho.",
      );

      if (error) {
        setErr(error.message);
        return;
      }
      onCreated();
    } catch (e) {
      console.error("Failed to create group post", e);
      setErr("Nepodarilo sa uložiť príspevok. Skús to znova.");
    } finally {
      setSaving(false);
    }
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
        <h2 className="font-semibold">Nový oznam sekcie</h2>
      </div>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
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
          <label className="text-sm font-medium text-neutral-700">Obsah</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={6}
            className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
          <p className="mt-1 text-[10px] text-neutral-500">
            Príspevok bude automaticky zmazaný po 4 dňoch.
          </p>
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

        <div className="mt-auto pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Zverejniť oznam
          </button>
        </div>
      </form>
    </div>
  );
}

function GroupAdminModal({
  groupKey,
  admins,
  people,
  neighbors,
  onClose,
  onChanged,
}: {
  groupKey: GroupKey;
  admins: GroupAdmin[];
  people: Record<string, BasicProfile>;
  neighbors: BasicProfile[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const assignedIds = useMemo(() => new Set(admins.map((a) => a.user_id)), [admins]);
  const options = neighbors.filter((n) => !assignedIds.has(n.id));

  async function addAdmin() {
    if (!selectedUserId) return;
    setBusy(true);
    setErr(null);
    try {
      const authData = await withTimeout(
        () => retryAsync(() => supabase.auth.getUser(), { retries: 1, delayMs: 250 }),
        7000,
        "Načítanie používateľa trvalo príliš dlho.",
      );

      const { error } = await withTimeout(
        () =>
          retryAsync(
            () =>
              supabase.from("group_admins").insert({
                group_key: groupKey,
                user_id: selectedUserId,
                granted_by: authData.data.user?.id ?? null,
              }),
            { retries: 1, delayMs: 250 },
          ),
        7000,
        "Pridanie správcu trvalo príliš dlho.",
      );

      if (error) {
        setErr(error.message);
        return;
      }
      setSelectedUserId("");
      await onChanged();
    } catch (e) {
      console.error("Failed to add group admin", e);
      setErr("Pridanie správcu sa nepodarilo. Skús to znova.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(id: string) {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await withTimeout(
        () =>
          retryAsync(
            () => supabase.from("group_admins").delete().eq("id", id),
            { retries: 1, delayMs: 250 },
          ),
        7000,
        "Odobratie správcu trvalo príliš dlho.",
      );

      if (error) {
        setErr(error.message);
        return;
      }
      await onChanged();
    } catch (e) {
      console.error("Failed to remove group admin", e);
      setErr("Odobratie správcu sa nepodarilo. Skús to znova.");
    } finally {
      setBusy(false);
    }
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
        <h2 className="font-semibold">Správcovia sekcie</h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
          <p className="text-xs font-semibold text-neutral-700">Pridať suseda ako správcu</p>
          <div className="mt-2 flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Vyber suseda</option>
              {options.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void addAdmin();
              }}
              disabled={busy || !selectedUserId}
              className="rounded-xl bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Pridať
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-neutral-700">Aktuálni správcovia</p>
          {admins.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
              Zatiaľ nebol priradený žiadny správca.
            </p>
          ) : (
            <ul className="space-y-2">
              {admins.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2"
                >
                  <span className="text-sm text-neutral-800">
                    {people[a.user_id]?.name ?? "Sused"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void removeAdmin(a.id);
                    }}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" /> Odobrať
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
      </div>
    </div>
  );
}
