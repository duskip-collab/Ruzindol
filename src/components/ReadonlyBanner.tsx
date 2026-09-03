import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { BanBanner } from "@/components/BanBanner";

export function ReadonlyBanner() {
  const { profile, loading } = useCurrentUser();
  const navigate = useNavigate();
  
  if (loading || !profile) return null;

  if (profile.banned_until) {
    return (
      <div className="mx-3 mt-2">
        <BanBanner profile={profile} variant="compact" />
      </div>
    );
  }

  if (profile.is_active_neighbor) return null;

  return (
    <button
      onClick={() => navigate({ to: "/profil?activation=1" })}
      aria-label="Režim čítania: zadajte pozývací kód pre aktiváciu plného prístupu"
      className="mx-3 mt-2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-left text-xs text-amber-900 shadow-sm backdrop-blur hover:bg-amber-100/90 transition-colors"
    >
      <Lock className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        Režim čítania · zadaj pozývací kód a odomkni pridávanie príspevkov.
      </span>
      <span className="rounded-full bg-amber-900 px-2 py-0.5 text-[10px] font-semibold text-amber-50">
        Aktivovať
      </span>
    </button>
  );
}

export function ReadonlyLock({ onOpen }: { onOpen: () => void }) {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={() => navigate({ to: "/profil?activation=1" })}
      aria-label="Odomknúť plný prístup"
      className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
    >
      <Lock className="h-3 w-3" /> Odomknúť
    </button>
  );
}
