import { Bell, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useCurrentUser";
import ruzindolErb from "@/assets/ruzindol-erb.png";
import { cn } from "@/lib/utils";

export function Header({
  profile,
  hasNotificationDot,
  onBellClick,
  className,
  subtitle = "Komunitná aplikácia",
}: {
  profile: Profile | null;
  hasNotificationDot: boolean;
  onBellClick: () => void;
  className?: string;
  subtitle?: string;
}) {
  const navigate = useNavigate();

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
    <header
      className={cn(
        "glass-panel relative z-50 flex shrink-0 items-center justify-between rounded-[1.75rem] px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white/80 shadow-lg shadow-brand/15 ring-1 ring-border/60">
          <img
            src={ruzindolErb}
            alt="Erb obce Ružindol"
            className="h-full w-full object-contain"
          />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Ružindol
          </h1>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBellClick}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-white/70 text-muted-foreground shadow-sm transition-all hover:bg-white hover:text-foreground active:scale-95"
          aria-label="Notifikácie"
        >
          <Bell size={17} strokeWidth={2} />
          {hasNotificationDot && (
            <span className="absolute right-[0.7rem] top-[0.7rem] h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </button>
        <div
          className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-glow text-[11px] font-semibold text-brand-foreground shadow-md shadow-brand/20"
          title={profile?.name ?? ""}
        >
          {initials}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-white/70 text-muted-foreground shadow-sm transition-all hover:bg-white hover:text-foreground active:scale-95"
          aria-label="Odhlásiť sa"
        >
          <LogOut size={15} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
