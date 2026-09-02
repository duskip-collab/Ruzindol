import { createFileRoute } from "@tanstack/react-router";
import { ProfilScreen } from "@/screens/ProfilScreen";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/profil")({
	validateSearch: z.object({ section: z.enum(["items"]).optional() }),
	component: ProfilScreen,
});