import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Prihlásenie · Komunita" },
      { name: "description", content: "Prihlás sa do komunitnej aplikácie." },
    ],
  }),
});

type MuniOpt = { id: string; name: string; region: string | null; slug: string };

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [municipalityId, setMunicipalityId] = useState<string>("");
  const [municipalities, setMunicipalities] = useState<MuniOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Load municipalities for the signup dropdown.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("municipalities")
        .select("id, name, region, slug")
        .eq("is_active", true)
        .order("name");
      const list = (data as MuniOpt[] | null) ?? [];
      setMunicipalities(list);
      const rz = list.find((m) => m.slug === "ruzindol");
      if (rz) setMunicipalityId(rz.id);
      else if (list.length > 0) setMunicipalityId(list[0].id);
    })();
  }, []);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setForgotSent(true);
  }



  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) navigate({ to: "/" });
    })();
  }, [navigate]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!municipalityId) {
          throw new Error("Vyber si obec, do ktorej patríš.");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim() || email.split("@")[0],
              street: street.trim(),
              municipality_id: municipalityId,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // Optional invite code redemption after signup (session should be active).
        const code = inviteCode.trim();
        if (code) {
          const { error: rpcErr } = await supabase.rpc("redeem_invite_code", {
            _code: code,
          });
          if (rpcErr) {
            // Non-fatal: user is registered, just show info.
            setError(
              "Účet vytvorený, ale pozývací kód sa nepodarilo aktivovať: " +
                rpcErr.message +
                ". Skús ho zadať v profile."
            );
          }
        }
      }
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodarilo sa prihlásiť.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error instanceof Error ? result.error.message : "Google prihlásenie zlyhalo.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4 py-8 text-slate-900">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Komunita Ružindol</h1>
          <p className="mt-1 text-sm text-slate-600">
            {forgotOpen ? "Obnova hesla" : mode === "signin" ? "Prihlás sa do aplikácie" : "Vytvor si účet"}
          </p>
        </div>

        {forgotOpen ? (
          <form onSubmit={handleForgot} className="flex flex-col gap-3">
            {forgotSent ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                Ak email existuje, poslali sme naň odkaz na obnovu hesla. Skontroluj si schránku.
              </div>
            ) : (
              <>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Tvoj email"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Poslať odkaz na obnovu
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setForgotOpen(false);
                setForgotSent(false);
                setError(null);
              }}
              className="mt-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              ← Späť na prihlásenie
            </button>
          </form>
        ) : (
          <>
            <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
                  mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Prihlásenie
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
                  mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Registrácia
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              {mode === "signup" && (
                <>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Meno a priezvisko"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                  <input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ulica a číslo"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      Obec (nedá sa neskôr zmeniť)
                    </label>
                    <select
                      required
                      value={municipalityId}
                      onChange={(e) => setMunicipalityId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                    >
                      {municipalities.length === 0 && <option value="">Načítavam…</option>}
                      {municipalities.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.region ? ` · ${m.region}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Pozývací kód (nepovinné)"
                    maxLength={20}
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-center font-mono text-sm tracking-[0.2em] text-slate-900 outline-none placeholder:font-sans placeholder:tracking-normal focus:border-slate-500"
                  />
                </>
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Heslo (min. 6 znakov)"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Prihlásiť sa" : "Zaregistrovať sa"}
              </button>

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(true);
                    setForgotEmail(email);
                    setError(null);
                  }}
                  className="text-center text-xs font-medium text-slate-600 underline hover:text-slate-900"
                >
                  Zabudol si heslo?
                </button>
              )}
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              alebo
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <GoogleIcon /> Pokračovať cez Google
            </button>
          </>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-500">
          <Link to="/">Späť na úvod</Link>
        </p>
      </div>
    </div>
  );
}


function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C41 34.9 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
