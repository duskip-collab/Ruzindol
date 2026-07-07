import { useEffect, useMemo, useState } from "react";
import { Loader2, Shield, Trash2, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRole } from "@/hooks/useCurrentUser";

type ManagedNeighbor = {
  id: string;
  name: string | null;
  street: string | null;
  role: ProfileRole;
  is_active_neighbor: boolean;
  banned_until: string | null;
  is_deleted: boolean;
};

const FILTERS = [
  { value: "all", label: "Všetci" },
  { value: "active", label: "Aktívni" },
  { value: "banned", label: "Zabanovaní" },
  { value: "deleted", label: "Vymazaní" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

function formatStatus(neighbor: ManagedNeighbor) {
  if (neighbor.is_deleted) return "Vymazaný";
  if (neighbor.banned_until) {
    const until = new Date(neighbor.banned_until);
    return `Banned do ${until.toLocaleDateString("sk-SK")} ${until.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return neighbor.is_active_neighbor ? "Aktívny" : "Nevybraný";
}

function statusFilter(neighbor: ManagedNeighbor, filter: FilterValue) {
  if (filter === "all") return true;
  if (filter === "active") return !neighbor.is_deleted && !neighbor.banned_until;
  if (filter === "banned") return !!neighbor.banned_until && !neighbor.is_deleted;
  if (filter === "deleted") return neighbor.is_deleted;
  return true;
}

export function ModerationDashboard({ currentUserId }: { currentUserId: string }) {
  const [neighbors, setNeighbors] = useState<ManagedNeighbor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [error, setError] = useState<string | null>(null);

  const loadNeighbors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, street, role, is_active_neighbor, banned_until, is_deleted")
      .neq("id", currentUserId)
      .order("name", { ascending: true })
      .limit(300);

    if (error) {
      setError(error.message);
      setNeighbors([]);
    } else {
      setNeighbors((data as ManagedNeighbor[] | null) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadNeighbors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const filteredNeighbors = useMemo(
    () => neighbors.filter((neighbor) => statusFilter(neighbor, filter)),
    [filter, neighbors],
  );

  const update = async (id: string, action: "ban" | "unban" | "delete") => {
    setBusyId(id);
    setError(null);
    let result;

    if (action === "ban") {
      result = await supabase.rpc("ban_neighbor", { target_id: id, days: 3 });
    } else if (action === "unban") {
      result = await supabase.rpc("unban_neighbor", { target_id: id });
    } else {
      if (!confirm("Naozaj natrvalo vymazať tohto suseda?")) {
        setBusyId(null);
        return;
      }
      result = await supabase.rpc("delete_neighbor", { target_id: id });
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      await loadNeighbors();
    }
    setBusyId(null);
  };

  return (
    <div className="rounded-3xl border border-neutral-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Moderácia susedov
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Zoznam registrovaných susedov, stav banov a možnosť spravovať profil.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
              filter === option.value
                ? "bg-indigo-600 text-white"
                : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-xs text-rose-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      ) : filteredNeighbors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500 dark:border-white/10 dark:bg-white/5">
          Žiadni susedia pre tento filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNeighbors.map((neighbor) => (
            <div
              key={neighbor.id}
              className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {neighbor.name || "Bez mena"}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                    {neighbor.street || "Ulica nie je uvedená"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="rounded-full bg-neutral-100 px-2 py-1 dark:bg-white/10">
                      {neighbor.role}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 dark:bg-white/10">
                      {formatStatus(neighbor)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!neighbor.is_deleted && (
                    <>
                      {neighbor.banned_until ? (
                        <button
                          type="button"
                          disabled={busyId === neighbor.id}
                          onClick={() => void update(neighbor.id, "unban")}
                          className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === neighbor.id ? "Čakajte…" : "Odomknúť"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === neighbor.id}
                          onClick={() => void update(neighbor.id, "ban")}
                          className="rounded-2xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === neighbor.id ? "Čakajte…" : "Ban 3 dni"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === neighbor.id}
                        onClick={() => void update(neighbor.id, "delete")}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                      >
                        {busyId === neighbor.id ? "Čakajte…" : "Vymazať"}
                      </button>
                    </>
                  )}
                  {neighbor.is_deleted && (
                    <span className="rounded-2xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-500 dark:bg-white/10">
                      Profil vymazaný
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
