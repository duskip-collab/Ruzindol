import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Search, Users, Check, Clock, UserPlus, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Toast } from "@/components/Toast";

type Neighbor = {
  id: string;
  name: string;
  street: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  invited_by_name: string | null;
  invite_code_used: string | null;
};

export const Route = createFileRoute("/_authenticated/susedia")({
  beforeLoad: async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw redirect({ to: "/nastenka" });

    const [{ data: profile }, { data: adminRole }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    if (!adminRole && profile?.role !== "Starosta" && profile?.role !== "Uradnik") {
      throw redirect({ to: "/nastenka" });
    }
  },
  component: NeighborsScreen,
});

function NeighborsScreen() {
  const [search, setSearch] = useState("");
  const { profile } = useCurrentUser();
  const municipalityId = profile?.municipality_id;
  const userRole = profile?.role;
  
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  
  const isAdminOrMayor = userRole === "admin" || userRole === "Starosta" || userRole === "Uradnik";

  const { data: neighbors, error, isLoading, refetch } = useQuery({
    queryKey: ["neighbors-management", municipalityId],
    enabled: Boolean(municipalityId),
    queryFn: async () => {
      // 1. Načítame profily v obci
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, street, avatar_url, is_verified, is_active_neighbor")
        .eq("municipality_id", municipalityId!)
        .order("name");

      if (profilesError) throw profilesError;
      if (!profilesData) return [];

      // 2. Načítame informácie o použitých pozvánkach z tabuľky invite_codes
      const { data: invitesData, error: invitesError } = await supabase
        .from("invite_codes")
        .select("code, used_by, created_by, created_by_profile:profiles!invite_codes_created_by_fkey(name)");

      // Vytvoríme mapu pre rýchle vyhľadanie: used_by_id -> { inviterName, code }
      const inviteMap: Record<string, { inviterName: string; code: string }> = {};
      if (!invitesError && invitesData) {
        (invitesData as any[]).forEach((inv) => {
          if (inv.used_by) {
            inviteMap[inv.used_by] = {
              inviterName: inv.created_by_profile?.name || "Neznámy sused",
              code: inv.code,
            };
          }
        });
      }

      // Spojíme dáta dohromady
      return profilesData.map((row: any) => {
        const invInfo = inviteMap[row.id];
        const verified = Boolean(row.is_verified || row.is_active_neighbor);
        
        return {
          id: row.id,
          name: row.name || "Sused",
          street: row.street,
          avatar_url: row.avatar_url,
          is_verified: verified,
          invited_by_name: invInfo ? invInfo.inviterName : null,
          invite_code_used: invInfo ? invInfo.code : null,
        };
      }) as Neighbor[];
    },
  });

  async function handleVerifyNeighbor(neighborId: string) {
    if (!isAdminOrMayor) {
      setVerifyError("Len admin alebo starosta môžu overovať susedov.");
      return;
    }

    setVerifyingId(neighborId);
    setVerifyError(null);
    setVerifySuccess(null);

    try {
      // Pokus o volanie RPC funkcie, ak existuje v DB
      const { error: rpcError } = await supabase.rpc("verify_neighbor_manual", {
        _neighbor_id: neighborId,
        target_user_id: neighborId,
      });

      // Ak RPC zlyhá alebo neexistuje, urobíme priamy update profilu
      if (rpcError) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ is_verified: true, is_active_neighbor: true })
          .eq("id", neighborId);

        if (updateError) throw updateError;
      }

      setVerifySuccess("Sused bol úspešne overený!");
      setTimeout(() => setVerifySuccess(null), 3000);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Overenie sa nepodarilo";
      setVerifyError(message);
      setTimeout(() => setVerifyError(null), 4000);
    } finally {
      setVerifyingId(null);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredNeighbors = (neighbors ?? []).filter((neighbor) =>
    `${neighbor.name} ${neighbor.street ?? ""}`.toLowerCase().includes(normalizedSearch),
  );

  return (
    <div className="mx-auto h-full w-full max-w-5xl overflow-y-auto p-4 pb-24 md:px-6 md:py-6">
      <header className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Susedia v obci</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Správa obyvateľov a overovania
          </p>
        </div>
      </header>

      <label className="relative mt-5 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hľadať podľa mena alebo ulice"
          className="app-input w-full rounded-2xl py-3 pl-9 pr-4 text-sm outline-none border border-border bg-card"
          type="search"
        />
      </label>

      {verifyError && <div className="mt-4"><Toast message={verifyError} variant="error" /></div>}
      {verifySuccess && <div className="mt-4"><Toast message={verifySuccess} variant="success" /></div>}

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {error && <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">Susedov sa nepodarilo načítať.</p>}
      {!isLoading && !error && filteredNeighbors.length === 0 && <p className="mt-6 text-center text-sm text-muted-foreground">Žiadni susedia nezodpovedajú vyhľadávaniu.</p>}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {filteredNeighbors.map((neighbor) => (
          <article key={neighbor.id} className="app-card flex items-start gap-3 rounded-2xl p-4 shadow-sm border border-border bg-card">
            {neighbor.avatar_url ? (
              <img src={neighbor.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-700">
                {neighbor.name.trim().charAt(0).toUpperCase() || "S"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-foreground text-sm">{neighbor.name || "Sused"}</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{neighbor.street || "Ulica neuvedená"}</p>
              
              {/* Stav overenia */}
              <div className="mt-2">
                {neighbor.is_verified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Overený sused
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Clock className="h-3.5 w-3.5" /> Čaká na overenie
                  </span>
                )}
              </div>

              {/* Informácie o pozvánke / kóde */}
              <div className="mt-2 text-xs">
                {neighbor.invited_by_name ? (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Pozval ho: <strong className="text-foreground">{neighbor.invited_by_name}</strong></span>
                  </p>
                ) : (
                  <p className="text-amber-600 dark:text-amber-400 italic">
                    Bez invite kódu (registratúra bez pozvánky)
                  </p>
                )}
              </div>
              
              {/* Tlačidlo overenia - iba pre admina/starostu a neoverených */}
              {isAdminOrMayor && !neighbor.is_verified && (
                <button
                  onClick={() => handleVerifyNeighbor(neighbor.id)}
                  disabled={verifyingId === neighbor.id}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors w-full shadow-sm"
                  title="Manuálne overiť tohto suseda"
                >
                  {verifyingId === neighbor.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Overovanie...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Schváliť / Overiť
                    </>
                  )}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}