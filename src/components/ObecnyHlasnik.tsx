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

/** Krátky dátum pre kompaktný riadok (dnes / zajtra / včera / d. m.). */
function compactDate(iso: string) {
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

  if (dayDiff === 0) return "dnes";
  if (dayDiff === 1) return "zajtra";
  if (dayDiff === -1) return "včera";
  if (dayDiff < -1 && dayDiff >= -7) return `pred ${Math.abs(dayDiff)} d.`;

  return target.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
}

/** Plný popis pre tooltip (na dotykových zariadeniach sa nezobrazuje, ale nič nekazí). */
function tooltipFor(item: FeedItem) {
  return item.meta ? `${item.title} · ${item.meta}` : item.title;
}

/**
 * Obecný hlásnik – kompaktný prehľad najnovších oficiálnych informácií:
 * RSS aktuality, udalosti z kalendára a termíny vývozu odpadu.
 *
 * Každá položka je jeden nízky riadok (ikonka · štítok · názov · dátum · šípka),
 * kliknutie presmeruje na príslušnú záložku. Susedské príspevky a sklad tu nie sú –
 * majú vlastné záložky a nesmú sa duplikovať.
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
        void navigate({ to: "/aktuality" });
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
    <div className="px-4 pt-3 md:px-6">
      <section className="rounded-2xl border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] px-2 py-1.5 shadow-sm">
        <header className="flex items-center justify-between px-1 pb-0.5 pt-1">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Obecný hlásnik
          </h2>
          <Link to="/aktuality" className="text-[11px] font-medium text-primary hover:underline">
            Všetky aktuality
          </Link>
        </header>

        <ul className="divide-y divide-[color:var(--border-card)]">
          {items.map((item) => {
            const meta = SOURCE_META[item.source];
            const Icon = meta.icon;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  title={tooltipFor(item)}
                  className="group flex min-h-11 w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${meta.iconClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>

                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                    {item.title}
                  </span>

                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {compactDate(item.date)}
                  </span>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
