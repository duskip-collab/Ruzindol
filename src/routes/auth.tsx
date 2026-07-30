import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Chrome, Mail, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InviteRedeemSection } from "@/components/InviteRedeemSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

type MuniOpt = { id: string; name: string; region: string | null; slug: string };

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [municipalityId, setMunicipalityId] = useState<string>("");
  const [municipalities, setMunicipalities] = useState<MuniOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Načítanie obcí
    supabase
      .from("municipalities")
      .select("id, name, region, slug")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const list = (data as MuniOpt[] | null) ?? [];
        setMunicipalities(list);
        if (list.length > 0) {
          const rz = list.find((m) => m.slug === "ruzindol") || list[0];
          setMunicipalityId(rz.id);
        }
      });
  }, []);

  // Presmerovanie ak je už prihlásený
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, street, municipality_id: municipalityId },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (data.session) {
          navigate({ to: "/" });
        } else {
          setMode("signin");
          setNotice(
            "Registrácia prebehla. Potvrď email v schránke a potom sa prihlás emailom a heslom.",
          );
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_34%),linear-gradient(180deg,_#08111d_0%,_#0f172a_52%,_#111827_100%)] px-4 py-8 text-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl lg:w-[42%]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.22),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.18),_transparent_24%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Prihlásenie do Komunita Ružindol
              </div>
              <div className="space-y-4">
                <h1 className="max-w-md text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Jedna obrazovka, tri cesty dovnútra.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Prihlás sa emailom, pokračuj cez Google alebo odomkni účet voliteľným invite
                  kódom. Všetko prehľadne na jednom mieste.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: "Email", desc: "Klasické prihlásenie", icon: Mail },
                { title: "Google", desc: "Rýchly vstup", icon: Chrome },
                { title: "Invite", desc: "Voliteľné odomknutie", icon: BadgeCheck },
              ].map(({ title, desc, icon: Icon }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <Icon className="mb-3 h-5 w-5 text-emerald-300" />
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-300">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid flex-1 gap-6 lg:max-w-2xl">
          <Card className="border-white/10 bg-slate-950/80 text-slate-50 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <CardHeader className="space-y-2 border-b border-white/10 bg-white/5">
              <CardTitle className="text-2xl text-white">Prihlásenie emailom</CardTitle>
              <CardDescription className="text-slate-300">
                Prihlás sa existujúcim účtom alebo si vytvor účet pre svoju komunitu.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Email</label>
                  <Input
                    type="email"
                    placeholder="napr. meno@domena.sk"
                    required
                    className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:ring-emerald-400"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Heslo</label>
                  <Input
                    type="password"
                    placeholder="Tvoje heslo"
                    required
                    className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:ring-emerald-400"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {mode === "signup" && (
                  <div className="grid gap-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <div className="text-sm font-semibold text-emerald-100">Registrácia účtu</div>
                      <p className="text-xs leading-5 text-slate-300">
                        Zadaj základné údaje, aby si bol pripravený na komunitné funkcie.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">
                        Meno a priezvisko
                      </label>
                      <Input
                        placeholder="Tvoje meno"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:ring-emerald-400"
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">Ulica a číslo</label>
                      <Input
                        placeholder="Ulica 12"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:ring-emerald-400"
                        onChange={(e) => setStreet(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium text-slate-200">Profil komunity</label>
                      {municipalities.length <= 1 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                          <div className="text-sm font-semibold text-white">
                            {municipalities[0]?.name ?? "Ružindol"}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-300">
                            Aktuálne je dostupný iba jeden profil. Po vytvorení ďalšej komunity sa
                            tu zobrazí aj výber.
                          </div>
                        </div>
                      ) : (
                        <select
                          className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-offset-transparent focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                          value={municipalityId}
                          onChange={(e) => setMunicipalityId(e.target.value)}
                        >
                          {municipalities.map((m) => (
                            <option key={m.id} value={m.id} className="bg-slate-950 text-white">
                              {m.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {notice}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-2xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "signin" ? (
                    <>
                      Prihlásiť sa emailom
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Registrovať sa emailom
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                    className="text-emerald-300 underline-offset-4 hover:underline"
                  >
                    {mode === "signin"
                      ? "Nemáš účet? Registrovať sa"
                      : "Mám účet, chcem sa prihlásiť"}
                  </button>
                  <span className="text-slate-400">Email login je najrýchlejšia cesta.</span>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/95 text-slate-950 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="space-y-2 border-b border-slate-200/80 bg-slate-50/90">
              <CardTitle className="text-2xl text-slate-900">Prihlásenie cez Google</CardTitle>
              <CardDescription className="text-slate-600">
                Rýchle prihlásenie jedným klikom cez tvoj Google účet.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Button
                onClick={handleGoogle}
                disabled={busy}
                variant="outline"
                className="h-11 w-full rounded-2xl border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
              >
                <Chrome className="h-4 w-4" />
                Pokračovať cez Google
              </Button>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Po povolení providera v Supabase sa tu otvorí štandardný Google flow a po úspešnom
                prihlásení sa vrátiš späť do aplikácie.
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-400/20 bg-emerald-50/95 text-slate-950 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl">
            <CardHeader className="space-y-2 border-b border-emerald-200/80 bg-white/60">
              <CardTitle className="text-2xl text-slate-900">Nepovinný invite kód</CardTitle>
              <CardDescription className="text-slate-600">
                Ak máš kód od suseda alebo starostu, môžeš ho aktivovať hneď po prihlásení.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <InviteRedeemSection />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
