import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, MapPin, Loader2 } from "lucide-react";
import { useAppMode } from "@/context/AppModeContext";

const REGIONS = [
  "Bratislavský kraj",
  "Trnavský kraj",
  "Nitriansky kraj",
  "Trenčiansky kraj",
  "Žilinský kraj",
  "Banskobystrický kraj",
  "Prešovský kraj",
  "Košický kraj",
];

const MUNICIPALITIES: Record<string, string[]> = {
  "Bratislavský kraj": ["Bratislava", "Pezinok", "Modra", "Senec"],
  "Trnavský kraj": ["Trnava", "Piešťany", "Hlohovec", "Skalica"],
  "Nitriansky kraj": ["Nitra", "Nové Zámky", "Levice", "Topoľčany"],
  "Trenčiansky kraj": ["Trenčín", "Prievidza", "Považská Bystrica"],
  "Žilinský kraj": ["Žilina", "Martin", "Liptovský Mikuláš", "Ružomberok"],
  "Banskobystrický kraj": ["Banská Bystrica", "Zvolen", "Lučenec"],
  "Prešovský kraj": ["Prešov", "Poprad", "Bardejov", "Humenné"],
  "Košický kraj": ["Košice", "Michalovce", "Spišská Nová Ves"],
};

type Step = 0 | 1 | 2 | 3;

export function GeoWizard({ onDone }: { onDone: () => void }) {
  const { setGeo, finishOnboarding } = useAppMode();
  const [step, setStep] = useState<Step>(0);
  const [region, setRegion] = useState<string | null>(null);
  const [municipality, setMunicipality] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  function next() {
    setStep((s) => (Math.min(3, s + 1) as Step));
  }
  function back() {
    setStep((s) => (Math.max(0, s - 1) as Step));
  }

  function detectLocation() {
    setDetecting(true);
    setTimeout(() => {
      setRegion("Bratislavský kraj");
      setDetecting(false);
      next();
    }, 900);
  }

  function confirm() {
    if (region && municipality) {
      setGeo(region, municipality);
      finishOnboarding();
      onDone();
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-neutral-50 to-neutral-100 px-5 py-6">
      {/* progress */}
      <div className="mb-6 flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-neutral-900" : "bg-neutral-200"
            }`}
          />
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="flex h-full flex-col items-center justify-center text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
                <MapPin className="h-7 w-7 text-neutral-900" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Kde bývaš?</h2>
              <p className="mt-2 max-w-xs text-sm text-neutral-600">
                Pomôže nám to zobraziť ti tú správnu komunitu. Nezdieľame tvoju
                presnú polohu.
              </p>
              <button
                onClick={detectLocation}
                disabled={detecting}
                className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-60"
              >
                {detecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                Detegovať polohu
              </button>
              <button
                onClick={next}
                className="mt-3 text-xs font-medium text-neutral-500 underline"
              >
                Zadám ručne
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="flex h-full flex-col"
            >
              <h2 className="text-lg font-semibold">Vyber kraj</h2>
              <p className="text-xs text-neutral-500">Krok 2 zo 4</p>
              <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRegion(r);
                      setMunicipality(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      region === r
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
                    }`}
                  >
                    <span>{r}</span>
                    {region === r && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="flex h-full flex-col"
            >
              <h2 className="text-lg font-semibold">Vyber obec / mesto</h2>
              <p className="text-xs text-neutral-500">Krok 3 zo 4 · {region}</p>
              <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                {(region ? MUNICIPALITIES[region] ?? [] : []).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMunicipality(m)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      municipality === m
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
                    }`}
                  >
                    <span>{m}</span>
                    {municipality === m && <Check className="h-4 w-4" />}
                  </button>
                ))}
                {region && (MUNICIPALITIES[region] ?? []).length === 0 && (
                  <p className="text-xs text-neutral-500">Žiadne obce pre kraj.</p>
                )}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="flex h-full flex-col items-center justify-center text-center"
            >
              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">Skontroluj údaje</h2>
                <div className="mt-3 space-y-1 text-sm text-neutral-700">
                  <p>
                    <span className="text-neutral-500">Kraj:</span> {region ?? "—"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Obec:</span>{" "}
                    {municipality ?? "—"}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          onClick={back}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-neutral-600 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Späť
        </button>
        {step < 3 ? (
          <button
            onClick={next}
            disabled={
              (step === 1 && !region) || (step === 2 && !municipality)
            }
            className="flex items-center gap-1 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-40"
          >
            Ďalej <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={confirm}
            disabled={!region || !municipality}
            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-40"
          >
            Potvrdiť <Check className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
