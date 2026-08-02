import { useEffect, useMemo, useState } from "react";
import { Loader2, Ban, ShieldCheck, Trash2, Search, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRole } from "@/hooks/useCurrentUser";

type Row = {
  id: string;
  name: string;
  role: ProfileRole;
  banned_until: string | null;
  ban_reason: string | null;
};

export function ModerationPanel({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [days, setDays] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, banned_until, ban_reason")
      .order("name")
      .limit(200);
    if (error) setErr(error.message);
    setRows((data as Row[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q));
  }, [rows, query]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2200);
  }

  async function ban(target: Row) {
    const d = days[target.id] ?? 3;
    if (d < 1 || d > 10) {
      setErr("Ban musí byť 1 až 10 dní.");
      return;
    }
    setBusy(target.id);
    setErr(null);
    const { error } = await supabase.rpc("ban_neighbor", {
      _target: target.id,
      _days: d,
      _reason: reason[target.id]?.trim() || undefined,
    });
    setBusy(null);
    if (error) return setErr(error.message);
    flash(`${target.name} zabanovaný na ${d} dní`);
    await load();
  }

  async function unban(target: Row) {
    setBusy(target.id);
    setErr(null);
    const { error } = await supabase.rpc("unban_neighbor", { _target: target.id });
    setBusy(null);
    if (error) return setErr(error.message);
    flash(`${target.name} odblokovaný`);
    await load();
  }

  async function remove(target: Row) {
    if (!confirm(`Naozaj natrvalo vymazať suseda "${target.name}"? Táto akcia sa nedá vrátiť.`))
      return;
    setBusy(target.id);
    setErr(null);
    const { error } = await supabase.rpc("delete_neighbor", { _target: target.id });
    setBusy(null);
    if (error) return setErr(error.message);
    flash(`${target.name} vymazaný`);
    await load();
  }

  return (
    <div className="rounded-3xl border-2 border-rose-300/60 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm dark:from-rose-500/10 dark:to-transparent dark:border-rose-400/30">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-600 text-white">
          <Gavel className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Moderácia susedov
          </h3>
          <p className="text-[11px] text-neutral-500">
            Dočasný ban (1–10 dní), odblokovanie a trvalé vymazanie
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
        <Search className="h-3.5 w-3.5 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hľadať meno alebo rolu…"
          className="w-full bg-transparent text-xs text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
      </div>

      {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
      {msg && <p className="mb-2 text-xs text-emerald-600">{msg}</p>}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-neutral-500">Žiadni susedia.</p>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {filtered.map((u) => {
            const isSelf = u.id === currentUserId;
            const isAdminRow = u.role === ("admin" as ProfileRole);
            const bannedUntil = u.banned_until ? new Date(u.banned_until) : null;
            const isBanned = bannedUntil ? bannedUntil.getTime() > nowMs : false;
            const disabled = isSelf || isAdminRow || busy === u.id;

            return (
              <li
                key={u.id}
                className="rounded-xl border border-neutral-200 bg-white p-2.5 text-xs dark:border-white/10 dark:bg-white/5"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {u.name}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                    {u.role}
                  </span>
                  {isBanned && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                      Ban do {bannedUntil!.toLocaleDateString("sk-SK")}
                    </span>
                  )}
                  {isSelf && (
                    <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-white/10">
                      Vy
                    </span>
                  )}
                </div>

                {isBanned ? (
                  <div className="flex items-center gap-1.5">
                    {u.ban_reason && (
                      <span className="mr-auto text-[10px] italic text-neutral-500">
                        „{u.ban_reason}"
                      </span>
                    )}
                    <button
                      onClick={() => unban(u)}
                      disabled={disabled}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3 w-3" /> Odblokovať
                    </button>
                    <button
                      onClick={() => remove(u)}
                      disabled={disabled}
                      className="flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" /> Vymazať
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                      Dni:
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={days[u.id] ?? 3}
                        onChange={(e) =>
                          setDays((s) => ({
                            ...s,
                            [u.id]: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                          }))
                        }
                        className="w-12 rounded-md border border-neutral-200 bg-white px-1 py-0.5 text-[11px] text-neutral-800 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
                      />
                    </label>
                    <input
                      value={reason[u.id] ?? ""}
                      onChange={(e) => setReason((s) => ({ ...s, [u.id]: e.target.value }))}
                      placeholder="Dôvod (voliteľné)"
                      maxLength={200}
                      className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 placeholder:text-neutral-400 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                    />
                    <button
                      onClick={() => ban(u)}
                      disabled={disabled}
                      className="flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      title={
                        isSelf
                          ? "Nemôžete banovať sami seba"
                          : isAdminRow
                            ? "Admina nemožno banovať"
                            : ""
                      }
                    >
                      <Ban className="h-3 w-3" /> Ban
                    </button>
                    <button
                      onClick={() => remove(u)}
                      disabled={disabled}
                      className="flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" /> Vymazať
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
