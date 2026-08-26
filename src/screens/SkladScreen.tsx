import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  ShoppingCart,
  Gift,
  Wrench,
  X,
  Zap,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { ImageInput } from "@/components/ImageInput";
import type { CompressedImage } from "@/lib/compress-image";
import { uploadCompressedImage } from "@/lib/upload-image";
import { SafeChat } from "@/components/SafeChat";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { removeBucketObject } from "@/lib/storage";
import {
  formatWarehouseExpiry,
  getWarehouseExpiryIso,
  getWarehouseLifetimeLabel,
  getWarehouseRemainingLabel,
  resolveWarehouseExpiry,
  type WarehouseItemType,
} from "@/lib/warehouse";

import { ActiveNeighborBadge } from "@/components/ActiveNeighborBadge";

type Section = "trh" | "darovanie" | "poziciovna";
type PoziciovnaTab = "ponuka" | "dopyt";
type ItemType = "trh" | "darovanie" | "sklad_ponuka" | "sklad_dopyt";

type Item = {
  id: string;
  user_id: string;
  type: ItemType;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  image_path: string | null;
  created_at: string;
  expires_at: string | null;
  profiles?: { name: string; street: string | null; is_active_neighbor?: boolean | null } | null;
};

type ActiveCountRow = { type: ItemType; active_count: number };

const EMPTY_COUNTS: Record<ItemType, number> = {
  trh: 0,
  darovanie: 0,
  sklad_ponuka: 0,
  sklad_dopyt: 0,
};

const H = 60 * 60 * 1000;

const SECTION_META: Record<
  Section,
  { title: string; icon: React.ReactNode; accent: string; ring: string; canAdd: boolean }
> = {
  trh: {
    title: "Susedský trh",
    icon: <ShoppingCart className="h-6 w-6" />,
    accent: "from-emerald-500/90 to-teal-500/90",
    ring: "ring-emerald-200",
    canAdd: true,
  },
  darovanie: {
    title: "Darovanie",
    icon: <Gift className="h-6 w-6" />,
    accent: "from-rose-500/90 to-pink-500/90",
    ring: "ring-rose-200",
    canAdd: true,
  },
  poziciovna: {
    title: "Susedský sklad",
    icon: <Wrench className="h-6 w-6" />,
    accent: "from-sky-500/90 to-indigo-500/90",
    ring: "ring-sky-200",
    canAdd: true,
  },
};

function sectionType(section: Section, pozTab: PoziciovnaTab): ItemType {
  if (section === "trh") return "trh";
  if (section === "darovanie") return "darovanie";
  return pozTab === "ponuka" ? "sklad_ponuka" : "sklad_dopyt";
}

function useActiveWarehouseCounts() {
  const [counts, setCounts] = useState<Record<ItemType, number>>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_active_warehouse_counts");

      if (!mounted) return;

      if (error) {
        setCounts(EMPTY_COUNTS);
        setLoading(false);
        return;
      }

      const next = { ...EMPTY_COUNTS };
      ((data as ActiveCountRow[] | null) ?? []).forEach((row) => {
        next[row.type] = Number(row.active_count) || 0;
      });

      setCounts(next);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { counts, loading };
}

