import { useMemo, useState } from "react";
import { Loader2, Recycle, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { localDateKey, parseWasteScheduleText, wasteEntryKey } from "@/lib/waste-import";

const PREVIEW_LIMIT = 12;

/**
 * Admin import harmonogramu zberu odpadu z textu (poloautomatický).
 *
 * Správca vloží skopírovaný text z webu obce, aplikácia ho naživo rozparsuje
 * (dátumy + typy odpadu), zobrazí náhľad a po potvrdení zapíše chýbajúce termíny
 * do tabuľky `events` (`type = 'odpad'`). Duplikáty sa odhalia porovnaním
 * (dátum + normalizovaný názov) proti existujúcim riadkom – nikdy sa nič neprepisuje
 * ani nemaže, zápis je čisto aditívny.
 */
export function WasteScheduleImporter() {
  const { profile, userId } = useCurrentUser();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; duplicates: number } | null>(null);

  const parsed = useMemo(() => parseWasteScheduleText(text), [text]);
  const canImport = Boolean(userId) && parsed.entries.length > 0 && !busy;

  async function runImport() {
    if (!userId || parsed.entries.length === 0) return;

    setBusy(true);
    setErr(null);
    setResult(null);

    try {
      // Existujúce termíny odpadu (od včera dopredu) na porovnanie duplikátov.
      const since = new Date();
      since.setDate(since.getDate() - 1);
      const { data: existing, error } = await supabase
        .from("events")
        .select("starts_at, title")
        .eq("type", "odpad")
        .gte("starts_at", since.toISOString());

      if (error) throw error;

      const existingKeys = new Set(
        (existing ?? []).map((row) => wasteEntryKey(localDateKey(row.starts_at), row.title)),
      );

      const toInsert = parsed.entries.filter(
        (entry) => !existingKeys.has(wasteEntryKey(entry.dateKey, entry.title)),
      );
      const duplicates = parsed.entries.length - toInsert.length;

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from("events").insert(
          toInsert.map((entry) => ({
            author_id: userId,
            municipality_id: profile?.municipality_id ?? null,
            title: entry.title,
            description: "",
            location: "",
            type: "odpad",
            starts_at: entry.startsAtISO,
          })),
        );
        if (insertError) throw insertError;
      }

      setResult({ inserted: toInsert.length, duplicates });
      setText("");
    } catch (importError) {
      console.error("Import zberu odpadu zlyhal:", importError);
      setErr(
        importError instanceof Error ? importError.message : "Import sa nepodaril. Skús to znova.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-600/10 text-green-600 dark:text-green-400">
          <Recycle className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Import harmonogramu zberu odpadu
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Vlož text z webu obce (napr. „01.10.2026 – Zmesový odpad“). Termíny sa uložia do
            kalendára zberu odpadu; existujúce sa preskočia.
          </p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        spellCheck={false}
        placeholder={
          "01.10.2026 – Zmesový odpad\n03.10., 17.10. – Bioodpad\n2026-11-05 Sklo a plast"
        }
        className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-xs text-neutral-900 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
      />

      {parsed.entries.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Rozpoznané termíny ({parsed.entries.length})
            {parsed.skipped.length > 0 ? ` · preskočené riadky: ${parsed.skipped.length}` : ""}
          </p>
          <ul className="space-y-1">
            {parsed.entries.slice(0, PREVIEW_LIMIT).map((entry) => (
              <li
                key={`${entry.dateKey}|${entry.title}`}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
              >
                <span className="min-w-[86px] font-mono font-semibold">{entry.dateKey}</span>
                <span className="truncate">{entry.title}</span>
              </li>
            ))}
          </ul>
          {parsed.entries.length > PREVIEW_LIMIT && (
            <p className="mt-1 text-[11px] text-slate-400">
              …a ďalších {parsed.entries.length - PREVIEW_LIMIT} termínov.
            </p>
          )}
        </div>
      )}

      {err && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {err}
        </p>
      )}

      {result && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
          Hotovo: uložené {result.inserted} termínov, preskočené duplikáty: {result.duplicates}.
        </p>
      )}

      <button
        type="button"
        onClick={() => void runImport()}
        disabled={!canImport}
        className="btn-primary-glow mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy
          ? "Importujem…"
          : `Importovať ${parsed.entries.length} ${parsed.entries.length === 1 ? "termín" : "termínov"}`}
      </button>
    </div>
  );
}
