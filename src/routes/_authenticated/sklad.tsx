import { createFileRoute } from "@tanstack/react-router";
import { SkladScreen } from "@/screens/SkladScreen";

export const Route = createFileRoute("/_authenticated/sklad")({ component: SkladScreen });