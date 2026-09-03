import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Mail, Sparkles, Loader2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LegalDocumentsDialog, LegalLinkButton, type LegalSection } from "@/components/LegalDocuments";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteErrorView } from "@/components/RouteErrorView";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  errorComponent: RouteErrorView,
});

function AuthPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"select" | "email">("select");
  const [authAction, setAuthAction] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [legalDialogSection, setLegalDialogSection] = useState<LegalSection>("terms");

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  // Auto-focus email input when switching to email mode
  useEffect(() => {
    if (viewMode === "email") {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [viewMode]);

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (authAction === "signup" && !legalAccepted) {
      setError("Pred registráciou musíš súhlasiť so Všeobecnými podmienkami používania a GDPR.");
      return;
    }

    setBusy(true);
    try {
      if (authAction === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              legal_accepted_at: new Date().toISOString(),
              legal_version: "2026-08-03",
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (data.session) {
          navigate({ to: "/" });
        } else {
          setNotice("Na tvoj e-mail sme odoslali overovací odkaz. Klikni naň a dokonči registráciu.");
          setEmail("");
          setPassword("");
        }
      }
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa prihlásiť.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    if (!legalAccepted) {
      setError("Pred prihlásením musíš súhlasiť so spracovaním údajov (zaškrtni políčko nižšie).");
      return;
    }
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

  const openLegalDialog = (section: LegalSection) => {
    setLegalDialogSection(section);
    setLegalDialogOpen(true);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Emerald Glow Effect */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-full -translate-x-1/2 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.15)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Upper Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-[11px] font-bold tracking-wider text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>✨ PRIHLÁSENIE DO KOMUNITA RUŽINDOL</span>
          </div>
        </motion.div>

        {/* Headlines */}
        <div className="mb-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Vitaj u susedov. <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Vyber si, ako vstúpiš.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-slate-400"
          >
            Použi svoj Google účet alebo klasický e-mail. <br className="hidden sm:block" />
            Všetko rýchlo, bezpečne a na jednom mieste.
          </motion.p>
        </div>

        {/* Auth Cards / Form Container */}
        <div className="relative min-h-[340px]">
          <AnimatePresence mode="wait">
            {viewMode === "select" ? (
              // STAV 1: SELECT MODE - 2 KARTY
              <motion.div
                key="select"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Email Card */}
                <button
                  onClick={() => setViewMode("email")}
                  className="group relative flex w-full items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition-all duration-300 hover:border-emerald-500/50 hover:bg-slate-900 active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 transition-colors group-hover:bg-emerald-500/20">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Email</h3>
                    <p className="text-sm text-slate-400">Klasické prihlásenie</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-emerald-500" />
                </button>

                {/* Google Card */}
                <button
                  onClick={handleGoogle}
                  disabled={busy}
                  className="group relative flex w-full items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-900 active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-slate-900">
                    <Globe className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Google</h3>
                    <p className="text-sm text-slate-400">Rýchly vstup</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-blue-500" />
                </button>

                {/* Consent Checkbox in Select Mode */}
                <div className="pt-4">
                  <ConsentCheckbox
                    checked={legalAccepted}
                    onChange={setLegalAccepted}
                    onOpenLegal={openLegalDialog}
                  />
                </div>
              </motion.div>
            ) : (
              // STAV 2: EMAIL MODE - EMAIL FORM
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm"
              >
                {/* Back Button */}
                <button
                  onClick={() => setViewMode("select")}
                  className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Späť na výber
                </button>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Váš e-mail
                    </label>
                    <Input
                      ref={emailInputRef}
                      autoFocus
                      type="email"
                      required
                      placeholder="sused@ruzindol.sk"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-2xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Password Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Heslo
                      </label>
                      {authAction === "signin" && (
                        <button
                          type="button"
                          onClick={() => navigate({ to: "/reset-password" })}
                          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
                        >
                          Zabudnuté heslo?
                        </button>
                      )}
                    </div>
                    <Input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-2xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Consent for Signup */}
                  {authAction === "signup" && (
                    <div className="pt-2">
                      <ConsentCheckbox
                        checked={legalAccepted}
                        onChange={setLegalAccepted}
                        onOpenLegal={openLegalDialog}
                      />
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="h-12 w-full rounded-2xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="mr-2 h-4 w-4" />
                    )}
                    {authAction === "signin" ? "Prihlásiť sa" : "Vytvoriť účet"}
                  </Button>

                  {/* Toggle Signin/Signup */}
                  <div className="pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setAuthAction(authAction === "signin" ? "signup" : "signin")}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      {authAction === "signin" ? (
                        <>
                          Ešte nemáte účet?{" "}
                          <span className="font-semibold text-emerald-400">Zaregistrujte sa</span>
                        </>
                      ) : (
                        <>
                          Už máte účet?{" "}
                          <span className="font-semibold text-emerald-400">Prihláste sa</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Error / Notice Messages */}
        <AnimatePresence>
          {(error || notice) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "mt-6 rounded-2xl border p-4 text-sm font-medium leading-relaxed shadow-lg",
                error
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              )}
            >
              {error || notice}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legal Documents Dialog */}
      <LegalDocumentsDialog
        open={legalDialogOpen}
        onOpenChange={setLegalDialogOpen}
        initialSection={legalDialogSection}
      />
    </div>
  );
}

/**
 * ConsentCheckbox Component
 * Displays legal consent with clickable links to terms and GDPR
 */
function ConsentCheckbox({
  checked,
  onChange,
  onOpenLegal,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onOpenLegal: (section: LegalSection) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/30 px-4 py-3 text-[13px] text-slate-400 transition-all hover:bg-slate-900/50 hover:border-slate-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20"
      />
      <span className="leading-5">
        Súhlasím so{" "}
        <LegalLinkButton
          section="terms"
          onOpen={onOpenLegal}
          className="font-semibold text-emerald-400 underline-offset-4 hover:underline"
        >
          VPP
        </LegalLinkButton>
        {" "}a{" "}
        <LegalLinkButton
          section="privacy"
          onOpen={onOpenLegal}
          className="font-semibold text-emerald-400 underline-offset-4 hover:underline"
        >
          GDPR
        </LegalLinkButton>
        . Beriem na vedomie spracovanie mojich údajov.
      </span>
    </label>
  );
}

