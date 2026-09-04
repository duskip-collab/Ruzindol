import { useEffect, useState } from "react";
import { Loader2, Users, ActivitySquare, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  total_registered: number;
  active_today: number;
  active_this_month: number;
} | null;

export function CommunityStats({ municipalityId }: { municipalityId: string | null }) {
  const [stats, setStats] = useState<Stats>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      try {
        setLoading(true);
        setError(null);

        console.log("CommunityStats: Loading with municipalityId:", municipalityId);

        const { data, error: queryError } = await supabase.rpc(
          "get_community_statistics",
          { _municipality_id: municipalityId },
        );

        console.log("CommunityStats RPC response:", { data, error: queryError });

        if (queryError) throw queryError;

        if (mounted) {
          const statsData = data?.[0] ?? null;
          console.log("CommunityStats parsed stats:", statsData);
          setStats(statsData);
        }
      } catch (err) {
        console.error("Failed to load community stats:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Nepodarilo sa načítať štatistiky");
          setStats(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadStats();

    return () => {
      mounted = false;
    };
  }, [municipalityId]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      </section>
    );
  }

  if (error || !stats) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">Štatistiky komunity</p>
            <p className="text-[11px] text-neutral-500">Aktivita a počty susedov</p>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
        {!stats && <p className="mt-3 text-xs text-neutral-500">Žiadne údaje k dispozícii</p>}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            Štatistiky komunity
          </p>
          <p className="text-[11px] text-neutral-500">Aktivita a počty susedov</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/50 bg-white/70 p-3 text-center dark:border-neutral-300 dark:bg-neutral-200">
          <p className="flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4 text-emerald-600" />
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-900">
              {stats.total_registered}
            </span>
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-800">
            Registrovaní susedia
          </p>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-3 text-center dark:border-neutral-300 dark:bg-neutral-200">
          <p className="flex items-center justify-center gap-1.5">
            <ActivitySquare className="h-4 w-4 text-blue-600" />
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-900">
              {stats.active_today}
            </span>
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-800">
            Aktívni dnes
          </p>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-3 text-center dark:border-neutral-300 dark:bg-neutral-200">
          <p className="flex items-center justify-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-900">
              {stats.active_this_month}
            </span>
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-800">
            Aktívni mesiac
          </p>
        </div>
      </div>
    </section>
  );
}
