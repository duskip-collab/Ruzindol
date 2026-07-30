import { MessageCircle, Megaphone, Newspaper, Package, User } from "lucide-react";

export type Tab = "nastenka" | "aktuality" | "sklad" | "spravy" | "profil";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: typeof Newspaper }[] = [
  { id: "nastenka", label: "Nástenka", icon: Newspaper },
  { id: "aktuality", label: "Aktuality", icon: Megaphone },
  { id: "sklad", label: "Sklad", icon: Package },
  { id: "spravy", label: "Správy", icon: MessageCircle },
  { id: "profil", label: "Profil", icon: User },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="glass-panel relative z-50 mx-3 mb-3 grid shrink-0 grid-cols-5 items-center gap-1 rounded-[1.75rem] px-2 py-2 pb-safe md:mx-4 md:mb-4">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.25rem] px-1 py-2 transition-all active:scale-95 ${
              isActive
                ? "bg-white text-brand shadow-md shadow-brand/10"
                : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
            }`}
          >
            <span
              className={`grid h-8 w-14 place-items-center rounded-2xl transition-all ${
                isActive
                  ? "bg-gradient-to-br from-brand/15 to-brand-glow/10"
                  : "bg-transparent"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.4 : 1.9}
              />
            </span>
            <span
              className={`text-[10px] leading-tight tracking-wide ${
                isActive ? "font-semibold" : "font-medium"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
