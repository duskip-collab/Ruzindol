import { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapPin,
  Shield,
  Package,
  Loader2,
  Copy,
  Check,
  Share2,
  Plus,
  Lock,
  BellOff,
  Sun,
  Moon,
  LogOut,
  Trash2,
  Save,
  Bell,
  UserCog,
  RefreshCw,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, type ProfileRole } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { BanBanner } from "@/components/BanBanner";
import { ActiveNeighborBadge } from "@/components/ActiveNeighborBadge";
import { LegalInfoPanel } from "@/components/LegalDocuments";
import { useTheme } from "@/context/ThemeContext";
import { FONT_SCALE_OPTIONS, useFontScale } from "@/context/FontScaleContext";
import { useNotifications, NOTIF_CATEGORIES } from "@/context/NotificationContext";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { removeBucketObject } from "@/lib/storage";
import { formatWarehouseExpiry, getWarehouseLifetimeLabel, resolveWarehouseExpiry, type WarehouseItemType } from "@/lib/warehouse";
import { syncPushSubscriptionSilently } from "@/lib/push";

type Item = {
  id: string;
  type: string;
  title: string;
  price: number;
  created_at: string;
  expires_at: string | null;
  image_path: string | null;
};

type InviteCodeRow = {
  id: string;
  code: string;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
  shared_at?: string | null;
  shared_via?: string | null;
};

const RolePanels = lazy(async () => {
  const module = await import("@/components/RolePanels");
  return { default: module.RolePanels };
});

const NeighborhoodPulse = lazy(async () => {
  const module = await import("@/components/NeighborhoodPulse");
  return { default: module.NeighborhoodPulse };
});

const AdminPanel = lazy(async () => {
  const module = await import("@/components/AdminPanel");
  return { default: module.AdminPanel };
});

const ModerationPanel = lazy(async () => {
  const module = await import("@/components/ModerationPanel");
  return { default: module.ModerationPanel };
});

const InviteRedeemSection = lazy(async () => {
  const module = await import("@/components/InviteRedeemSection");
  return { default: module.InviteRedeemSection };
});

const AktualityGroupsPanel = lazy(async () => {
  const module = await import("@/components/AktualityGroupsPanel");
  return { default: module.AktualityGroupsPanel };
});

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return `pred ${Math.floor(s / 86400)} dňami`;
}

const CATEGORY_LABEL: Record<string, string> = {
  trh: "Trh",
  darovanie: "Darovanie",
  sklad_ponuka: "Náradie",
  sklad_dopyt: "Dopyt",
};

