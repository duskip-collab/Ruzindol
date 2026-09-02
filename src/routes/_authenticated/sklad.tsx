import { createFileRoute } from "@tanstack/react-router";
import { SkladScreen } from "@/screens/SkladScreen";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/sklad")({
	validateSearch: z.object({
		section: z.enum(["trh", "darovanie", "poziciovna"]).optional(),
		tab: z.enum(["ponuka", "dopyt"]).optional(),
	}),
	component: SkladScreen,
});