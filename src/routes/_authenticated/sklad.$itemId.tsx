import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ActiveNeighborBadge } from "@/components/ActiveNeighborBadge";
import { WarehouseItemEditForm } from "@/components/WarehouseItemEditForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  formatWarehouseExpiry,
  getWarehouseLifetimeLabel,
  getWarehouseRemainingLabel,
  type WarehouseItemType,
} from "@/lib/warehouse";
import { z } from "zod";

const detailSearchSchema = z.object({
  returnTo: z.enum(["profil"]).optional(),
  section: z.enum(["items"]).optional(),
});

type WarehouseItemDetail = {
  id: string;
  type: WarehouseItemType;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  image_url_4: string | null;
  image_path: string | null;
  image_path_2: string | null;
  image_path_3: string | null;
  image_path_4: string | null;
  created_at: string;
  expires_at: string | null;
  profiles: {
    name: string;
    street: string | null;
    is_active_neighbor: boolean | null;
  } | null;
};

export const Route = createFileRoute("/_authenticated/sklad/$itemId")({
  validateSearch: detailSearchSchema,
  component: WarehouseItemDetailScreen,
});

function WarehouseItemDetailScreen() {
  const { itemId } = Route.useParams();
  const { returnTo, section } = Route.useSearch();
  const backToProfile = returnTo === "profil" && section === "items";
  const { userId } = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const { data: item, error, isLoading, refetch } = useQuery({
    queryKey: ["warehouse-item", itemId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("warehouse_items")
        .select(
          "id, user_id, type, title, description, price, image_url, image_url_2, image_url_3, image_url_4, image_path, image_path_2, image_path_3, image_path_4, created_at, expires_at, profiles(name, street, is_active_neighbor)",
        )
        .eq("id", itemId)
        .maybeSingle();

      if (queryError) throw queryError;
      return data as WarehouseItemDetail | null;
    },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">Položku sa nepodarilo načítať.</p>
        <BackLink backToProfile={backToProfile} />
      </div>
    );
  }

  const itemType = item.type as WarehouseItemType;
  const priceLabel = item.price > 0 ? `${item.price} €` : "Zadarmo";

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground">
      <div className="mx-auto min-h-full w-full max-w-5xl p-4 pb-24 md:px-8 md:py-8">
        <BackLink backToProfile={backToProfile} />
        <article className="app-card mt-4 overflow-hidden rounded-3xl p-5 shadow-sm md:p-7">
        <div className="grid gap-3 sm:grid-cols-2">
          {[item.image_url, item.image_url_2, item.image_url_3, item.image_url_4]
            .filter((url): url is string => Boolean(url))
            .map((url) => <img key={url} src={url} alt={item.title} className="max-h-[52vh] w-full rounded-2xl object-cover" />)}
        </div>
        <div className="mt-5 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{item.title}</h1>
          <span className="shrink-0 rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">{priceLabel}</span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="chip-muted rounded-full px-2.5 py-1">Platnosť {getWarehouseLifetimeLabel(itemType)}</span>
          <span className="chip-muted rounded-full px-2.5 py-1">{getWarehouseRemainingLabel(itemType, item.created_at, Date.now(), item.expires_at)}</span>
        </div>
        <div className="mt-6 border-t border-[color:var(--border-card)] pt-4">
          <p className="text-xs text-muted-foreground">Vlastník položky</p>
          <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
            {item.profiles?.name ?? "Sused"}
            {item.profiles?.is_active_neighbor && <ActiveNeighborBadge compact />}
          </p>
          {item.profiles?.street && <p className="mt-1 text-sm text-muted-foreground">{item.profiles.street}</p>}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">Expiruje {formatWarehouseExpiry(itemType, item.created_at, item.expires_at)}</p>
        {userId === item.user_id && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-primary-glow mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <Pencil className="h-4 w-4" /> Upraviť inzerát
          </button>
        )}
        </article>
      </div>
      {editing && (
        <WarehouseItemEditForm
          item={item}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await refetch();
          }}
        />
      )}
    </div>
  );
}

function BackLink({ backToProfile }: { backToProfile: boolean }) {
  if (backToProfile) {
    return (
      <Link
        to="/profil"
        search={{ section: "items" }}
        className="btn-secondary-surface inline-flex items-center gap-2 px-3 py-2 text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Späť do Profilu
      </Link>
    );
  }

  return (
    <Link to="/sklad" className="btn-secondary-surface inline-flex items-center gap-2 px-3 py-2 text-sm font-medium">
      <ArrowLeft className="h-4 w-4" /> Späť do Skladu
    </Link>
  );
}