export function ProfilScreen() {
  const { profile, userId, loading, refresh } = useCurrentUser();
  const { isAdmin } = useIsAdmin(userId);

  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  async function loadItems(uid: string) {
    setItemsLoading(true);
    const { data } = await supabase
      .from("warehouse_items")
      .select("id, type, title, price, created_at, expires_at, image_path")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setItems((data as Item[] | null) ?? []);
    setItemsLoading(false);
  }

  useEffect(() => {
    if (!userId) return;
    const id = window.setTimeout(() => {
      void loadItems(userId);
    }, 0);
    return () => window.clearTimeout(id);
  }, [userId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  async function deleteItem(id: string) {
    if (!confirm("Naozaj vymazať tento inzerát?")) return;
    const item = items.find((entry) => entry.id === id);
    setBusyItemId(id);
    if (item?.image_path) {
      try {
        await removeBucketObject("warehouse", item.image_path);
      } catch (error) {
        console.error("Nepodarilo sa zmazať fotku inzerátu zo Storage:", error);
      }
    }
    const { error } = await supabase.from("warehouse_items").delete().eq("id", id);
    setBusyItemId(null);
    if (error) {
      alert("Nepodarilo sa vymazať: " + error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function reactivateItem(id: string) {
    setBusyItemId(id);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("warehouse_items")
      .update({ created_at: nowIso })
      .eq("id", id);
    setBusyItemId(null);
    if (error) {
      alert("Nepodarilo sa predĺžiť platnosť: " + error.message);
      return;
    }
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, created_at: nowIso } : i))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-neutral-700">Profil sa nepodarilo načítať.</p>
        <p className="text-xs text-neutral-500">Skús obnoviť stránku alebo sa znova prihlásiť.</p>
      </div>
    );
  }

  const isStarosta = profile.role === "Starosta";
  const canInviteNeighbors =
    isAdmin ||
    profile.role === "Starosta" ||
    (profile.role === "Sused" && profile.is_active_neighbor && Boolean(profile.invite_code));
  const inviteLimit = isAdmin || profile.role === "Starosta" ? 50 : 3;
  const isWideAdminSection =
    openSection === "admin" || openSection === "moderation" || openSection === "aktuality-admin";

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4 px-4 py-5 md:px-6">
      <div
        className={`grid min-h-0 flex-1 gap-4 ${isWideAdminSection ? "xl:grid-cols-1" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}
      >
        <div
          className={`flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start ${isWideAdminSection ? "xl:hidden" : ""}`}
        >
          {/* Header card — always visible */}
          <div className="rounded-3xl border border-border bg-card/95 p-5 text-card-foreground shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-600 text-xl font-semibold text-white">
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {profile.name}
                </h2>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{profile.street || "—"}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      isStarosta
                        ? "bg-amber-100 text-amber-800"
                        : "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-200"
                    }`}
                  >
                    <Shield className="h-3 w-3" />
                    {profile.role}
                  </span>
                  {profile.is_active_neighbor && <ActiveNeighborBadge />}
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ban status */}
          <BanBanner profile={profile} />
        </div>

        {/* Collapsible sections — iba jedna otvorená naraz */}
        <Accordion
          type="single"
          collapsible
          value={openSection}
          onValueChange={setOpenSection}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-24 pr-1 md:pb-28 xl:pb-4"
        >
          {(isAdmin || profile.role === "Starosta") && (
            <AccordionSection
              value="admin"
              title="Admin panel"
              isActive={openSection === "admin"}
              onClose={() => setOpenSection("")}
              itemClassName={isWideAdminSection ? "xl:rounded-[2rem]" : undefined}
              contentClassName={isWideAdminSection ? "px-3 py-3 md:px-4" : undefined}
            >
              {openSection === "admin" && (
                <Suspense fallback={<SectionLoader />}>
                  <AdminPanel adminId={profile.id} isSuperAdmin={isAdmin} />
                </Suspense>
              )}
            </AccordionSection>
          )}

          {(isAdmin || profile.role === "Starosta") && (
            <AccordionSection
              value="moderation"
              title="Moderácia"
              isActive={openSection === "moderation"}
              onClose={() => setOpenSection("")}
              itemClassName={isWideAdminSection ? "xl:rounded-[2rem]" : undefined}
              contentClassName={isWideAdminSection ? "px-3 py-3 md:px-4" : undefined}
            >
              {openSection === "moderation" && (
                <Suspense fallback={<SectionLoader />}>
                  <ModerationPanel currentUserId={profile.id} />
                </Suspense>
              )}
            </AccordionSection>
          )}

          {(isAdmin || profile.role === "Starosta") && (
            <AccordionSection
              value="aktuality-admin"
              title="Administrácia aktualít sekcií"
              isActive={openSection === "aktuality-admin"}
              onClose={() => setOpenSection("")}
              itemClassName={isWideAdminSection ? "xl:rounded-[2rem]" : undefined}
              contentClassName={isWideAdminSection ? "px-3 py-3 md:px-4" : undefined}
            >
              {openSection === "aktuality-admin" && (
                <Suspense fallback={<SectionLoader />}>
                  <AktualityGroupsPanel />
                </Suspense>
              )}
            </AccordionSection>
          )}

          <AccordionSection
            value="edit"
            title="Úprava profilu"
            isActive={openSection === "edit"}
            onClose={() => setOpenSection("")}
          >
            <ProfileEditForm
              initialName={profile.name}
              initialStreet={profile.street ?? ""}
              userId={profile.id}
              onSaved={refresh}
            />
          </AccordionSection>

          <AccordionSection
            value="settings"
            title="Vzhľad & notifikácie"
            isActive={openSection === "settings"}
            onClose={() => setOpenSection("")}
          >
            <div className="flex flex-col gap-3">
              <NotificationSettings userId={profile.id} />
              <LegalInfoPanel />
            </div>
          </AccordionSection>

          {isAdmin && (
            <AccordionSection
              value="role"
              title="Prepnúť moju rolu (admin)"
              isActive={openSection === "role"}
              onClose={() => setOpenSection("")}
            >
              <RoleSwitcher role={profile.role} onChange={refresh} userId={profile.id} />
            </AccordionSection>
          )}

          <AccordionSection
            value="panels"
            title="Panely rolí"
            isActive={openSection === "panels"}
            onClose={() => setOpenSection("")}
          >
            {openSection === "panels" && (
              <Suspense fallback={<SectionLoader />}>
                <div className="flex flex-col gap-3">
                  <RolePanels role={profile.role} />
                  <NeighborhoodPulse />
                </div>
              </Suspense>
            )}
          </AccordionSection>

          {!profile.is_active_neighbor && (
            <AccordionSection
              value="activate"
              title="🔑 Máš invite kód od suseda?"
              isActive={openSection === "activate"}
              onClose={() => setOpenSection("")}
            >
              {openSection === "activate" && (
                <Suspense fallback={<SectionLoader />}>
                  <InviteRedeemSection onActivated={refresh} />
                </Suspense>
              )}
            </AccordionSection>
          )}

          <AccordionSection
            value="invite-neighbor"
            title="Pozvať suseda"
            isActive={openSection === "invite-neighbor"}
            onClose={() => setOpenSection("")}
          >
            <NeighborInviteSection userId={profile.id} canUse={canInviteNeighbors} maxCodes={inviteLimit} />
          </AccordionSection>

          <AccordionSection
            value="items"
            title={`Moje inzeráty (${items.length})`}
            isActive={openSection === "items"}
            onClose={() => setOpenSection("")}
          >
            {itemsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-6 text-center text-sm text-neutral-500 dark:border-white/15 dark:bg-white/5">
                Zatiaľ ste nepridali žiadny inzerát.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => {
                  const expiryDate = resolveWarehouseExpiry(
                    item.type as WarehouseItemType,
                    item.created_at,
                    item.expires_at,
                  );
                  const isExpired = expiryDate.getTime() <= nowMs;
                  const busy = busyItemId === item.id;
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 rounded-2xl border border-neutral-200/60 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/10">
                          <Package className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 dark:bg-white/10">
                              {CATEGORY_LABEL[item.type] ?? item.type}
                            </span>
                            <span>{timeAgo(item.created_at)}</span>
                            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 dark:bg-white/10">
                              Platnosť {getWarehouseLifetimeLabel(item.type as WarehouseItemType)}
                            </span>
                            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 dark:bg-white/10">
                              Do {formatWarehouseExpiry(item.type as WarehouseItemType, item.created_at, item.expires_at)}
                            </span>
                            {isExpired && (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                Expirovaný
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                          {item.price > 0 ? `${item.price} €` : "Zadarmo"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isExpired && (
                          <button
                            onClick={() => void reactivateItem(item.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Zaktivovať
                          </button>
                        )}
                        <button
                          onClick={() => void deleteItem(item.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-transparent"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Vymazať
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </AccordionSection>

          <AccordionSection
            value="account"
            title="Účet & odhlásenie"
            isActive={openSection === "account"}
            onClose={() => setOpenSection("")}
          >
            <AccountActions userId={profile.id} />
          </AccordionSection>
        </Accordion>
      </div>
    </div>
  );
}

function SectionLoader() {
  return (
    <div className="flex justify-center py-6 text-neutral-400">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

function AccordionSection({
  value,
  title,
  isActive,
  onClose,
  itemClassName,
  contentClassName,
  children,
}: {
  value: string;
  title: string;
  isActive: boolean;
  onClose: () => void;
  itemClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const canUseDom = typeof document !== "undefined";

  return (
    <>
      <AccordionItem
        value={value}
        className={`flex flex-col overflow-hidden rounded-3xl border border-border/90 bg-card text-card-foreground shadow-sm backdrop-blur-xl ${itemClassName ?? ""}`}
      >
        <AccordionTrigger className="px-5 py-4 text-base leading-6 text-neutral-900 dark:text-neutral-100">
          {title}
        </AccordionTrigger>
      </AccordionItem>

      {canUseDom &&
        createPortal(
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="fixed inset-0 z-[160] flex h-[100dvh] w-screen flex-col bg-white/95 backdrop-blur-xl dark:bg-neutral-950/95"
                role="dialog"
                aria-modal="true"
              >
                <div className="pt-safe flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
                  <h3 className="truncate text-base font-semibold text-foreground md:text-lg">{title}</h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20"
                    aria-label="Zavrieť panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-8 md:px-6 md:pb-10 ${contentClassName ?? ""}`}>
                  {children}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function ProfileEditForm({
  initialName,
  initialStreet,
  userId,
  onSaved,
}: {
  initialName: string;
  initialStreet: string;
  userId: string;
  onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState(initialName);
  const [street, setStreet] = useState(initialStreet);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = name.trim() !== initialName.trim() || street.trim() !== initialStreet.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setErr(null);
    setOk(false);

    const payload = {
      name: name.trim(),
      street: street.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }

    setOk(true);
    setTimeout(() => setOk(false), 1500);
    await onSaved();
  }

  return (
    <form
      onSubmit={(e) => {
        void save(e);
      }}
      className="rounded-3xl border border-border bg-card/95 p-5 text-card-foreground shadow-sm backdrop-blur-xl"
    >
      <h3 className="text-sm font-semibold text-foreground">Úprava profilu</h3>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Meno</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            required
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Ulica</span>
          <input
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Napr. Hlavná 12"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </label>
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <button
        type="submit"
        disabled={!dirty || saving}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : ok ? (
          <Check className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {ok ? "Uložené" : "Uložiť zmeny"}
      </button>
    </form>
  );
}

// ---------- Notification settings ----------

function NotificationSettings({ userId }: { userId: string }) {
  const { theme, setTheme } = useTheme();
  const { muted, setMuted, categories, setCategory } = useNotifications();
  const { fontScale, setFontScale, fontSizePx } = useFontScale();
  const darkMode = theme === "dark";
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushSaving, setPushSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await (supabase as any)
        .from("user_settings")
        .select("notifications_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Chyba pri načítaní user_settings.notifications_enabled:", error);
      }

      if (!cancelled) {
        setPushEnabled(data?.notifications_enabled !== false);
        setPushLoading(false);
      }
    })().catch((error) => {
      console.error("Chyba pri načítaní push nastavení:", error);
      if (!cancelled) setPushLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleFontScaleChange = (value: number[]) => {
    const next = Math.min(3, Math.max(1, Math.round(value[0] ?? 1))) as 1 | 2 | 3;
    setFontScale(next);
  };

  const handlePushEnabledChange = async (nextValue: boolean) => {
    const prevValue = pushEnabled;
    setPushEnabled(nextValue);
    setPushSaving(true);

    const { error } = await (supabase as any).from("user_settings").upsert(
      {
        user_id: userId,
        notifications_enabled: nextValue,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Chyba pri ukladaní user_settings.notifications_enabled:", error);
      setPushEnabled(prevValue);
      setPushSaving(false);
      return;
    }

    if (nextValue && typeof Notification !== "undefined" && Notification.permission === "granted") {
      syncPushSubscriptionSilently().catch((syncError) => {
        console.error("Chyba pri tichej synchronizácii push subskripcie:", syncError);
      });
    }

    setPushSaving(false);
  };

  return (
    <div className="rounded-3xl border border-neutral-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-neutral-200/70 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/10">
          {darkMode ? (
            <Moon className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          ) : (
            <Sun className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Tmavý režim</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {darkMode ? "Aktívny tmavý vzhľad" : "Aktívny svetlý vzhľad"}
          </p>
        </div>
        <Switch
          checked={darkMode}
          onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
          aria-label="Prepnúť tmavý režim"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/10">
          {muted ? (
            <BellOff className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          ) : (
            <Bell className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Vypnúť real-time notifikácie
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Master prepínač – vypne všetky okamžité upozornenia.
          </p>
        </div>
        <Switch checked={muted} onCheckedChange={setMuted} aria-label="Master toggle" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/10">
          {pushEnabled ? (
            <Bell className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          ) : (
            <BellOff className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Push notifikácie do zariadenia
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Bežné push správy budú rešpektovať toto nastavenie, kritické zostanú povolené.
          </p>
        </div>
        <Switch
          checked={pushEnabled}
          onCheckedChange={(v) => void handlePushEnabledChange(v)}
          disabled={pushLoading || pushSaving}
          aria-label="Push notifications toggle"
        />
      </div>

      <div className="mt-4 border-t border-neutral-200/70 pt-3 dark:border-white/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Veľkosť písma
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {fontScale === 1
                ? "Štandardné písmo"
                : fontScale === 2
                  ? `Stredne zväčšené (${fontSizePx}px)`
                  : `Veľké písmo (${fontSizePx}px)`}
            </p>
          </div>
          <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-900">
            {fontScale}
          </span>
        </div>

        <Slider
          value={[fontScale]}
          min={1}
          max={3}
          step={1}
          onValueChange={handleFontScaleChange}
          aria-label="Veľkosť písma"
          className="py-2"
        />

        <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
          {FONT_SCALE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFontScale(option.value)}
              className={`rounded-full px-2 py-1 transition ${
                fontScale === option.value
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-neutral-300"
              }`}
            >
              {option.label} · {option.description}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-200/70 pt-3 dark:border-white/10">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Kategórie
        </p>
        <ul className="space-y-2">
          {NOTIF_CATEGORIES.map((c) => (
            <li key={c.key} className="flex items-center gap-3">
              <span
                className={`flex-1 text-sm ${
                  muted
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-800 dark:text-neutral-200"
                }`}
              >
                {c.label}
              </span>
              <Switch
                checked={categories[c.key]}
                onCheckedChange={(v) => setCategory(c.key, v)}
                disabled={muted}
                aria-label={c.label}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- Invite section ----------

function NeighborInviteSection({
  userId,
  canUse,
  maxCodes,
}: {
  userId: string;
  canUse: boolean;
  maxCodes: number;
}) {
  const [codes, setCodes] = useState<InviteCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadOwnCodes() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, code, created_at, used_by, used_at, shared_at, shared_via")
      .eq("created_by", userId)
      .is("used_by", null)
      .is("shared_at", null)
      .order("created_at", { ascending: true })
      .limit(maxCodes);
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    setCodes((data as InviteCodeRow[] | null) ?? []);
    setLoading(false);
  }

  async function ensureCodes() {
    if (!canUse) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.rpc("get_or_create_neighbor_invite_codes", {
      _count: maxCodes,
    });
    setBusy(false);
    if (error) {
      setErr(mapInviteError(error.message));
      return;
    }
    setCodes((data as InviteCodeRow[] | null) ?? []);
  }

  async function markCodeAsShared(inviteId: string, via: string) {
    const { data, error } = await supabase.rpc("mark_invite_code_shared", {
      _invite_id: inviteId,
      _via: via,
    });
    if (error) {
      setErr(mapInviteError(error.message));
      return false;
    }
    if (!data) return false;
    setCodes((prev) => prev.filter((c) => c.id !== inviteId));
    return true;
  }

  async function markAllCodesAsShared(via: string) {
    const ids = codes.map((c) => c.id);
    for (const id of ids) {
      await markCodeAsShared(id, via);
    }
  }

  useEffect(() => {
    if (canUse) {
      void ensureCodes();
    } else {
      void loadOwnCodes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, canUse, maxCodes]);

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function inviteMessage(code: string) {
    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://komunita.sk";
    return `Ahoj, pozývam ťa do susedskej aplikácie. Použi pozývací kód: ${code}. Odkaz: ${appUrl}`;
  }

  async function shareNative(code: string) {
    const row = codes.find((c) => c.code === code);
    if (!row) return;
    const msg = inviteMessage(code);
    if (!navigator.share) {
      copy(msg);
      return;
    }
    try {
      await navigator.share({
        title: "Pozvať suseda",
        text: msg,
      });
      await markCodeAsShared(row.id, "native");
    } catch {
      // User may cancel the native share sheet.
    }
  }

  async function shareAll() {
    const all = codes.map((c, i) => `${i + 1}. ${c.code}`).join("\n");
    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://komunita.sk";
    const text = `Pozývam ťa do susedskej aplikácie. Vyber si kód:\n${all}\nOdkaz: ${appUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pozvať suseda", text });
        await markAllCodesAsShared("native-bulk");
        return;
      } catch {
        // User may cancel the native share sheet.
      }
    }
    await navigator.clipboard?.writeText(text);
    await markAllCodesAsShared("clipboard-bulk");
    setCopied("__all__");
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="rounded-3xl border border-border bg-card/95 p-5 text-card-foreground shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pozvať suseda</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vygeneruj alebo načítaj až {maxCodes} aktívnych kódov a pošli ich susedom.
          </p>
        </div>
        <button
          onClick={() => void loadOwnCodes()}
          className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent/60"
        >
          Obnoviť
        </button>
      </div>

      {!canUse ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Lock className="h-3.5 w-3.5" />
          Pozývanie je dostupné pre aktívneho suseda s invite kódom alebo pre rolu admin/starosta.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => void ensureCodes()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Získať {maxCodes} kódov
            </button>
            {codes.length > 0 && (
              <button
                onClick={() => void shareAll()}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent/60"
              >
                <Share2 className="h-3.5 w-3.5" /> Zdieľať všetky
              </button>
            )}
          </div>

          {err && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {err}
            </div>
          )}

          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Načítavam pozývacie kódy...
            </div>
          ) : codes.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              Zatiaľ nemáš aktívne pozývacie kódy. Klikni na „Získať {maxCodes} kódov".
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {codes.map((row) => {
                const code = row.code;
                const whatsappText = encodeURIComponent(inviteMessage(code));
                const shareUrl =
                  typeof window !== "undefined" ? window.location.origin : "https://komunita.sk";
                const fbQuote = encodeURIComponent(inviteMessage(code));
                return (
                <li
                  key={row.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2"
                >
                  <span className="flex-1 font-mono text-sm tracking-wider text-foreground">
                    {code}
                  </span>
                  <button
                    onClick={() => copy(code)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label="Kopírovať"
                  >
                    {copied === code ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                    <button
                      onClick={() => void shareNative(code)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent/60"
                    >
                      <Share2 className="h-3 w-3" /> Zdieľať
                    </button>
                  <a
                      href={`https://wa.me/?text=${whatsappText}`}
                    onClick={() => {
                      void markCodeAsShared(row.id, "whatsapp");
                    }}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    WhatsApp
                  </a>
                  <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                        shareUrl,
                      )}&quote=${fbQuote}`}
                      onClick={() => {
                        void markCodeAsShared(row.id, "facebook");
                      }}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                      Facebook
                  </a>
                </li>
                );
              })}
            </ul>
          )}
          {copied === "__all__" && (
            <p className="mt-2 text-[11px] text-emerald-700">Text so všetkými kódmi je v schránke.</p>
          )}
        </>
      )}
    </div>
  );
}

function mapInviteError(message: string) {
  if (/get_or_create_neighbor_invite_codes/i.test(message) && /does not exist|nenajden|not exist/i.test(message)) {
    return "V databáze ešte chýba funkcia pre generovanie kódov. Spusť najnovšiu Supabase migráciu a skús znova.";
  }
  if (/mark_invite_code_shared/i.test(message) && /does not exist|nenajden|not exist/i.test(message)) {
    return "V databáze ešte chýba funkcia pre označenie zdieľaných kódov. Spusť najnovšiu Supabase migráciu a skús znova.";
  }
  if (/forbidden|permission|42501/i.test(message)) {
    return "Na generovanie pozvánok zatiaľ nemáš oprávnenie. Potrebný je aktívny sused s invite kódom alebo rola admin/starosta.";
  }
  return message;
}

// ---------- Account actions ----------

function AccountActions({ userId }: { userId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function deleteAccount() {
    setBusy(true);
    setErr(null);

    const { error } = await supabase.rpc("delete_my_account");

    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <>
      <div className="flex flex-col gap-2 pb-4">
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-medium text-foreground shadow-sm hover:bg-accent/60"
        >
          <LogOut className="h-4 w-4" />
          Odhlásiť sa
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <Trash2 className="h-4 w-4" />
          Zmazať účet
        </button>
        {err && <p className="text-center text-xs text-rose-600">{err}</p>}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať účet natrvalo?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je nezvratná. Odstráni sa tvoj prihlasovací účet aj naviazané profily,
              inzeráty, správy a ďalšie používateľské dáta, ktoré sú na účet technicky naviazané.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void deleteAccount();
              }}
              disabled={busy}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------- Role switcher (demo / role assignment) ----------

const ROLE_OPTIONS: { value: ProfileRole; label: string; emoji: string }[] = [
  { value: "Sused", label: "Sused", emoji: "👤" },
  { value: "VIP_Firma", label: "VIP Firma", emoji: "🏢" },
  { value: "Starosta", label: "Starosta", emoji: "🛡️" },
  { value: "Uradnik", label: "Úradník", emoji: "📢" },
  { value: "Farar", label: "Farár", emoji: "⛪" },
];

function RoleSwitcher({
  role,
  userId,
  onChange,
}: {
  role: ProfileRole;
  userId: string;
  onChange: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<ProfileRole | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick(next: ProfileRole) {
    if (next === role || busy) return;
    setBusy(next);
    setErr(null);
    const { error } = await supabase.from("profiles").update({ role: next }).eq("id", userId);
    if (error) {
      setBusy(null);
      setErr(error.message);
      return;
    }

    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: next }, { onConflict: "user_id,role" });

    setBusy(null);
    if (roleErr) {
      setErr(roleErr.message);
      return;
    }

    await onChange();
  }

  return (
    <div className="rounded-3xl border border-neutral-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
          <UserCog className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Rola v komunite</p>
          <p className="text-xs text-muted-foreground">Odomkne špecializovaný panel nižšie.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {ROLE_OPTIONS.map((o) => {
          const active = o.value === role;
          return (
            <button
              key={o.value}
              onClick={() => pick(o.value)}
              disabled={!!busy}
              className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-[10px] font-semibold transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
              } disabled:opacity-40`}
            >
              <span className="text-base leading-none">{busy === o.value ? "…" : o.emoji}</span>
              {o.label}
            </button>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
