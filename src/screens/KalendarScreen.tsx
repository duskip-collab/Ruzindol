import { SharedCalendar } from "@/components/SharedCalendar";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function KalendarScreen({ categoryFilter }: { categoryFilter?: string }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto px-4 py-4 md:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/nastenka"
            className="grid h-8 w-8 place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Obecný kalendár podujatí
          </h1>
        </div>
      </div>
      <SharedCalendar categoryFilter={categoryFilter} />
    </div>
  );
}
