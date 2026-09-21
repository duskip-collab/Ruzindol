import { createFileRoute } from "@tanstack/react-router";
import { AktualityScreen } from "@/screens/AktualityScreen";
import { z } from "zod";

/**
 * Hĺbkové prekliky do presných podsekcii Aktualít (napr. z Obecného hlásnika):
 *  - `tile` – hlavná dlaždica ("oznamy", "kalendar", "organizacie", ...)
 *  - `sub`  – podvoľba v zlúčenej sekcii ("rss", "rozhlas", "odpad", "dhz", ...)
 */
const aktualitySearchSchema = z.object({
  tile: z.string().optional(),
  sub: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/aktuality")({
  validateSearch: aktualitySearchSchema,
  component: AktualityScreen,
});