export function SkladScreen() {
  const { profile } = useCurrentUser();
  const isActive = profile?.is_active_neighbor ?? false;
  const { counts, loading: countsLoading } = useActiveWarehouseCounts();
  const [section, setSection] = useState<Section | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pozTab, setPozTab] = useState<PoziciovnaTab>("ponuka");

  if (section === null) {
    return (
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 overflow-y-auto p-4 pb-8 md:px-6 md:pt-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Sklad</h2>
          <p className="text-sm text-muted-foreground">Vyber si, čo chceš robiť.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PillarCard
            section="trh"
            count={counts.trh}
            loading={countsLoading}
            onClick={() => setSection("trh")}
          />
          <PillarCard
            section="darovanie"
            count={counts.darovanie}
            loading={countsLoading}
            onClick={() => setSection("darovanie")}
          />
          <PillarCard
            section="poziciovna"
            count={counts.sklad_ponuka + counts.sklad_dopyt}
            loading={countsLoading}
            onClick={() => setSection("poziciovna")}
          />
        </div>
      </div>
    );
  }

  const meta = SECTION_META[section];
  const isPoz = section === "poziciovna";
  const type = sectionType(section, pozTab);

  return (
    <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col">
      <div className="app-toolbar flex items-center gap-2 border-b px-4 py-3 backdrop-blur-xl md:px-6">
        <button
          onClick={() => setSection(null)}
          className="btn-secondary-surface flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Späť do Skladu
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm font-semibold text-foreground">
          {meta.icon}
          <span>{meta.title}</span>
        </div>
      </div>

      {isPoz && (
        <div className="app-toolbar flex gap-1 border-b p-1.5 backdrop-blur-xl md:px-4">
          <TabButton active={pozTab === "ponuka"} onClick={() => setPozTab("ponuka")}>
            <Wrench className="h-4 w-4" /> Ponuka náradia
            <CountChip count={counts.sklad_ponuka} loading={countsLoading} />
          </TabButton>
          <TabButton active={pozTab === "dopyt"} onClick={() => setPozTab("dopyt")}>
            <Zap className="h-4 w-4" /> Rýchly dopyt
            <CountChip count={counts.sklad_dopyt} loading={countsLoading} />
          </TabButton>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:px-6 xl:px-8">
        {isPoz && pozTab === "dopyt" ? <DopytList /> : <ListingList type={type} meta={meta} />}
      </div>

      {meta.canAdd && isActive && (
        <button
          onClick={() => setFormOpen(true)}
          aria-label="Pridať"
          className={`absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${
            isPoz && pozTab === "dopyt" ? "from-amber-500/95 to-orange-600/95" : meta.accent
          } text-white shadow-xl ring-4 ${
            isPoz && pozTab === "dopyt" ? "ring-amber-200" : meta.ring
          } transition active:scale-95`}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {meta.canAdd && !isActive && (
        <div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/12 px-3 py-2 text-xs text-amber-200 shadow-sm backdrop-blur">
          <span className="font-semibold">Režim čítania</span>
          <span className="opacity-80">· zadaj pozývací kód v profile a odomkni pridávanie.</span>
        </div>
      )}

      {formOpen &&
        (isPoz && pozTab === "dopyt" ? (
          <QuickDopytModal onClose={() => setFormOpen(false)} />
        ) : (
          <AddListingModal section={section} type={type} onClose={() => setFormOpen(false)} />
        ))}
    </div>
  );
}

function CountChip({ count, loading }: { count: number; loading: boolean }) {
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-current">
      {loading ? "…" : count}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "nav-tab-active"
          : "nav-tab-idle"
      }`}
    >
      {children}
    </button>
  );
}

function useItems(type: ItemType) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("warehouse_items")
        .select("id, user_id, type, title, description, price, image_url, image_path, created_at, expires_at, profiles(name, street, is_active_neighbor)")
        .eq("type", type)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      setItems((data as Item[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [type]);

  return { items, loading };
}

function ListingList({ type, meta }: { type: ItemType; meta: (typeof SECTION_META)[Section] }) {
  const { items, loading } = useItems(type);
  const { userId, profile } = useCurrentUser();
  const isActive = profile?.is_active_neighbor ?? false;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [chat, setChat] = useState<{ chatId: string; item: Item } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const activeItems = items.filter(
    (item) => resolveWarehouseExpiry(item.type, item.created_at, item.expires_at).getTime() > nowMs,
  );

  async function openChat(item: Item) {
    if (!userId || opening) return;
    if (item.user_id === userId) return;
    setOpening(item.id);
    // Find existing chat between me (buyer) and item.user_id (seller) for this item.
    const { data: existing } = await supabase
      .from("chats")
      .select("id")
      .eq("item_id", item.id)
      .eq("buyer_id", userId)
      .eq("seller_id", item.user_id)
      .maybeSingle();

    let chatId = existing?.id as string | undefined;
    if (!chatId) {
      const { data, error } = await supabase
        .from("chats")
        .insert({ item_id: item.id, buyer_id: userId, seller_id: item.user_id })
        .select("id")
        .single();
      if (error) {
        setOpening(null);
        console.error(error);
        return;
      }
      chatId = data.id;
    }
    setOpening(null);
    setChat({ chatId: chatId!, item });
  }

  const priceLabel = (n: number) => (n > 0 ? `${n} €` : "Zadarmo");

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : activeItems.length === 0 ? (
        <div className="app-surface-muted rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Zatiaľ tu nič nie je. Pridaj prvý inzerát cez +.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {activeItems.map((item) => {
            const isMine = item.user_id === userId;
            const validityLabel = getWarehouseLifetimeLabel(item.type as WarehouseItemType);
            const remainingLabel = getWarehouseRemainingLabel(
              item.type as WarehouseItemType,
              item.created_at,
              nowMs,
              item.expires_at,
            );
            return (
              <article
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="app-card cursor-pointer rounded-2xl p-4 shadow-sm backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-tight text-foreground">{item.title}</h3>
                  <span
                    className={`shrink-0 rounded-full bg-gradient-to-r ${meta.accent} px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm`}
                  >
                    {priceLabel(item.price)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="chip-muted rounded-full px-2 py-1 font-medium">
                    Platnosť {validityLabel}
                  </span>
                  <span className="chip-muted rounded-full px-2 py-1 font-medium">
                    {remainingLabel}
                  </span>
                </div>
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt=""
                    className="mt-2 max-h-48 w-full rounded-xl object-cover"
                  />
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <span className="truncate">
                      {item.profiles?.name ?? "Sused"}
                      {item.profiles?.street ? ` · ${item.profiles.street}` : ""}
                    </span>
                    {item.profiles?.is_active_neighbor && <ActiveNeighborBadge compact />}
                  </p>
                  {!isMine && isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void openChat(item);
                      }}
                      disabled={opening === item.id}
                      className="btn-secondary-surface flex shrink-0 items-center gap-1 px-2.5 py-1 text-xs font-medium disabled:opacity-60"
                    >
                      {opening === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5" />
                      )}
                      Napísať
                    </button>
                  )}
                  {!isMine && !isActive && (
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:border-amber-300 dark:bg-amber-100 dark:text-amber-900"
                      title="Aktivuj sa pozývacím kódom"
                    >
                      🔒 Iba čítanie
                    </span>
                  )}
                </div>
                <div className="mt-2 border-t border-[color:var(--border-card)] pt-2 text-right text-[11px] text-muted-foreground">
                  Expiruje {formatWarehouseExpiry(item.type as WarehouseItemType, item.created_at, item.expires_at)}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <ListingDetailModal
          item={selectedItem}
          meta={meta}
          isMine={selectedItem.user_id === userId}
          canChat={isActive && selectedItem.user_id !== userId}
          opening={opening === selectedItem.id}
          onChat={() => void openChat(selectedItem)}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {chat && userId && (
        <SafeChat
          chatId={chat.chatId}
          currentUserId={userId}
          listingTitle={chat.item.title}
          counterpartyName={chat.item.profiles?.name ?? "Sused"}
          canSendMessages={isActive}
          onClose={() => setChat(null)}
        />
      )}
    </>
  );
}

function ListingDetailModal({
  item,
  meta,
  isMine,
  canChat,
  opening,
  onChat,
  onClose,
}: {
  item: Item;
  meta: (typeof SECTION_META)[Section];
  isMine: boolean;
  canChat: boolean;
  opening: boolean;
  onChat: () => void;
  onClose: () => void;
}) {
  const priceLabel = item.price > 0 ? `${item.price} €` : "Zadarmo";

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/35 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="app-modal-surface flex h-full w-full flex-col md:h-auto md:max-h-[92%] md:max-w-3xl md:rounded-3xl md:border md:border-[color:var(--border-card)] md:shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-card)] px-4 py-3">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[color:var(--bg-surface-hover)]"
            aria-label="Zavrieť detail"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground">Detail inzerátu</p>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full bg-gradient-to-r ${meta.accent} px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm`}
          >
            {priceLabel}
          </span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.title}
              className="max-h-[42vh] w-full rounded-2xl object-cover"
            />
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Popis</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {item.description || "Bez doplňujúceho popisu."}
            </p>
          </div>

          <div className="app-surface-muted rounded-2xl p-3 text-xs">
            <p className="font-semibold text-foreground">
              {item.profiles?.name ?? "Sused"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {item.profiles?.street ? `Ulica: ${item.profiles.street}` : "Ulica neuvedená"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Pridané: {new Date(item.created_at).toLocaleString("sk-SK")}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Expiruje: {formatWarehouseExpiry(item.type as WarehouseItemType, item.created_at, item.expires_at)}
            </p>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-card)] bg-[color:var(--bg-surface)]/90 p-4">
          {canChat && (
            <button
              onClick={onChat}
              disabled={opening}
              className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
            >
              {opening ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Napísať predajcovi
            </button>
          )}
          {!canChat && !isMine && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Chat je dostupný pre aktívnych susedov.
            </div>
          )}
          {isMine && (
            <div className="app-surface-muted rounded-xl px-3 py-2 text-xs text-muted-foreground">
              Toto je tvoj inzerát.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DopytList() {
  const { items, loading } = useItems("sklad_dopyt");
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const TTL = 24 * H;
  const active = items.filter((d) => nowMs - new Date(d.created_at).getTime() < TTL);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Zap className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Žiadne aktívne dopyty
        </p>
        <p className="max-w-[240px] text-xs text-neutral-500">
          Rýchle dopyty platia len 24 hodín. Ak niečo súrne potrebuješ, klikni na +.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {active.map((d) => {
        const remainingMs = TTL - (nowMs - new Date(d.created_at).getTime());
        const hoursLeft = Math.max(1, Math.ceil(remainingMs / H));
        // Contact was stored on a "Kontakt: X" line in description; extract it.
        const contactMatch = d.description.match(/Kontakt:\s*(.+)$/m);
        const contact = contactMatch?.[1]?.trim() ?? "";
        const bodyText = d.description.replace(/\n?Kontakt:\s*.+$/m, "").trim();
        return (
          <article
            key={d.id}
            className="rounded-2xl border-2 border-amber-300/70 bg-amber-50/70 p-4 shadow-sm backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
                <Zap className="h-3 w-3" /> Urgentné
              </span>
              <span className="text-xs font-medium text-amber-800">Platí ešte {hoursLeft}h</span>
            </div>
            <p className="line-clamp-2 text-sm font-medium text-neutral-800">
              {d.title || bodyText}
            </p>
            {d.title && bodyText && (
              <p className="mt-1 line-clamp-2 text-xs text-neutral-700">{bodyText}</p>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-600">
              <span>{d.profiles?.name ?? "Sused"}</span>
              {contact && (
                <a
                  href={`tel:${contact.replace(/\s/g, "")}`}
                  className="font-semibold text-amber-700 hover:underline"
                >
                  {contact}
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PillarCard({
  section,
  count,
  loading,
  onClick,
}: {
  section: Section;
  count: number;
  loading: boolean;
  onClick: () => void;
}) {
  const meta = SECTION_META[section];
  const descriptions: Record<Section, string> = {
    trh: "Predaj alebo kúp veci od susedov v okolí.",
    darovanie: "Ponúkni veci zadarmo za odvoz.",
    poziciovna: "Požičaj si náradie a vybavenie od susedov.",
  };
  const emojis: Record<Section, string> = { trh: "🛒", darovanie: "🎁", poziciovna: "🛠️" };

  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br ${meta.accent} p-5 text-left text-white shadow-lg ring-1 ${meta.ring} transition hover:shadow-xl active:scale-[0.98]`}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-md">
          {emojis[section]}
          <span className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-neutral-900 shadow-sm">
            {loading ? "…" : count}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight">{meta.title}</h3>
          <p className="mt-0.5 text-sm text-white/90">{descriptions[section]}</p>
        </div>
      </div>
    </button>
  );
}

function AddListingModal({
  section,
  type,
  onClose,
}: {
  section: Section;
  type: ItemType;
  onClose: () => void;
}) {
  const meta = SECTION_META[section];
  const isDarovanie = type === "darovanie";
  const isPoz = type === "sklad_ponuka";
  const { userId } = useCurrentUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<CompressedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const priceLabel = isPoz ? "Odmena / cena za deň (€)" : "Cena (€)";
  const pricePlaceholder = isPoz ? "3" : "35";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setErr(null);
    setBusy(true);
    try {
      let image_url: string | null = null;
      let image_path: string | null = null;
      if (photo) {
        const upload = await uploadCompressedImage(photo, userId);
        image_url = upload.imageUrl;
        image_path = upload.imagePath;
      }
      const numericPrice = isDarovanie ? 0 : Number(price) || 0;
      const { error } = await supabase.from("warehouse_items").insert({
        user_id: userId,
        type,
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        image_url,
        image_path,
        expires_at: getWarehouseExpiryIso(type as WarehouseItemType),
      });
      if (error) throw error;
      onClose();
      // simple full-refresh of the list by reloading — cheap and correct.
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/30 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="flex h-full w-full flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-neutral-200 md:shadow-2xl dark:md:border-white/15">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-white/10"
            aria-label="Zavrieť"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {meta.icon}
            <h2 className="font-semibold">
              Nový inzerát · {isPoz ? "Ponuka náradia" : meta.title}
            </h2>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Názov
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={isPoz ? "Napr. Vŕtačka Makita" : "Napr. Detský bicykel"}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none backdrop-blur focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Popis
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Krátky popis…"
              className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none backdrop-blur focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
            />
          </div>

          <ImageInput value={photo} onChange={setPhoto} label="Fotka (voliteľné)" />

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {priceLabel}
            </label>
            <input
              type={isDarovanie ? "text" : "number"}
              min={0}
              step="0.01"
              value={isDarovanie ? "0 € / Zadarmo" : price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={isDarovanie}
              placeholder={pricePlaceholder}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none backdrop-blur focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 dark:disabled:bg-neutral-200 dark:disabled:text-neutral-700"
            />
            {isDarovanie && (
              <p className="mt-1 text-xs text-rose-600">
                V sekcii Darovanie je cena pevne nastavená na 0 €.
              </p>
            )}
          </div>

          {err && <p className="text-xs text-rose-600">{err}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="submit"
              disabled={busy}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${meta.accent} py-3 text-sm font-semibold text-white shadow-md active:scale-[0.99] disabled:opacity-60`}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Zverejniť inzerát
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Zrušiť
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickDopytModal({ onClose }: { onClose: () => void }) {
  const { userId } = useCurrentUser();
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setErr(null);
    setBusy(true);
    try {
      const description = `${text.trim()}\nKontakt: ${contact.trim()}`;
      const { error } = await supabase.from("warehouse_items").insert({
        user_id: userId,
        type: "sklad_dopyt",
        title: text.trim().slice(0, 80),
        description,
        price: 0,
        expires_at: getWarehouseExpiryIso("sklad_dopyt"),
      });
      if (error) throw error;
      onClose();
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/30 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="flex h-full w-full flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-neutral-200 md:shadow-2xl dark:md:border-white/15">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-white/10"
            aria-label="Zavrieť"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold">Rýchly dopyt · platí 24h</h2>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex-1">
            <label className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              Čo urgentne potrebuješ požičať a kedy?
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              autoFocus
              rows={8}
              placeholder="Napr. Nemá niekto na 2 hodiny požičať záhradný valec dnes večer?"
              className="mt-2 h-56 w-full resize-none rounded-2xl border-2 border-amber-200 bg-amber-50/40 px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-amber-400 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Kontakt
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              placeholder="Telefón alebo meno"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none backdrop-blur focus:border-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
            />
          </div>

          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            ⚡ Tento dopyt sa automaticky skryje po 24 hodinách.
          </div>

          {err && <p className="text-xs text-rose-600">{err}</p>}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-semibold text-white shadow-md active:scale-[0.99] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Odoslať urgentný dopyt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Zrušiť
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
