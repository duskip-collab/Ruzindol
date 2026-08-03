import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Alert = {
  id: string;
  title: string;
  content: string;
  published_at: string;
};

const DISMISS_KEY = "aktuality_alert_dismissed";

function playPriorityFeedback() {
  navigator.vibrate?.([250, 120, 250, 120, 500]);

  if (typeof window === "undefined") return;

  try {
    const AudioCtx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    // Ignore audio feedback failures.
  }
}

export function FullscreenAlert() {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    let mounted = true;
    const showAlert = (next: Alert | null) => {
      if (!next || !mounted) return;
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed === next.id) return;
      setCountdown(5);
      setAlert(next);
      playPriorityFeedback();
    };

    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, content, published_at")
        .eq("priority", "vystraha")
        .order("published_at", { ascending: false })
        .limit(1);
      showAlert((data?.[0] as Alert | undefined) ?? null);
    })();

    const channel = supabase
      .channel("fullscreen-critical-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements", filter: "priority=eq.vystraha" },
        (payload) => {
          const row = payload.new as Alert;
          showAlert(row);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!alert) return;
    if (countdown <= 0) {
      handleClose();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert, countdown]);

  function handleClose() {
    if (alert) localStorage.setItem(DISMISS_KEY, alert.id);
    setAlert(null);
  }

  if (!alert) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative mx-4 max-h-[85%] w-full max-w-sm overflow-hidden rounded-3xl border-4 border-red-600 bg-white shadow-2xl">
        <div className="flex items-center gap-2 bg-red-600 px-4 py-3 text-white">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
          <span className="text-sm font-bold uppercase tracking-wider">Kritická výstraha</span>
          <button
            onClick={handleClose}
            className="ml-auto rounded-full p-1 hover:bg-red-700"
            aria-label="Zavrieť"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-5">
          <h2 className="text-lg font-bold text-red-700">{alert.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {alert.content}
          </p>
        </div>
        <div className="border-t border-red-200 bg-red-50 px-4 py-3">
          <button
            onClick={handleClose}
            className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
          >
            Zatvoriť ({countdown}s)
          </button>
        </div>
      </div>
    </div>
  );
}
