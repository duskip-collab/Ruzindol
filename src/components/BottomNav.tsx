import { MessageCircle, Megaphone, Newspaper, Package, User, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type Tab = "nastenka" | "aktuality" | "sklad" | "spravy" | "profil" | "susedia";

interface BottomNavProps {
  activeTab: Tab;
  showNeighbors?: boolean;
  layout?: "bottom" | "sidebar";
  className?: string;
}

export const NAV_TABS: { id: Tab; label: string; icon: typeof Newspaper }[] = [
  { id: "nastenka", label: "Nástenka", icon: Newspaper },
  { id: "aktuality", label: "Aktuality", icon: Megaphone },
  { id: "sklad", label: "Sklad", icon: Package },
  { id: "spravy", label: "Správy", icon: MessageCircle },
  { id: "profil", label: "Profil", icon: User },
  { id: "susedia", label: "Susedia", icon: Users },
];

export function BottomNav({
  activeTab,
  showNeighbors = false,
  layout = "bottom",
  className,
}: BottomNavProps) {
  const visibleTabs = showNeighbors ? NAV_TABS : NAV_TABS.filter((tab) => tab.id !== "susedia");

  if (layout === "sidebar") {
    return (
      <nav role="tablist" aria-label="Bočná navigácia aplikácie" className={cn("flex flex-col gap-1", className)}>
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to={`/${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              type="button"
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all",
                isActive
                  ? "nav-tab-active"
                  : "nav-tab-idle",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl transition-all",
                  isActive ? "bg-gradient-to-br from-brand/15 to-brand-glow/10" : "bg-transparent",
                )}
              >
                <Icon size={18} strokeWidth={isActive ? 2.4 : 1.9} />
              </span>
              <span className={cn("text-sm", isActive ? "font-semibold" : "font-medium")}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      role="tablist"
      aria-label="Hlavná navigácia aplikácie"
      className={cn(
        "glass-panel bottom-nav relative z-50 grid shrink-0 items-center gap-1 rounded-[1.75rem] px-2 py-2 pb-safe",
        visibleTabs.length === 6 ? "grid-cols-6" : "grid-cols-5",
        className,
      )}
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={`/${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            type="button"
            className={`group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.25rem] px-1 py-2 transition-all active:scale-95 ${
              isActive
                ? "nav-tab-active"
                : "nav-tab-idle"
            }`}
          >
            <span
              className={`grid h-8 w-14 place-items-center rounded-2xl transition-all ${
                isActive ? "bg-gradient-to-br from-brand/15 to-brand-glow/10" : "bg-transparent"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
            </span>
            <span
              className={`text-[10px] leading-tight tracking-wide ${
                isActive ? "font-semibold" : "font-medium"
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
