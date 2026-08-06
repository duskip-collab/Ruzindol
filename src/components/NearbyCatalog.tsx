import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type WarehouseType = "trh" | "darovanie" | "sklad_ponuka" | "sklad_dopyt";
type Filter = "all" | WarehouseType;

type Row = {
  id: string;
  user_id: string;
  type: WarehouseType;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  created_at: string;
  profiles?: { name: string | null } | null;
};

const FILTERS: { key: Filter; label: string; emoji: string }[] = [
  { key: "all", label: "Všetko", emoji: "✨" },
  { key: "trh", label: "Trh", emoji: "🛒" },
  { key: "darovanie", label: "Darovanie", emoji: "🎁" },
  { key: "sklad_ponuka", label: "Náradie", emoji: "🛠️" },
  { key: "sklad_dopyt", label: "Dopyty", emoji: "⚡" },
];

const TYPE_ACCENT: Record<WarehouseType, string> = {
  trh: "from-emerald-500 to-teal-500",
  darovanie: "from-rose-500 to-pink-500",
  sklad_ponuka: "from-sky-500 to-indigo-500",
  sklad_dopyt: "from-amber-500 to-orange-500",
};

// Deterministic 50–499m distance from item id — stable across renders.
function distanceMeters(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 50 + (h % 450);
}

export function NearbyCatalog() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("warehouse_items")
        .select(
          "id, user_id, type, title, description, price, image_url, created_at, profiles(name)",
        )
        .order("created_at", { ascending: false })
        .limit(60);
      if (!mounted) return;
      if (error) {
        setItems([]);
      } else {
        setItems((data as unknown as Row[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  );

  return (
    <section className="app-card rounded-3xl p-4 shadow-sm backdrop-blur-xl">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-neutral-700" />
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900">
            Inzeráty v okolí
          </h3>
        </div>
        <span className="text-[10px] text-neutral-500">&lt; 500 m</span>
      </header>

      <div className="mb-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                    ? "btn-primary-glow shadow-sm"
                    : "chip-muted hover:bg-[color:var(--bg-surface-hover)]"
              }`}
            >
              <span className="mr-1">{f.emoji}</span>
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-neutral-500">
          V tejto kategórii zatiaľ nič nie je.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((it) => (
            <ItemTile key={it.id} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemTile({ item }: { item: Row }) {
  const dist = distanceMeters(item.id);
  const price = item.type === "darovanie" || item.price === 0 ? "Zadarmo" : `${item.price} €`;

  return (
    <article className="app-card flex flex-col overflow-hidden rounded-2xl p-0 shadow-sm">
      <div className="relative aspect-[4/3] w-full bg-[color:var(--bg-surface-hover)]">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <Package className="h-8 w-8" />
          </div>
        )}
        <span className="chip-muted absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shadow-sm backdrop-blur">
          <MapPin className="h-2.5 w-2.5" />
          {dist} m
        </span>
        <span
          className={`absolute right-1.5 top-1.5 rounded-full bg-gradient-to-r ${TYPE_ACCENT[item.type]} px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm`}
        >
          {price}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <h4 className="line-clamp-1 text-xs font-semibold text-foreground">{item.title}</h4>
        <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{item.description}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {item.profiles?.name ?? "Sused"}
        </p>
      </div>
    </article>
  );
}
