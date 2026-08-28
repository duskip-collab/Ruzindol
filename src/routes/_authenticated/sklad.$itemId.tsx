import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ActiveNeighborBadge } from "@/components/ActiveNeighborBadge";
import {
  formatWarehouseExpiry,
  getWarehouseLifetimeLabel,
  getWarehouseRemainingLabel,
  type WarehouseItemType,
} from "@/lib/warehouse";

type WarehouseItemDetail = {
  id: string;
  type: WarehouseItemType;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  created_at: string;
  expires_at: string | null;
  profiles: {
    name: string;
    street: string | null;
    is_active_neighbor: boolean | null;
  } | null;
};

export const Route = createFileRoute("/_authenticated/sklad/$itemId")({
  component: WarehouseItemDetailScreen,
});

function WarehouseItemDetailScreen() {
  const { itemId } = Route.useParams();
  const { data: item, error, isLoading } = useQuery({
    queryKey: ["warehouse-item", itemId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("warehouse_items")
        .select(
          "id, type, title, description, price, image_url, created_at, expires_at, profiles(name, street, is_active_neighbor)",
        )
        .eq("id", itemId)
        .maybeSingle();

      if (queryError) throw queryError;
      return data as WarehouseItemDetail | null;
    },
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !item) {
    return (
      <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">Položku sa nepodarilo načítať.</p>
        <Link to="/sklad" className="btn-secondary-surface inline-flex items-center gap-2 px-3 py-2 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Späť do Skladu
        </Link>
      </div>
    );
  }

  const itemType = item.type as WarehouseItemType;
  const priceLabel = item.price > 0 ? `${item.price} €` : "Zadarmo";

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto p-4 pb-24 md:px-6 md:py-6">
      <Link to="/sklad" className="btn-secondary-surface inline-flex items-center gap-2 px-3 py-2 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Späť do Skladu
      </Link>
      <article className="app-card mt-4 overflow-hidden rounded-3xl p-5 shadow-sm md:p-7">
        {item.image_url && <img src={item.image_url} alt={item.title} className="max-h-[52vh] w-full rounded-2xl object-cover" />}
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
      </article>
    </div>
  );
}