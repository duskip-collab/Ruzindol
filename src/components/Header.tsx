import { Bell, LogOut, Moon, Sun } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useCurrentUser";
import { useTheme } from "@/context/ThemeContext";

export function Header({ profile }: { profile: Profile | null }) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials =
    profile?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <header className="glass-panel flex items-center justify-between border-x-0 border-t-0 px-5 py-3.5 z-50 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-glow shadow-lg shadow-brand/25">
          <span className="text-sm font-bold text-brand-foreground">K</span>
        </div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Komunita
        </h1>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label={theme === "dark" ? "Zapnúť svetlý režim" : "Zapnúť tmavý režim"}
        >
          {theme === "dark" ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="Notifikácie"
        >
          <Bell size={17} strokeWidth={2} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </button>
        <div
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-glow text-[11px] font-semibold text-brand-foreground shadow-md shadow-brand/20"
          title={profile?.name ?? ""}
        >
          {initials}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="Odhlásiť sa"
        >
          <LogOut size={15} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
