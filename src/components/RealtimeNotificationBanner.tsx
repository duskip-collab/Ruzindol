import { Megaphone, X } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

export function RealtimeNotificationBanner() {
  const { current, dismiss } = useNotifications();
  if (!current) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-3">
      <button
        type="button"
        onClick={() => {
          // Scroll to top / just dismiss after reading; posts are on Nastenka.
          dismiss();
        }}
        className="pointer-events-auto w-full max-w-md animate-in slide-in-from-top-4 fade-in duration-300 md:max-w-2xl xl:max-w-3xl"
      >
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-500 to-orange-500 p-3 pr-2 text-left shadow-2xl shadow-orange-500/30 backdrop-blur">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/25">
            <Megaphone className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1 text-white">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                Obecný hlásnik
              </span>
              <span className="text-[11px] opacity-75">
                · {current.authorName}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm font-semibold">
              {current.title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs opacity-95">
              {current.body}
            </p>
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            className="shrink-0 rounded-full p-1.5 text-white/90 hover:bg-white/15"
            aria-label="Zavrieť"
          >
            <X className="h-4 w-4" />
          </span>
        </div>
      </button>
    </div>
  );
}
