import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarPlus,
  Church,
  Flame,
  BriefcaseBusiness,
  Loader2,
  Plus,
  Wrench,
  Trophy,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { retryAsync, withTimeout } from "@/lib/async-guard";
import { uploadCompressedImage } from "@/lib/upload-image";
import { ImageInput } from "@/components/ImageInput";
import type { CompressedImage } from "@/lib/compress-image";

type GroupKey = "osk_ruzindol" | "dochodcovia" | "dhz" | "farnost" | "sluzby";

type GroupAnnouncement = {
  id: string;
  group_key: GroupKey;
  author_id: string;
  title: string;
  content: string;
  image_url: string | null;
  linked_event_id: string | null;
  post_kind: "oznam" | "parte";
  deceased_name: string | null;
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
  is_active_neighbor?: boolean;
  municipality_id?: string | null;
  street?: string | null;
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

const MANUAL_ADMIN_GROUPS: GroupKey[] = ["osk_ruzindol", "dochodcovia", "dhz"];

function isManualAdminGroup(groupKey: GroupKey) {
  return MANUAL_ADMIN_GROUPS.includes(groupKey);
}

function hasAutomaticSectionAccess(role: string | null | undefined, groupKey: GroupKey) {
  return (
    (groupKey === "farnost" && role === "Farar") ||
    (groupKey === "sluzby" && role === "VIP_Firma")
  );
}

function getAutomaticAccessLabel(groupKey: GroupKey) {
  if (groupKey === "farnost") return "Automaticky: Farar";
  if (groupKey === "sluzby") return "Automaticky: VIP_Firma";
  return null;
}

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

function roleRank(role: string) {
  if (role === "Sused") return 0;
  if (role === "Starosta") return 1;
  if (role === "Uradnik") return 2;
  if (role === "Farar") return 3;
  if (role === "VIP_Firma") return 4;
  return 5;
}

function sortProfilesForAssignment(list: BasicProfile[]) {
  return [...list].sort((a, b) => {
    const byRole = roleRank(a.role) - roleRank(b.role);
    if (byRole !== 0) return byRole;
    return a.name.localeCompare(b.name, "sk", { sensitivity: "base" });
  });
}

export function AktualityGroupsPanel() {
  const { profile, userId, loading: userLoading } = useCurrentUser();
  const { isAdmin } = useIsAdmin(userId);

  const [active, setActive] = useState<GroupKey>("osk_ruzindol");
  const [openedGroup, setOpenedGroup] = useState<GroupKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<GroupAnnouncement[]>([]);
  const [admins, setAdmins] = useState<GroupAdmin[]>([]);
  const [people, setPeople] = useState<Record<string, BasicProfile>>({});
  const [assignableProfiles, setAssignableProfiles] = useState<BasicProfile[]>([]);
  const [vipProfiles, setVipProfiles] = useState<BasicProfile[]>([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canManageGroups = !!isAdmin || profile?.role === "Starosta";

  const activeAdmins = useMemo(
    () => admins.filter((a) => a.group_key === active),
    [admins, active],
  );

  const isGroupAdmin = useMemo(() => {
    if (!userId) return false;
    return activeAdmins.some((a) => a.user_id === userId);
  }, [activeAdmins, userId]);

  const canAssignAdmins = canManageGroups && isManualAdminGroup(active);
  const hasAutomaticAccess = hasAutomaticSectionAccess(profile?.role, active);
  const automaticAccessLabel = getAutomaticAccessLabel(active);
  const canUseDom = typeof document !== "undefined";

  const canCreateInGroup =
    canManageGroups ||
    isGroupAdmin ||
    hasAutomaticAccess;

  const loadData = useCallback(async () => {
    if (userLoading) return;
    if (!userId) {
      setPosts([]);
      setAdmins([]);
      setPeople({});
      setAssignableProfiles([]);
      setVipProfiles([]);
      setLoading(false);
      setLoadError("Pouzivatel nie je prihlaseny.");
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [postsRes, adminsRes, profilesRes] =
        await Promise.all([
          withTimeout(
            () =>
              retryAsync(
                () =>
                  supabase
                    .from("group_announcements")
                    .select(
                      "id, group_key, author_id, title, content, image_url, linked_event_id, post_kind, deceased_name, created_at, expires_at",
                    )
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
                () =>
                  supabase
                    .from("profiles")
                    .select("id, name, role, is_active_neighbor, municipality_id, street")
                    .order("name", { ascending: true }),
                { retries: 1, delayMs: 250 },
              ),
            7000,
            "Načítanie profilov trvalo príliš dlho.",
          ),
        ]);

      if (postsRes.error) throw postsRes.error;
      if (adminsRes.error) throw adminsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const postRows = postsRes.data;
      const adminRows = adminsRes.data;
      const profileRows = profilesRes.data;

      const postList = (postRows as GroupAnnouncement[] | null) ?? [];
      const adminList = (adminRows as GroupAdmin[] | null) ?? [];
      const profileList = (profileRows as BasicProfile[] | null) ?? [];

      setPosts(postList.filter((p) => new Date(p.expires_at).getTime() > Date.now()));
      setAdmins(adminList);

      const map: Record<string, BasicProfile> = {};
      for (const p of profileList) map[p.id] = p;
      setPeople(map);

      const visibleProfiles = profile?.municipality_id
        ? profileList.filter((p) => p.municipality_id === profile.municipality_id)
        : profileList;

      setAssignableProfiles(sortProfilesForAssignment(visibleProfiles.filter((p) => p.id !== userId)));
      setVipProfiles(profileList.filter((p) => p.role === "VIP_Firma"));
    } catch (e) {
      console.error("Failed to load group sections", e);
      if (e && typeof e === "object" && "message" in e) {
        setLoadError(String(e.message));
      } else {
        setLoadError("Nacitanie sekcii zlyhalo. Skus to znova.");
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.municipality_id, userId, userLoading]);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
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
  const activeManagerName =
    activeAdmins.length > 0
      ? (people[activeAdmins[0].user_id]?.name ?? "Sused")
      : null;

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

      {openedGroup && canUseDom && createPortal(
        <div className="fixed inset-0 z-[120] flex h-screen min-h-screen w-screen flex-col bg-white/95 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">{activeMeta.title}</p>
              <p className="text-[11px] text-neutral-600">{activeMeta.subtitle}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {canManageGroups && (
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Admin / Starosta
                  </span>
                )}
                {isGroupAdmin && isManualAdminGroup(active) && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Spravca sekcie
                  </span>
                )}
                {hasAutomaticAccess && automaticAccessLabel && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                    {automaticAccessLabel}
                  </span>
                )}
                {!canCreateInGroup && isManualAdminGroup(active) && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                    Pridava iba povereny sused
                  </span>
                )}
              </div>
              {!isManualAdminGroup(active) && (
                <p className="mt-1 text-[11px] text-neutral-500">
                  {active === "farnost"
                    ? "Pravo pridavat oznamy ma automaticky Farar."
                    : "Pravo pridavat oznamy maju automaticky profily s rolou VIP_Firma."}
                </p>
              )}
              {isManualAdminGroup(active) && (
                <p className="mt-1 text-[11px] text-neutral-500">
                  Admin alebo Starosta mozu poverit aktivneho suseda ako spravcu tejto sekcie.
                </p>
              )}
              {isManualAdminGroup(active) && (
                <p className="mt-1 text-[11px] font-medium text-neutral-700">
                  Aktuálny správca: {activeManagerName ?? "nepriradený"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {canAssignAdmins && (
                <button
                  type="button"
                  onClick={() => setShowAdmins((v) => !v)}
                  className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {showAdmins ? "Zavrieť" : activeManagerName ? "Zmeniť správcu" : "+ Pridať správcu"}
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
                      {p.post_kind === "parte" && (
                        <p className="mt-1 inline-flex rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Parte {p.deceased_name ? `· ${p.deceased_name}` : ""}
                        </p>
                      )}
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">
                        {p.content}
                      </p>
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="mt-2 w-full rounded-xl border border-neutral-200 object-cover"
                        />
                      )}
                      {p.linked_event_id && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          <CalendarPlus className="h-3 w-3" /> Zápis v kalendári
                        </p>
                      )}
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

            {active === "sluzby" && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
                  <BriefcaseBusiness className="h-3.5 w-3.5" /> VIP profily firiem
                </p>
                {vipProfiles.length === 0 ? (
                  <p className="text-xs text-amber-700/80">Zatiaľ nie sú dostupné VIP firmy.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {vipProfiles.map((vip) => (
                      <li
                        key={vip.id}
                        className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-white/80 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-neutral-800">{vip.name}</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          VIP Firma
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {showPostForm && userId && canUseDom && createPortal(
        <GroupPostForm
          groupKey={active}
          userId={userId}
          municipalityId={profile?.municipality_id ?? null}
          currentRole={profile?.role ?? null}
          groupTitle={activeMeta.title}
          onClose={() => setShowPostForm(false)}
          onCreated={async () => {
            setShowPostForm(false);
            await loadData();
          }}
        />,
        document.body,
      )}

      {showAdmins && canAssignAdmins && canUseDom && createPortal(
        <GroupAdminModal
          groupKey={active}
          admins={activeAdmins}
          people={people}
          profiles={assignableProfiles}
          onClose={() => setShowAdmins(false)}
          onChanged={async () => {
            await loadData();
          }}
        />,
        document.body,
      )}
    </>
  );
}

function GroupPostForm({
  groupKey,
  userId,
  municipalityId,
  currentRole,
  groupTitle,
  onClose,
  onCreated,
}: {
  groupKey: GroupKey;
  userId: string;
  municipalityId: string | null;
  currentRole: string | null;
  groupTitle: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<CompressedImage | null>(null);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [eventLocation, setEventLocation] = useState("");
  const [eventAt, setEventAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600_000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [isParte, setIsParte] = useState(false);
  const [deceasedName, setDeceasedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canCreateParte = groupKey === "farnost" && currentRole === "Farar";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const cleanDeceasedName = deceasedName.trim();
    if (!cleanContent) return;
    if (!isParte && !cleanTitle) return;
    if (isParte && !cleanDeceasedName) return;

    setSaving(true);
    setErr(null);
    try {
      let imageUrl: string | null = null;
      if (image) {
        imageUrl = await uploadCompressedImage(image, userId);
      }

      const computedTitle = isParte ? `Parte: ${cleanDeceasedName}` : cleanTitle;

      let linkedEventId: string | null = null;
      if (addToCalendar) {
        const eventType = groupKey === "farnost" ? "Kostol" : "Samosprava";
        const { data: createdEvent, error: eventError } = await supabase
          .from("events")
          .insert({
            author_id: userId,
            municipality_id: municipalityId,
            title: computedTitle,
            description: cleanContent,
            location: eventLocation.trim() || groupTitle,
            starts_at: new Date(eventAt).toISOString(),
            type: eventType,
          })
          .select("id")
          .single();

        if (eventError) {
          setErr(eventError.message);
          return;
        }

        linkedEventId = createdEvent.id;
      }

      const { error } = await withTimeout(
        () =>
          retryAsync(
            () =>
              supabase.from("group_announcements").insert({
                group_key: groupKey,
                author_id: userId,
                title: computedTitle,
                content: cleanContent,
                image_url: imageUrl,
                linked_event_id: linkedEventId,
                post_kind: isParte ? "parte" : "oznam",
                deceased_name: isParte ? cleanDeceasedName : null,
              }),
            { retries: 1, delayMs: 250 },
          ),
        7000,
        "Ukladanie príspevku trvalo príliš dlho.",
      );

      if (error) {
        console.error("Failed to insert group announcement", { groupKey, userId, error });
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
    <div className="fixed inset-0 z-[140] flex h-dvh flex-col bg-white">
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

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        {canCreateParte && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-2">
            <button
              type="button"
              onClick={() => setIsParte((v) => !v)}
              className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold text-violet-800"
            >
              {isParte ? "Režim: Parte" : "Prepnúť na Parte"}
            </button>
          </div>
        )}

        {isParte ? (
          <div>
            <label className="text-sm font-medium text-neutral-700">Meno zosnulého</label>
            <input
              value={deceasedName}
              onChange={(e) => setDeceasedName(e.target.value)}
              required
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
            />
          </div>
        ) : (
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
        )}

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

        <ImageInput
          value={image}
          onChange={setImage}
          label={isParte ? "Fotka zosnulého" : "Obrázok k oznamu"}
        />

        <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={addToCalendar}
            onChange={(e) => setAddToCalendar(e.target.checked)}
            className="h-4 w-4"
          />
          Pridať aj do kalendára
        </label>

        {addToCalendar && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
            <div>
              <label className="text-sm font-medium text-neutral-700">Miesto udalosti</label>
              <input
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder={groupTitle}
                maxLength={200}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Termín</label>
              <input
                type="datetime-local"
                value={eventAt}
                onChange={(e) => setEventAt(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
              />
            </div>
          </div>
        )}

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
  profiles,
  onClose,
  onChanged,
}: {
  groupKey: GroupKey;
  admins: GroupAdmin[];
  people: Record<string, BasicProfile>;
  profiles: BasicProfile[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const currentAdmin = admins[0] ?? null;
  const assignedIds = useMemo(
    () => new Set(currentAdmin ? [currentAdmin.user_id] : []),
    [currentAdmin],
  );
  const roleOptions = useMemo(
    () =>
      Array.from(new Set(profiles.map((p) => p.role))).sort(
        (a, b) => roleRank(a) - roleRank(b) || a.localeCompare(b, "sk", { sensitivity: "base" }),
      ),
    [profiles],
  );
  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (assignedIds.has(p.id)) return false;
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
    });
  }, [assignedIds, profiles, roleFilter, search]);

  async function addAdmin(targetUserId?: string) {
    const userIdToAssign = targetUserId ?? selectedUserId;
    if (!userIdToAssign) return;
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
              supabase.from("group_admins").upsert({
                group_key: groupKey,
                user_id: userIdToAssign,
                granted_by: authData.data.user?.id ?? null,
              }, { onConflict: "group_key" }),
            { retries: 1, delayMs: 250 },
          ),
        7000,
        "Pridanie správcu trvalo príliš dlho.",
      );

      if (error) {
        console.error("Failed to set group admin", { groupKey, userId: userIdToAssign, error });
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
    <div className="fixed inset-0 z-[300] flex h-screen min-h-screen w-screen max-w-none flex-col overflow-hidden bg-white">
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

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
          <p className="text-xs font-semibold text-neutral-700">Vyber registrovaného suseda pre túto sekciu</p>
          <p className="mt-1 text-[11px] text-neutral-500">
            Nový výber automaticky nahradí aktuálneho povereného suseda.
          </p>
          {currentAdmin && (
            <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
              <span className="font-semibold text-emerald-800">Aktuálny správca:</span>{" "}
              <span className="text-emerald-900">
                {people[currentAdmin.user_id]?.name ?? "Sused"}
              </span>{" "}
              <span className="text-emerald-700">
                ({people[currentAdmin.user_id]?.role ?? "neznáma rola"})
              </span>
            </div>
          )}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrovať meno suseda"
                className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-7 pr-2 text-sm"
              />
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">Rola: Všetky</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {options.length > 0 && (
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2">
              {options.slice(0, 40).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-2 py-1.5"
                >
                  <span className="min-w-0 truncate pr-2 text-xs text-neutral-700">
                    {u.name} ({u.role})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void addAdmin(u.id);
                    }}
                    disabled={busy}
                    className="rounded-lg bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    Vybrať
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Vyber používateľa</option>
              {options.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.role})
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
              {currentAdmin ? "Zmeniť" : "Pridať"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">Nájdení registrovaní susedia: {options.length}</p>
          <p className="mt-1 text-[11px] text-neutral-500">Poradie zoznamu: najprv rola Sused, potom ostatné roly.</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-neutral-700">Aktuálne poverený sused</p>
          {!currentAdmin ? (
            <p className="rounded-lg border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
              Zatiaľ nebol priradený žiadny sused pre túto sekciu.
            </p>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <div>
                <p className="text-sm font-medium text-neutral-800">
                  {people[currentAdmin.user_id]?.name ?? "Sused"}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Práva môžeš kedykoľvek zmeniť výberom iného suseda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void removeAdmin(currentAdmin.id);
                }}
                disabled={busy}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Odobrať
              </button>
            </div>
          )}
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
      </div>
    </div>
  );
}
