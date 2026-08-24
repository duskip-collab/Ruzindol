import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, KeyRound, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteErrorView } from "@/components/RouteErrorView";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  errorComponent: RouteErrorView,
  head: () => ({
    meta: [
      { title: "Obnova hesla · Komunita" },
      { name: "description", content: "Nastav si nové heslo pre komunitnú aplikáciu." },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase automatically picks up the recovery token from the URL hash
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If user already has a session (arrived from recovery link), allow reset
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setErr("Heslo musí mať aspoň 6 znakov.");
    if (password !== confirm) return setErr("Heslá sa nezhodujú.");
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/" }), 1400);
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Nové heslo</h1>
            <p className="text-xs text-slate-500">Zadaj nové prihlasovacie heslo.</p>
          </div>
        </div>

        {!ready ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Overujem obnovovací odkaz…
          </div>
        ) : done ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="h-4 w-4" />
            Heslo bolo zmenené. Presmerúvam…
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nové heslo"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Zopakuj heslo"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
            {err && <p className="text-xs text-rose-600">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Nastaviť nové heslo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
