import { useEffect, useMemo, useState } from "react";
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Search, 
  Mail, 
  MapPin, 
  UserPlus, 
  ShieldAlert,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type NeighborProfile = {
  id: string;
  name: string;
  email: string | null;
  street: string | null;
  role: string;
  is_active_neighbor: boolean;
  is_verified: boolean | null;
  created_at: string;
  invited_by_user_id: string | null;
  inviter_name?: string | null;
  invite_code_used?: string | null;
};

export function AdminNeighborsList() {
  const { profile: currentUserProfile } = useCurrentUser();
  const municipalityId = currentUserProfile?.municipality_id;

  const [neighbors, setNeighbors] = useState<NeighborProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "pending">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Načítame profily
      let query = supabase
        .from("profiles")
        .select("id, name, email, street, role, is_active_neighbor, is_verified, created_at, invited_by_user_id")
        .order("created_at", { ascending: false });

      if (municipalityId) {
        query = query.eq("municipality_id", municipalityId);
      }

      const { data: profilesData, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      const loadedProfiles = (profilesData as any[] | null) ?? [];

      if (loadedProfiles.length === 0) {
        setNeighbors([]);
        setLoading(false);
        return;
      }

      // 2. Načítame informácie o použitých pozvánkach z tabuľky invite_codes s väzbou na profil pozývateľa
      const { data: invitesData, error: invitesError } = await supabase
        .from("invite_codes")
        .select("code, used_by, created_by, created_by_profile:profiles!invite_codes_created_by_fkey(name)");

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

      // 3. Spojíme dáta dohromady
      const mappedNeighbors: NeighborProfile[] = loadedProfiles.map((p) => {
        const invInfo = inviteMap[p.id];

        return {
          id: p.id,
          name: p.name,
          email: p.email,
          street: p.street,
          role: p.role,
          is_active_neighbor: p.is_active_neighbor,
          is_verified: p.is_verified,
          created_at: p.created_at,
          invited_by_user_id: p.invited_by_user_id,
          inviter_name: invInfo ? invInfo.inviterName : null,
          invite_code_used: invInfo ? invInfo.code : null,
        };
      });

      setNeighbors(mappedNeighbors);
    } catch (err: any) {
      console.error("Chyba pri načítaní zoznamu susedov:", err);
      setErrorMessage(err?.message || "Nepodarilo sa načítať zoznam obyvateľov.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const channel = supabase
      .channel("admin-neighbors-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void loadData();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [municipalityId]);

  async function toggleVerification(userId: string, currentVerified: boolean | null | undefined) {
    const nextVal = !currentVerified;
    setBusyId(userId);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ 
        is_verified: nextVal, 
        is_active_neighbor: nextVal 
      })
      .eq("id", userId);

    setBusyId(null);
    if (error) {
      setErrorMessage(`Nepodarilo sa zmeniť stav overenia: ${error.message}`);
    } else {
      setSuccessMessage("Stav overenia suseda bol úspešne aktualizovaný.");
      void loadData();
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  }

  const filteredNeighbors = useMemo(() => {
    return neighbors.filter((n) => {
      const matchesSearch = 
        (n.name && n.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (n.email && n.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (n.street && n.street.toLowerCase().includes(searchQuery.toLowerCase()));

      const isVerified = Boolean(n.is_verified || n.is_active_neighbor);
      if (statusFilter === "verified" && !isVerified) return false;
      if (statusFilter === "pending" && isVerified) return false;
      return matchesSearch;
    });
  }, [neighbors, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Načítavam zoznam susedov a väzby pozvánok...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Správa obyvateľov a overovania
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prehľad registrovaných susedov, pôvodných pozvánok a stavu schválenia účtu v obci.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať meno, email, ulicu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center bg-muted p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-md transition-all ${statusFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Všetci ({neighbors.length})
            </button>
            <button
              onClick={() => setStatusFilter("verified")}
              className={`px-3 py-1.5 rounded-md transition-all ${statusFilter === "verified" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Overení
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-md transition-all ${statusFilter === "pending" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Čakajúci
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <th className="py-3 px-4">Obyvateľ / Sused</th>
                <th className="py-3 px-4">Ulica & Rola</th>
                <th className="py-3 px-4">Stav overenia</th>
                <th className="py-3 px-4">Kto ho pozval</th>
                <th className="py-3 px-4">Schválil / Overil</th>
                <th className="py-3 px-4 text-right">Akcie</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filteredNeighbors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    Nenašli sa žiadni obyvatelia zodpovedajúci zvoleným kritériám.
                  </td>
                </tr>
              ) : (
                filteredNeighbors.map((neighbor) => {
                  const isVerified = Boolean(neighbor.is_verified || neighbor.is_active_neighbor);
                  const isBusy = busyId === neighbor.id;

                  return (
                    <tr key={neighbor.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground text-sm">{neighbor.name || "Neznámy používateľ"}</div>
                        <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span>{neighbor.email || "Email neuvedený"}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-foreground">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          <span>{neighbor.street || "Neuvedená ulica"}</span>
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-secondary text-secondary-foreground">
                            {neighbor.role || "Sused"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Overený sused
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" />
                            Čaká na overenie
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {neighbor.inviter_name ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-foreground flex items-center gap-1">
                              <UserPlus className="w-3 h-3 text-primary" />
                              {neighbor.inviter_name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              (cez pozvánku)
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 italic">
                            Bez invite kódu
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isVerified ? (
                          <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>Schválené / Aktivované</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Zatiaľ neschválené</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          disabled={isBusy}
                          onClick={() => toggleVerification(neighbor.id, neighbor.is_verified)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                            isVerified
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isVerified ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              Zrušiť overenie
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              Schváliť / Overiť
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}