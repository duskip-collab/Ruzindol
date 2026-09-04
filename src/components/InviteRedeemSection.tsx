import { useState } from "react";
import { Loader2, Check, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppMode } from "@/context/AppModeContext";

export function InviteRedeemSection({ onActivated }: { onActivated?: () => void | Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const { activateCode } = useAppMode();

  async function submit() {
    const val = code.trim();
    if (!val) {
      setErr("Zadaj kód od suseda alebo starostu.");
      return;
    }
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const { data, error } = await supabase.rpc("redeem_invite_code", {
        _code: val,
      });
      if (error) throw new Error(mapError(error.message));
      if (!data) throw new Error("Neplatný pozývací kód.");
      activateCode(val);
      setOk(true);
      setCode("");
      if (onActivated) {
        await onActivated();
      } else {
        window.location.reload();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Aktivácia zlyhala.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Zadaj pozývací kód, ktorý si dostal od suseda, starostu alebo admina. Po zadaní správneho
        kódu sa ti odomkne pridávanie inzerátov a chat so susedmi.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="XXXX-XXXXX"
            maxLength={20}
            autoComplete="off"
            className="app-input w-full rounded-2xl pl-9 pr-3 py-3 font-mono text-sm tracking-[0.25em] outline-none"
          />
        </div>
        <button
          onClick={() => void submit()}
          disabled={busy || code.trim().length < 4}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Aktivovať
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          Skvelé! Si aktívny sused. Všetky funkcie sú odomknuté.
        </div>
      )}
    </div>
  );
}

function mapError(msg: string): string {
  if (/Neplatný/i.test(msg)) return "Neplatný pozývací kód.";
  if (/už bol použitý/i.test(msg)) return "Kód už bol použitý.";
  if (/authenticat/i.test(msg)) return "Prihlás sa a skús znova.";
  return msg;
}
