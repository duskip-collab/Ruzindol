import { createFileRoute } from "@tanstack/react-router";
import { MojeSpravyScreen } from "@/screens/MojeSpravyScreen";

export const Route = createFileRoute("/_authenticated/spravy")({ component: MojeSpravyScreen });