import { createFileRoute } from "@tanstack/react-router";
import { NastenkaScreen } from "@/screens/NastenkaScreen";

export const Route = createFileRoute("/_authenticated/nastenka")({ component: NastenkaScreen });