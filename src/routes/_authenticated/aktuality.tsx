import { createFileRoute } from "@tanstack/react-router";
import { AktualityScreen } from "@/screens/AktualityScreen";

export const Route = createFileRoute("/_authenticated/aktuality")({ component: AktualityScreen });