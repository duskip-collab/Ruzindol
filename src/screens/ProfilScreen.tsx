import { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
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
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, type ProfileRole } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { BanBanner } from "@/components/BanBanner";
import { ActiveNeighborBadge } from "@/components/ActiveNeighborBadge";
import { LegalInfoPanel } from "@/components/LegalDocuments";
import { AdminPanel } from "@/components/AdminPanel";
import { AktualityGroupsPanel } from "@/components/AktualityGroupsPanel";
import { useTheme } from "@/context/ThemeContext";
import { FONT_SCALE_OPTIONS, useFontScale } from "@/context/FontScaleContext";
import { useNotifications, NOTIF_CATEGORIES } from "@/context/NotificationContext";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
import { isIosDevice } from "@/lib/pwa";
import { cn } from "@/lib/utils";

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

const ModerationPanel = lazy(async () => {
  const module = await import("@/components/ModerationPanel");
  return { default: module.ModerationPanel };
});

const InviteRedeemSection = lazy(async () => {
  const module = await import("@/components/InviteRedeemSection");
  return { default: module.InviteRedeemSection };
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
        <div className="flex w-full flex-col gap-2 overflow-visible pb-24 pr-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-y-contain md:pb-28 xl:min-h-[28rem] xl:pb-4">
          {(isAdmin || profile.role === "Starosta") && (
            <AccordionSection
              value="admin"
              title="Admin panel"
              description="Správa používateľov, rolí, obsahu a nastavení obce."
              isActive={openSection === "admin"}
              onToggle={() => setOpenSection((prev) => (prev === "admin" ? "" : "admin"))}
              onClose={() => setOpenSection("")}
              itemClassName={isWideAdminSection ? "xl:rounded-[2rem]" : undefined}
              contentClassName={isWideAdminSection ? "px-3 py-3 md:px-4" : undefined}
            >
              {openSection === "admin" && <AdminPanel adminId={profile.id} isSuperAdmin={isAdmin} />}
            </AccordionSection>
          )}

          {(isAdmin || profile.role === "Starosta") && (
            <AccordionSection
              value="moderation"
              title="Moderácia"
              description="Rýchle schvaľovanie, kontrola hlásení a zásahy moderátora."
              isActive={openSection === "moderation"}
              onToggle={() => setOpenSection((prev) => (prev === "moderation" ? "" : "moderation"))}
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
              description="Správa sekcií DHZ, OŠK, Dôchodcovia, Farnosť a Služby."
              isActive={openSection === "aktuality-admin"}
              onToggle={() =>
                setOpenSection((prev) => (prev === "aktuality-admin" ? "" : "aktuality-admin"))
              }
              onClose={() => setOpenSection("")}
              itemClassName={isWideAdminSection ? "xl:rounded-[2rem]" : undefined}
              contentClassName={isWideAdminSection ? "px-3 py-3 md:px-4" : undefined}
            >
              {openSection === "aktuality-admin" && <AktualityGroupsPanel />}
            </AccordionSection>
          )}

          <AccordionSection
            value="edit"
            title="Úprava profilu"
            description="Meno, ulica a základné profilové údaje."
            isActive={openSection === "edit"}
            onToggle={() => setOpenSection((prev) => (prev === "edit" ? "" : "edit"))}
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
            description="Téma, veľkosť písma, upozornenia a právne informácie."
            isActive={openSection === "settings"}
            onToggle={() => setOpenSection((prev) => (prev === "settings" ? "" : "settings"))}
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
              description="Testovanie oprávnení a panelov podľa roly používateľa."
              isActive={openSection === "role"}
              onToggle={() => setOpenSection((prev) => (prev === "role" ? "" : "role"))}
              onClose={() => setOpenSection("")}
            >
              {/* V prípade potreby doplniť vlastný RoleSwitcher */}
              <p className="text-xs text-muted-foreground">Preprepínanie rolí (testovací režim).</p>
            </AccordionSection>
          )}

          <AccordionSection
            value="panels"
            title="Panely rolí"
            description="Prehľad dostupných panelov a komunitných nástrojov."
            isActive={openSection === "panels"}
            onToggle={() => setOpenSection((prev) => (prev === "panels" ? "" : "panels"))}
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
              description="Aktivuj susedské funkcie pomocou pozývacieho kódu."
              isActive={openSection === "activate"}
              onToggle={() => setOpenSection((prev) => (prev === "activate" ? "" : "activate"))}
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
            description="Generovanie a zdieľanie pozývacích kódov pre nových susedov."
            isActive={openSection === "invite-neighbor"}
            onToggle={() =>
              setOpenSection((prev) => (prev === "invite-neighbor" ? "" : "invite-neighbor"))
            }
            onClose={() => setOpenSection("")}
          >
            {/* Prípadný komponent pre pozvánky */}
            <p className="text-xs text-muted-foreground">Správa pozývacích kódov.</p>
          </AccordionSection>

          <AccordionSection
            value="items"
            title={`Moje inzeráty (${items.length})`}
            description="Správa tvojich aktívnych inzerátov, expirácie a zmazanie."
            isActive={openSection === "items"}
            onToggle={() => setOpenSection((prev) => (prev === "items" ? "" : "items"))}
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
            description="Odhlásenie, správa účtu a trvalé zmazanie účtu."
            isActive={openSection === "account"}
            onToggle={() => setOpenSection((prev) => (prev === "account" ? "" : "account"))}
            onClose={() => setOpenSection("")}
          >
            <div className="flex flex-col gap-2">
              <button
                onClick={() => void supabase.auth.signOut()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                Odhlásiť sa
              </button>
            </div>
          </AccordionSection>
        </div>
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
  description,
  isActive,
  onToggle,
  onClose,
  itemClassName,
  contentClassName,
  children,
}: {
  value: string;
  title: string;
  description?: string;
  isActive: boolean;
  onToggle: () => void;
  onClose: () => void;
  itemClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const canUseDom = typeof document !== "undefined";
  const useIosBackNav = isIosDevice();

  return (
    <>
      <div
        data-section={value}
        className={`flex flex-col overflow-hidden rounded-3xl border border-border/90 bg-card text-card-foreground shadow-sm backdrop-blur-xl ${itemClassName ?? ""}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isActive}
          className="flex w-full items-start justify-between gap-2 rounded-2xl px-4 py-3.5 text-left text-[15px] leading-6 text-neutral-900 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 dark:text-neutral-100 md:px-5 md:py-4 md:text-base"
        >
          <div className="min-w-0 pr-3">
            <p className="font-semibold leading-5">{title}</p>
            {description && (
              <p className="mt-0.5 line-clamp-2 text-xs font-normal leading-4 text-neutral-500 dark:text-neutral-400">
                {description}
              </p>
            )}
          </div>
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-neutral-700 transition-transform duration-200 dark:text-neutral-200 ${
              isActive ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {canUseDom &&
        createPortal(
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="fixed inset-0 z-[160] flex h-[100dvh] w-full min-h-[100dvh] flex-col bg-white/95 backdrop-blur-xl dark:bg-neutral-950/95"
                role="dialog"
                aria-modal="true"
              >
                <div className="pt-safe flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground md:text-lg">{title}</h3>
                    {description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20 ${useIosBackNav ? "hidden md:flex" : "flex"}`}
                    aria-label="Zavrieť panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 ${useIosBackNav ? "pb-24" : "pb-8"} ${contentClassName ?? ""}`}>
                  {children}
                </div>

                {useIosBackNav && (
                  <div className="border-t border-border bg-white/95 px-4 py-3 pb-safe dark:bg-neutral-950/95 md:hidden">
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
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-100 dark:border-white/10 dark:bg-white/5 dark:divide-white/10">
      {/* Tmavý režim */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tmavý režim</span>
        </div>
        <Switch checked={darkMode} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
      </div>

      {/* Push Notifikácie */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Bell className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Push notifikácie</span>
        </div>
        <Switch 
          checked={pushEnabled} 
          disabled={pushLoading || pushSaving}
          onCheckedChange={(v) => void handlePushEnabledChange(v)} 
        />
      </div>
    </div>
  );
}