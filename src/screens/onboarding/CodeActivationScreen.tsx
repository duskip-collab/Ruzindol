import { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Keyboard, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppMode } from "@/context/AppModeContext";

type Props = {
  onClose?: () => void;
  onActivated?: () => void | Promise<void>;
};

export function CodeActivationScreen({ onClose, onActivated }: Props) {
  // Keep local AppMode in sync for legacy UI (invite generator etc.)
  const { activateCode } = useAppMode();
  const [mode, setMode] = useState<"qr" | "manual">("manual");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(raw?: string) {
    const val = (raw ?? code).trim();
    if (!val) {
      setErr("Zadaj kód.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("redeem_invite_code", {
        _code: val,
      });
      if (error) throw new Error(mapError(error.message));
      if (!data) throw new Error("Neplatný pozývací kód.");
      // Mirror to local AppMode so legacy UI reflects verified state.
      activateCode(val);
      if (onActivated) await onActivated();
      else if (onClose) onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Aktivácia zlyhala.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] w-full h-full bg-[#121212] text-white flex flex-col justify-between p-6 overflow-y-auto">
      <div className="flex items-center justify-between px-6 pt-16">
        <span className="text-xs font-medium tracking-wider text-white/60">
          AKTIVÁCIA
        </span>
        {onClose ? (
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
            aria-label="Zavrieť"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-9" />
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <div className="inline-flex rounded-full bg-white/10 p-1 text-xs backdrop-blur">
          <button
            onClick={() => setMode("qr")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
              mode === "qr" ? "bg-white text-neutral-900" : "text-white/80"
            }`}
          >
            <QrCode className="h-3.5 w-3.5" /> QR kód
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
              mode === "manual" ? "bg-white text-neutral-900" : "text-white/80"
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" /> Ručne
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        {mode === "qr" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-square w-full max-w-[260px] overflow-hidden rounded-3xl border border-white/20 bg-black/40"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)]" />
            <span className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-white/80" />
            <span className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-white/80" />
            <span className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-white/80" />
            <span className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-white/80" />
            <motion.div
              className="absolute left-4 right-4 h-0.5 rounded-full bg-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
              animate={{ top: ["12%", "88%", "12%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-x-0 bottom-2 text-center text-[10px] text-white/60">
              Nasmeruj kameru na QR pozývačku
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <label className="text-xs font-medium tracking-wider text-white/60">
              POZÝVACÍ KÓD
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXXX"
              maxLength={20}
              autoComplete="off"
              className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-center font-mono text-lg tracking-[0.3em] text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
            />
            <p className="mt-2 text-center text-[11px] text-white/50">
              Kód, ktorý ti dal sused, starosta alebo admin.
            </p>
          </motion.div>
        )}

        {err && (
          <div className="mt-4 flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100">
            <X className="h-3 w-3" />
            {err}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-6 pb-28">
        <button
          onClick={() => void submit()}
          disabled={busy || (mode === "manual" && code.trim().length < 4)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow-lg disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Aktivovať prístup
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-white/20 bg-transparent py-3 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            ← Späť
          </button>
        )}
      </div>
    </div>
  );
}

function mapError(msg: string): string {
  if (/Neplatný/i.test(msg)) return "Neplatný pozývací kód.";
  if (/už bol použitý/i.test(msg)) return "Kód už bol použitý.";
  if (/authenticat/i.test(msg)) return "Prihlás sa a skús znova.";
  return msg;
}
