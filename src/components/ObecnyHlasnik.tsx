import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  Megaphone,
  Newspaper,
  Package,
  Radio,
  Recycle,
  type LucideIcon,
} from "lucide-react";

import { useHlasnikFeed, type FeedItem, type FeedSource } from "@/hooks/useHlasnikFeed";
import { triggerHaptic } from "@/lib/haptics";
import type { WarehouseItemType } from "@/lib/warehouse";

type SourceMeta = {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
};

/** Farebný štítok a ikona podľa zdroja položky (Oznam, Aktuality, Kalendár, Odpad, Sklad). */
const SOURCE_META: Record<FeedSource, SourceMeta> = {
  oznam: {
    label: "Oznam",
    icon: Megaphone,
    iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    badgeClass: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  aktuality: {
    label: "Aktuality",
    icon: Newspaper,
    iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    badgeClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  kalendar: {
    label: "Kalendár",
    icon: CalendarDays,
    iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    badgeClass: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  odpad: {
    label: "Odpad",
    icon: Recycle,
    iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    badgeClass: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  sklad: {
    label: "Susedský sklad",
    icon: Package,
    iconClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    badgeClass: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
};

/** Spätná navigácia v detaile položky skladu (rovnaký tvar ako v SkladScreen). */
function warehouseSearch(type?: WarehouseItemType) {
  if (type === "trh" || type === "darovanie") {
    return { returnTo: "sklad" as const, section: type };
  }
  if (type === "sklad_ponuka" || type === "sklad_dopyt") {
    return {
      returnTo: "sklad" as const,
      section: "poziciovna" as const,
      tab: type === "sklad_ponuka" ? ("ponuka" as const) : ("dopyt" as const),
    };
  }
  return { returnTo: "sklad" as const };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "pred chvíľou";
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  if (s < 30 * 86400) return `pred ${Math.floor(s / 86400)} dňami`;
  return new Date(iso).toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/** Dátum položky: budúce termíny (kalendár, odpad) relatívne, ostatné ako „pred …“. */
function formatFeedDate(iso: string) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";

  const now = new Date();
  if (ts <= now.getTime()) return timeAgo(iso);

  const target = new Date(ts);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  const dayDiff = Math.round((startOfTarget - startOfToday) / 86400000);
  const time = target.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });

  if (dayDiff === 0) return `dnes ${time}`;
  if (dayDiff === 1) return `zajtra ${time}`;
  return `${target.toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })} ${time}`;
}

/**
 * Obecný hlásnik – jednotná dynamická časová os najnovších informácií z viacerých
 * zdrojov (oznamy, aktuality, kalendár, harmonogram vývozu, susedský sklad).
 *
 * Ak nie sú k dispozícii žiadne dáta, komponent sa vôbec nevykreslí.
 */
export function ObecnyHlasnik() {
  const navigate = useNavigate();
  const { items } = useHlasnikFeed();

  const handleOpen = useCallback(
    (item: FeedItem) => {
      triggerHaptic("light");

      switch (item.source) {
        case "aktuality":
          void navigate({ to: "/aktuality" });
          return;
        case "kalendar":
          void navigate({ to: "/kalendar" });
          return;
        case "odpad":
          void navigate({ to: "/kalendar", search: { category: "odpad" } });
          return;
        case "sklad":
          if (item.itemId) {
            void navigate({
              to: "/warehouse/$itemId",
              params: { itemId: item.itemId },
              search: warehouseSearch(item.warehouseType),
            });
            return;
          }
          void navigate({ to: "/sklad" });
          return;
        case "oznam":
        default:
          void navigate({ to: "/nastenka" });
      }
    },
    [navigate],
  );

  // Bez dát sa komponent nevykreslí (žiadne prázdne boxy ani hlášky o chýbajúcich dátach).
  if (items.length === 0) return null;

  return (
    <div className="px-4 pt-3 md:px-6">
      <section className="rounded-2xl border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] p-3.5 shadow-sm">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Obecný hlásnik
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Najnovšie zo všetkých zdrojov na jednom mieste
              </p>
            </div>
          </div>
          <span className="chip-muted shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
            {items.length} {items.length === 1 ? "novinka" : "noviniek"}
          </span>
        </header>

        <ul className="mt-3 space-y-1">
          {items.map((item) => {
            const meta = SOURCE_META[item.source];
            const Icon = meta.icon;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  className="group flex w-full items-start gap-2.5 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-muted/60"
                >
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.iconClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatFeedDate(item.date)}
                      </span>
                    </span>

                    <span className="mt-1 block truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                      {item.title}
                    </span>

                    {item.snippet && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">
                        {item.snippet}
                      </span>
                    )}

                    {item.meta && (
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {item.meta}
                      </span>
                    )}
                  </span>

                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
