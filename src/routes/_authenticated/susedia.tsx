import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Search, Users } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Neighbor = {
  id: string;
  name: string;
  street: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  invited_by: { id: string; name: string } | null;
};

export const Route = createFileRoute("/_authenticated/susedia")({
  component: NeighborsScreen,
});

function NeighborsScreen() {
  const [search, setSearch] = useState("");
  const { profile } = useCurrentUser();
  const municipalityId = profile?.municipality_id;
  const { data: neighbors, error, isLoading } = useQuery({
    queryKey: ["verified-neighbors", municipalityId],
    enabled: Boolean(municipalityId),
    queryFn: async () => {
      // Pokus o načítanie s novými poliami (ak existuje migrácia)
      const primaryQuery = await supabase
        .from("profiles")
        .select("id, name, street, avatar_url, is_verified, invited_by:invited_by_user_id(id, name)")
        .eq("is_verified", true)
        .eq("municipality_id", municipalityId!)
        .order("name");

      if (!primaryQuery.error && primaryQuery.data) {
        return (primaryQuery.data as unknown as Neighbor[]) ?? [];
      }

      // Bezpečný fallback na štandardné stĺpce v produkčnej Supabase databáze
      const fallbackQuery = await supabase
        .from("profiles")
        .select("id, name, street, is_active_neighbor")
        .eq("is_active_neighbor", true)
        .eq("municipality_id", municipalityId!)
        .order("name");

      if (fallbackQuery.error) throw fallbackQuery.error;

      return (fallbackQuery.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        street: row.street,
        avatar_url: null,
        is_verified: Boolean(row.is_active_neighbor),
        invited_by: null,
      }));
    },
  });

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
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Overení členovia komunity
          </p>
        </div>
      </header>

      <label className="relative mt-5 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hľadať podľa mena alebo ulice"
          className="app-input w-full rounded-2xl py-3 pl-9 pr-4 text-sm outline-none"
          type="search"
        />
      </label>

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {error && <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">Susedov sa nepodarilo načítať.</p>}
      {!isLoading && !error && filteredNeighbors.length === 0 && <p className="mt-6 text-center text-sm text-muted-foreground">Žiadni susedia nezodpovedajú vyhľadávaniu.</p>}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {filteredNeighbors.map((neighbor) => (
          <article key={neighbor.id} className="app-card flex items-start gap-3 rounded-2xl p-4 shadow-sm">
            {neighbor.avatar_url ? (
              <img src={neighbor.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-700">
                {neighbor.name.trim().charAt(0).toUpperCase() || "S"}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-foreground">{neighbor.name || "Sused"}</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">{neighbor.street || "Ulica neuvedená"}</p>
              {neighbor.is_verified && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Overený sused</span>}
              {neighbor.invited_by && <p className="mt-2 text-xs text-muted-foreground">Pozval/a: {neighbor.invited_by.name}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}