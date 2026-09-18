import { createFileRoute } from "@tanstack/react-router";
import { KalendarScreen } from "@/screens/KalendarScreen";
import { z } from "zod";

const calendarSearchSchema = z.object({
  category: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/kalendar")({
  validateSearch: calendarSearchSchema,
  component: KalendarRouteComponent,
});

function KalendarRouteComponent() {
  const { category } = Route.useSearch();
  return <KalendarScreen categoryFilter={category} />;
}
