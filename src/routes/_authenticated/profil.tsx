import { createFileRoute } from "@tanstack/react-router";
import { ProfilScreen } from "@/screens/ProfilScreen";

export const Route = createFileRoute("/_authenticated/profil")({ component: ProfilScreen });