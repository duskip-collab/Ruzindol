import { Suspense, lazy, useEffect, useState } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, type ProfileRole } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { BanBanner } from "@/components/BanBanner";
import { ActiveNeighborBadge } from "@/components/ActiveNeighborBadge";
import { useAppMode } from "@/context/AppModeContext";
import {
  useNotifications,
  NOTIF_CATEGORIES,
} from "@/context/NotificationContext";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
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


type Item = {
  id: string;
  type: string;
  title: string;
  price: number;
  created_at: string;
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

  async function loadItems(uid: string) {
    setItemsLoading(true);
    const { data } = await supabase
      .from("warehouse_items")
      .select("id, type, title, price, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setItems((data as Item[] | null) ?? []);
    setItemsLoading(false);
  }

  useEffect(() => {
    if (!userId) return;
    void loadItems(userId);
  }, [userId]);

  async function deleteItem(id: string) {
    if (!confirm("Naozaj vymazať tento inzerát?")) return;
    setBusyItemId(id);
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
        <p className="text-xs text-neutral-500">
          Skús obnoviť stránku alebo sa znova prihlásiť.
        </p>
      </div>
    );
  }

  const isStarosta = profile.role === "Starosta";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 py-5">
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

      {/* Collapsible sections — iba jedna otvorená naraz */}
      <Accordion
        type="single"
        collapsible
        value={openSection}
        onValueChange={setOpenSection}
        className="flex flex-col gap-2"
      >
        {(isAdmin || profile.role === "Starosta") && (
          <AccordionSection value="admin" title="Admin panel">
            {openSection === "admin" && (
              <Suspense fallback={<SectionLoader />}>
                <AdminPanel adminId={profile.id} isSuperAdmin={isAdmin} />
              </Suspense>
            )}
          </AccordionSection>
        )}

        {(isAdmin || profile.role === "Starosta") && (
          <AccordionSection value="moderation" title="Moderácia">
            {openSection === "moderation" && (
              <Suspense fallback={<SectionLoader />}>
                <ModerationPanel currentUserId={profile.id} />
              </Suspense>
            )}
          </AccordionSection>
        )}

        {(isAdmin || profile.role === "Starosta") && (
          <AccordionSection value="aktuality-admin" title="Administrácia aktualít sekcií">
            {openSection === "aktuality-admin" && (
              <Suspense fallback={<SectionLoader />}>
                <AktualityGroupsPanel />
              </Suspense>
            )}
          </AccordionSection>
        )}

        <AccordionSection value="edit" title="Úprava profilu">
          <ProfileEditForm
            initialName={profile.name}
            initialStreet={profile.street ?? ""}
            userId={profile.id}
            onSaved={refresh}
          />
        </AccordionSection>

        <AccordionSection value="settings" title="Vzhľad & notifikácie">
          <div className="flex flex-col gap-3">
            <NotificationSettings />
          </div>
        </AccordionSection>

        {isAdmin && (
          <AccordionSection value="role" title="Prepnúť moju rolu (admin)">
            <RoleSwitcher role={profile.role} onChange={refresh} userId={profile.id} />
          </AccordionSection>
        )}

        <AccordionSection value="panels" title="Panely rolí">
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
          >
            {openSection === "activate" && (
              <Suspense fallback={<SectionLoader />}>
                <InviteRedeemSection onActivated={refresh} />
              </Suspense>
            )}
          </AccordionSection>
        )}

        {isAdmin && (
          <AccordionSection value="invites" title="Pozvánky pre susedov (admin)">
            <InviteSection />
          </AccordionSection>
        )}




        <AccordionSection value="items" title={`Moje inzeráty (${items.length})`}>
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
                // Inzerát v Sklade považujeme za expirovaný po 14 dňoch.
                const ageMs = Date.now() - new Date(item.created_at).getTime();
                const isExpired = ageMs > 14 * 24 * 60 * 60 * 1000;
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

        <AccordionSection value="account" title="Účet & odhlásenie">
          <AccountActions userId={profile.id} />
        </AccordionSection>
      </Accordion>
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
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-3xl border border-border bg-card/95 text-card-foreground shadow-sm backdrop-blur-xl"
    >
      <AccordionTrigger className="px-5 py-4">
        {title}
      </AccordionTrigger>
      <AccordionContent className="border-t border-border px-5 pb-5 pt-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}


// ---------- Profile Edit ----------

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

  const dirty = name !== initialName || street !== initialStreet;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setErr(null);
    setOk(false);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), street: street.trim() })
      .eq("id", userId);
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
      onSubmit={save}
      className="rounded-3xl border border-border bg-card/95 p-5 text-card-foreground shadow-sm backdrop-blur-xl"
    >
      <h3 className="text-sm font-semibold text-foreground">
        Úprava profilu
      </h3>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Meno
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            required
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Ulica
          </span>
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

function NotificationSettings() {
  const { muted, setMuted, categories, setCategory } = useNotifications();
  return (
    <div className="rounded-3xl border border-neutral-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
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
        <Switch
          checked={muted}
          onCheckedChange={setMuted}
          aria-label="Master toggle"
        />
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

function InviteSection() {
  const {
    isVerified,
    role,
    maxInvites,
    invitesRemaining,
    invitesGenerated,
    generatedCodes,
    generateInviteCode,
  } = useAppMode();
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const remainingLabel =
    maxInvites === Infinity ? "∞" : `${invitesRemaining} / ${maxInvites}`;

  function onGenerate() {
    setErr(null);
    const res = generateInviteCode();
    if (!res.ok) setErr(res.error);
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const shareText = (code: string) =>
    encodeURIComponent(
      `Pozývam ťa do našej susedskej komunity. Použi kód: ${code}`,
    );

  return (
    <div className="rounded-3xl border border-border bg-card/95 p-5 text-card-foreground shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Pozvi suseda
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {role === "Sused"
              ? `Ako Sused môžeš vygenerovať max ${maxInvites} pozvánok.`
              : "Ako Starosta/Admin máš neobmedzené pozvánky."}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {remainingLabel}
        </span>
      </div>

      {!isVerified ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Lock className="h-3.5 w-3.5" />
          Najprv aktivuj svoj účet pozývacím kódom.
        </div>
      ) : (
        <>
          <button
            onClick={onGenerate}
            disabled={invitesRemaining === 0}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Vygenerovať kód
          </button>
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}

          {generatedCodes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {generatedCodes.map((code) => (
                <li
                  key={code}
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
                  <a
                    href={`https://wa.me/?text=${shareText(code)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`fb-messenger://share?link=${encodeURIComponent(
                      "https://komunita.sk",
                    )}&app_id=0`}
                    className="rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    <Share2 className="inline h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {invitesGenerated > 0 && (
            <p className="mt-2 text-[11px] text-neutral-400">
              Vygenerovaných celkom: {invitesGenerated}
            </p>
          )}
        </>
      )}
    </div>
  );
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

  async function deleteProfile() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
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
          Natrvalo vymazať profil
        </button>
        {err && <p className="text-center text-xs text-rose-600">{err}</p>}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazať profil natrvalo?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je nezvratná. Tvoje meno, ulica a inzeráty budú
              odstránené a budeš odhlásený.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteProfile();
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
    const { error } = await supabase
      .from("profiles")
      .update({ role: next })
      .eq("id", userId);
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
          <p className="text-sm font-semibold text-foreground">
            Rola v komunite
          </p>
          <p className="text-xs text-muted-foreground">
            Odomkne špecializovaný panel nižšie.
          </p>
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
              <span className="text-base leading-none">
                {busy === o.value ? "…" : o.emoji}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}

