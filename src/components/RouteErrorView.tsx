import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { WifiOff, AlertTriangle, RefreshCw, Home } from "lucide-react";

export interface RouteErrorViewProps {
  error: Error;
  reset: () => void;
  title?: string;
  description?: string;
}

export function RouteErrorView({ error, reset, title, description }: RouteErrorViewProps) {
  const router = useRouter();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const errorMessage = error?.message?.toLowerCase() || "";
  const isNetworkError =
    isOffline ||
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("failed to fetch");

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-border/60 bg-card p-8 shadow-xl">
        <div
          className={`grid h-16 w-16 place-items-center rounded-2xl ${
            isNetworkError
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {isNetworkError ? <WifiOff size={28} /> : <AlertTriangle size={28} />}
        </div>

        <h2 className="mt-5 text-xl font-bold tracking-tight text-foreground">
          {title || (isNetworkError ? "Výpadok pripojenia" : "Nastala neočakávaná chyba")}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description ||
            (isNetworkError
              ? "Zdá sa, že ste offline alebo máme problém s pripojením k serveru. Skontrolujte svoje internetové pripojenie a skúste to znova."
              : error?.message ||
                "Pri načítavaní tejto časti aplikácie došlo k neočakávanej chybe. Ospravedlňujeme sa za nepríjemnosti.")}
        </p>

        {isOffline && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Offline režim – čaká sa na pripojenie k sieti
          </div>
        )}

        <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <RefreshCw size={16} className={isOffline ? "animate-spin" : ""} />
            Zopakovať pokus
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent active:scale-[0.98]"
          >
            <Home size={16} />
            Na úvodnú stránku
          </a>
        </div>
      </div>
    </div>
  );
}
