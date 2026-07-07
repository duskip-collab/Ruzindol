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
    <nav className="glass-panel relative flex items-center justify-around border-x-0 border-b-0 pb-safe z-50 shrink-0">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`group relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all active:scale-95 ${
              isActive
                ? "text-brand"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`grid h-8 w-14 place-items-center rounded-2xl transition-all ${
                isActive
                  ? "bg-gradient-to-br from-brand/15 to-brand-glow/10 shadow-sm"
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
