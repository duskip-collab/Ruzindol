import { useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  Newspaper,
  Radio,
  Recycle,
  type LucideIcon,
} from "lucide-react";

import { useHlasnikFeed, type FeedItem, type FeedSource } from "@/hooks/useHlasnikFeed";
import { triggerHaptic } from "@/lib/haptics";

type SourceMeta = {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
};

/** Malá ikonka a farebný štítok podľa typu položky. */
const SOURCE_META: Record<FeedSource, SourceMeta> = {
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
};

/**
 * Kompaktný dátum do pätičky kartičky.
 * Najbližšie dni relatívne („DNES“, „ZAJTRA“, „VČERA“), inak krátky tvar „22. SEP“
 * (pri inom roku doplnený o rok), aby zaberal minimum miesta.
 */
function cardDate(iso: string) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";

  const now = new Date();
  const target = new Date(ts);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  const dayDiff = Math.round((startOfTarget - startOfToday) / 86400000);

  if (dayDiff === 0) return "DNES";
  if (dayDiff === 1) return "ZAJTRA";
  if (dayDiff === -1) return "VČERA";

  const month = target
    .toLocaleDateString("sk-SK", { month: "short" })
    .replace(".", "")
    .toLocaleUpperCase("sk-SK");
  const withMonth = `${target.getDate()}. ${month}`;

  if (target.getFullYear() === now.getFullYear()) return withMonth;
  return `${withMonth} ${target.getFullYear()}`;
}

/** Plný popis pre tooltip (na dotykových zariadeniach sa nezobrazuje, ale nič nekazí). */
function tooltipFor(item: FeedItem) {
  return item.meta ? `${item.title} · ${item.meta}` : item.title;
}

/**
 * Obecný hlásnik – kompaktný prehľad najnovších oficiálnych informácií:
 * RSS aktuality, udalosti z kalendára a termíny vývozu odpadu.
 *
 * Položky sú malé kartičky v jednom vodorovne posúvateľnom riadku (bez viditeľného
 * scrollbaru). Každá kartička má hore ikonku so štítkom zdroja, názov na max. 2 riadky
 * a dole kompaktný dátum. Kliknutie presmeruje na príslušnú záložku. Susedské príspevky
 * a sklad tu nie sú – majú vlastné záložky a nesmú sa duplikovať.
 *
 * Ak nie sú k dispozícii žiadne dáta, komponent sa vôbec nevykreslí.
 */
export function ObecnyHlasnik() {
  const navigate = useNavigate();
  const { items } = useHlasnikFeed();

  const handleOpen = useCallback(
    (item: FeedItem) => {
      triggerHaptic("light");

      if (item.source === "aktuality") {
        void navigate({ to: "/aktuality", search: { tile: "oznamy", sub: "rss" } });
        return;
      }

      if (item.source === "odpad") {
        void navigate({ to: "/kalendar", search: { category: "odpad" } });
        return;
      }

      void navigate({ to: "/kalendar" });
    },
    [navigate],
  );

  // Bez dát sa komponent nevykreslí (žiadny prázdny box ani hláška o chýbajúcich dátach).
  if (items.length === 0) return null;

  return (
    <section className="pt-3">
      <header className="flex items-center justify-between gap-2 px-4 pb-1.5 md:px-6">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" />
          Obecný hlásnik
        </h2>
        <Link to="/aktuality" className="text-[11px] font-medium text-primary hover:underline">
          Všetky aktuality
        </Link>
      </header>

      {/* Vodorovný posuvný pruh kartičiek – jeden riadok, skrytý scrollbar, snap na kartičku. */}
      <div className="scrollbar-none flex flex-nowrap snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 pt-0.5 md:px-6 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const meta = SOURCE_META[item.source];
          const Icon = meta.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleOpen(item)}
              title={tooltipFor(item)}
              aria-label={`${meta.label}: ${item.title}`}
              className="group flex w-36 shrink-0 snap-start flex-col rounded-2xl border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] p-2.5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
            >
              {/* Ikonka zdroja + farebný štítok */}
              <span className="flex items-center gap-1.5">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${meta.iconClass}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <span
                  className={`truncate rounded-full border px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
                >
                  {meta.label}
                </span>
              </span>

              {/* Názov – vždy max. 2 riadky, aby výška kartičky nerástla */}
              <span className="mt-1.5 line-clamp-2 min-h-[1.9rem] text-[11px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                {item.title}
              </span>

              {/* Pätička – kompaktný dátum + šípka */}
              <span className="mt-auto flex items-center justify-between gap-1 border-t border-[color:var(--border-card)] pt-1.5">
                <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {cardDate(item.date)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
