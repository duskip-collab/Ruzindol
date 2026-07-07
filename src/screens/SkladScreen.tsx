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
import { NearbyCatalog } from "@/components/NearbyCatalog";
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
  created_at: string;
  profiles?: { name: string; street: string | null; is_active_neighbor?: boolean | null } | null;
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

export function SkladScreen() {
  const { profile } = useCurrentUser();
  const isActive = profile?.is_active_neighbor ?? false;
  const [section, setSection] = useState<Section | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pozTab, setPozTab] = useState<PoziciovnaTab>("ponuka");

  if (section === null) {
    return (
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-5 pb-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Sklad</h2>
          <p className="text-sm text-muted-foreground">Vyber si, čo chceš robiť.</p>
        </div>
        <div className="flex flex-col gap-3">
          <PillarCard section="trh" onClick={() => setSection("trh")} />
          <PillarCard section="darovanie" onClick={() => setSection("darovanie")} />
          <PillarCard section="poziciovna" onClick={() => setSection("poziciovna")} />
        </div>

        <NearbyCatalog />
      </div>
    );
  }


  const meta = SECTION_META[section];
  const isPoz = section === "poziciovna";
  const type = sectionType(section, pozTab);

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-200/60 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-neutral-700/60 dark:bg-neutral-950/80">
        <button
          onClick={() => setSection(null)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Späť do Skladu
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {meta.icon}
          <span>{meta.title}</span>
        </div>
      </div>

      {isPoz && (
        <div className="flex gap-1 border-b border-neutral-200/60 bg-white/60 p-1.5 backdrop-blur-xl dark:border-neutral-700/60 dark:bg-neutral-950/60">
          <TabButton active={pozTab === "ponuka"} onClick={() => setPozTab("ponuka")}>
            <Wrench className="h-4 w-4" /> Ponuka náradia
          </TabButton>
          <TabButton active={pozTab === "dopyt"} onClick={() => setPozTab("dopyt")}>
            <Zap className="h-4 w-4" /> Rýchly dopyt
          </TabButton>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {isPoz && pozTab === "dopyt" ? (
          <DopytList />
        ) : (
          <ListingList type={type} meta={meta} />
        )}
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
        <div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm backdrop-blur dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <span className="font-semibold">Režim čítania</span>
          <span className="opacity-80">
            · zadaj pozývací kód v profile a odomkni pridávanie.
          </span>
        </div>
      )}


      {formOpen &&
        (isPoz && pozTab === "dopyt" ? (
          <QuickDopytModal onClose={() => setFormOpen(false)} />
        ) : (
          <AddListingModal
            section={section}
            type={type}
            onClose={() => setFormOpen(false)}
          />
        ))}
    </div>
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
          ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
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
        .select("*, profiles(name, street, is_active_neighbor)")
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

function ListingList({
  type,
  meta,
}: {
  type: ItemType;
  meta: (typeof SECTION_META)[Section];
}) {
  const { items, loading } = useItems(type);
  const { userId, profile } = useCurrentUser();
  const isActive = profile?.is_active_neighbor ?? false;
  const [chat, setChat] = useState<{ chatId: string; item: Item } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

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
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:text-neutral-400">
          Zatiaľ tu nič nie je. Pridaj prvý inzerát cez +.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isMine = item.user_id === userId;
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-neutral-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl dark:border-neutral-700/70 dark:bg-neutral-950/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-tight text-neutral-900 dark:text-neutral-100">{item.title}</h3>
                  <span
                    className={`shrink-0 rounded-full bg-gradient-to-r ${meta.accent} px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm`}
                  >
                    {priceLabel(item.price)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{item.description}</p>
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt=""
                    className="mt-2 max-h-48 w-full rounded-xl object-cover"
                  />
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-neutral-500">
                    <span className="truncate">
                      {item.profiles?.name ?? "Sused"}
                      {item.profiles?.street ? ` · ${item.profiles.street}` : ""}
                    </span>
                    {item.profiles?.is_active_neighbor && (
                      <ActiveNeighborBadge compact />
                    )}
                  </p>
                  {!isMine && isActive && (
                    <button
                      onClick={() => void openChat(item)}
                      disabled={opening === item.id}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
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
                      className="flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
                      title="Aktivuj sa pozývacím kódom"
                    >
                      🔒 Iba čítanie
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {chat && userId && (
        <SafeChat
          chatId={chat.chatId}
          currentUserId={userId}
          listingTitle={chat.item.title}
          counterpartyName={chat.item.profiles?.name ?? "Sused"}
          onClose={() => setChat(null)}
        />
      )}
    </>
  );
}

function DopytList() {
  const { items, loading } = useItems("sklad_dopyt");
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const TTL = 24 * H;
  const active = items.filter((d) => now - new Date(d.created_at).getTime() < TTL);

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
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Žiadne aktívne dopyty</p>
        <p className="max-w-[240px] text-xs text-neutral-500 dark:text-neutral-400">
          Rýchle dopyty platia len 24 hodín. Ak niečo súrne potrebuješ, klikni na +.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {active.map((d) => {
        const remainingMs = TTL - (now - new Date(d.created_at).getTime());
        const hoursLeft = Math.max(1, Math.ceil(remainingMs / H));
        // Contact was stored on a "Kontakt: X" line in description; extract it.
        const contactMatch = d.description.match(/Kontakt:\s*(.+)$/m);
        const contact = contactMatch?.[1]?.trim() ?? "";
        const bodyText = d.description.replace(/\n?Kontakt:\s*.+$/m, "").trim();
        return (
          <article
            key={d.id}
            className="rounded-2xl border-2 border-amber-300/70 bg-amber-50/70 p-4 shadow-sm backdrop-blur-xl dark:border-amber-700/70 dark:bg-amber-900/30"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
                <Zap className="h-3 w-3" /> Urgentné
              </span>
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">Platí ešte {hoursLeft}h</span>
            </div>
            <p className="line-clamp-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {d.title || bodyText}
            </p>
            {d.title && bodyText && (
              <p className="mt-1 line-clamp-2 text-xs text-neutral-700 dark:text-neutral-400">{bodyText}</p>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <span>{d.profiles?.name ?? "Sused"}</span>
              {contact && (
                <a
                  href={`tel:${contact.replace(/\s/g, "")}`}
                  className="font-semibold text-amber-700 hover:underline dark:text-amber-300"
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

function PillarCard({ section, onClick }: { section: Section; onClick: () => void }) {
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
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-md dark:bg-neutral-900/20">
          {emojis[section]}
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
      if (photo) image_url = await uploadCompressedImage(photo, userId);
      const numericPrice = isDarovanie ? 0 : Number(price) || 0;
      const { error } = await supabase.from("warehouse_items").insert({
        user_id: userId,
        type,
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        image_url,
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
      <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Zavrieť"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {meta.icon}
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Nový inzerát · {isPoz ? "Ponuka náradia" : meta.title}
          </h2>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Názov</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={isPoz ? "Napr. Vŕtačka Makita" : "Napr. Detský bicykel"}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none backdrop-blur focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Popis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Krátky popis…"
            className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none backdrop-blur focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
          />
        </div>

        <ImageInput value={photo} onChange={setPhoto} label="Fotka (voliteľné)" />

        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{priceLabel}</label>
          <input
            type={isDarovanie ? "text" : "number"}
            min={0}
            step="0.01"
            value={isDarovanie ? "0 € / Zadarmo" : price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isDarovanie}
            placeholder={pricePlaceholder}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none backdrop-blur focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:disabled:bg-neutral-900 dark:disabled:text-neutral-400"
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
            className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Zrušiť
          </button>
        </div>
      </form>
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
    <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Zavrieť"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Rýchly dopyt · platí 24h</h2>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex-1">
          <label className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Čo urgentne potrebuješ požičať a kedy?
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            autoFocus
            rows={8}
            placeholder="Napr. Nemá niekto na 2 hodiny požičať záhradný valec dnes večer?"
            className="mt-2 h-56 w-full resize-none rounded-2xl border-2 border-amber-200 bg-amber-50/40 px-4 py-3 text-base outline-none focus:border-amber-400 dark:border-amber-700 dark:bg-amber-500/10 dark:text-neutral-100 dark:focus:border-amber-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Kontakt</label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
            placeholder="Telefón alebo meno"
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm outline-none backdrop-blur focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
          />
        </div>

        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-500/40">
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
            className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Zrušiť
          </button>
        </div>
      </form>
    </div>
  );
}
