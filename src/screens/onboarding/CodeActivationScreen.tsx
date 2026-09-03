import { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Keyboard, Check, Loader2, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppMode } from "@/context/AppModeContext";

type Props = {
  onClose?: () => void;
  onActivated?: () => void | Promise<void>;
};

export function CodeActivationScreen({ onClose, onActivated }: Props) {
  const { activateCode } = useAppMode();
  const [mode, setMode] = useState<"qr" | "manual">("manual");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(raw?: string) {
    const val = (raw ?? code).trim();
    if (!val) { setErr("Zadaj kód."); return; }
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.rpc("redeem_invite_code", { _code: val });
      if (error) throw new Error(mapError(error.message));
      if (!data) throw new Error("Neplatný pozývací kód.");
      activateCode(val);
      if (onActivated) await onActivated(); else if (onClose) onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Aktivácia zlyhala.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-950 text-white pt-safe pb-safe overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/20 transition-colors active:scale-95"
          aria-label="Späť"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Späť</span>
        </button>
        <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">POZÝVACÍ KÓD</span>
        <div className="w-[72px]" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-between p-6 max-w-md mx-auto w-full">
        <div className="mt-2 flex justify-center w-full">
          <div className="inline-flex rounded-full bg-white/10 p-1 text-xs backdrop-blur">
            <button
              onClick={() => setMode("qr")}
        <div className="flex w-full flex-1 flex-col items-center justify-center my-auto py-6">
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
              <div className="absolute inset-x-0 bottom-3 text-center text-[10px] text-white/60 font-medium">
                Nasmeruj kameru na QR pozývačku
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full text-center"
            >
              <h2 className="text-xl font-bold tracking-tight text-white mb-2">
                Aktivácia účtu
              </h2>
              <p className="text-xs text-slate-400 mb-6 max-w-[280px] mx-auto leading-relaxed">
                Zadaj 10-miestny kód, ktorý ti poskytol tvoj sused, starosta alebo administrátor.
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXXX"
                maxLength={20}
                autoComplete="off"
                className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-4 text-center font-mono text-xl tracking-[0.25em] text-white placeholder:text-white/20 focus:border-emerald-500 focus:bg-white/10 focus:outline-none transition-all shadow-inner"
              />
            </motion.div>
          )}

          {err && (
            <div className="mt-6 flex items-center gap-2 rounded-full bg-rose-500/20 px-4 py-2 text-xs text-rose-200 border border-rose-500/30">
              <X className="h-3.5 w-3.5" />
              {err}
            </div>
          )}
        </div>

        <div className="w-full pt-2 pb-4">
          <button
            onClick={() => void submit()}
            disabled={busy || (mode === "manual" && code.trim().length < 4)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-50 hover:bg-emerald-400 transition-all active:scale-[0.98]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aktivovať prístup
          </button>
        </div>
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

              className={`flex items-center gap-1.5 rounded-full px-4 py-2 transition font-medium ${
                mode === "qr" ? "bg-white text-neutral-900 shadow-md" : "text-white/80 hover:text-white"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" /> QR kód
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 transition font-medium ${
                mode === "manual" ? "bg-white text-neutral-900 shadow-md" : "text-white/80 hover:text-white"
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" /> Ručne
            </button>
          </div>
        </div>

