import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Check, Loader2, MapPin, Sparkles } from "lucide-react";

import { useAppMode } from "@/context/AppModeContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";

type Municipality = { id: string; name: string; region: string | null; slug: string };

export function GeoWizard({ onDone }: { onDone: () => void }) {
  const { setGeo, finishOnboarding } = useAppMode();
  const { profile } = useCurrentUser();
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("municipalities")
        .select("id, name, region, slug")
        .eq("is_active", true)
        .order("name");

      if (!mounted) return;

      const list = (data as Municipality[] | null) ?? [];
      setMunicipalities(list);

      const preferred = profile?.municipality_id ?? null;
      const defaultChoice =
        list.find((item) => item.id === preferred) ??
        list.find((item) => item.slug === "ruzindol") ??
        list[0] ??
        null;

      setSelectedId(defaultChoice?.id ?? null);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [profile?.municipality_id]);

  const selectedMunicipality = useMemo(
    () => municipalities.find((item) => item.id === selectedId) ?? null,
    [municipalities, selectedId],
  );

  function confirm() {
    const target = selectedMunicipality ?? municipalities[0];
    if (!target) return;
    setGeo(target.region ?? "Bratislavský kraj", target.name, target.id);
    finishOnboarding();
    onDone();
  }

  const hasMultipleProfiles = municipalities.length > 1;

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-neutral-50 to-neutral-100 px-5 py-6 text-neutral-900">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-lg">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Tvoj profil
          </div>
          <h2 className="text-xl font-semibold">Ružindol je pripravený</h2>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900">Aktuálny profil</div>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              Táto aplikácia si zapamätá posledný profil na zariadení. Pri prvej aktivácii sa
              zobrazí iba dostupná komunita alebo výber komunít.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 py-10 text-neutral-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Načítavam komunity…
            </div>
          ) : hasMultipleProfiles ? (
            municipalities.map((municipality) => {
              const active = municipality.id === selectedId;
              return (
                <button
                  key={municipality.id}
                  type="button"
                  onClick={() => setSelectedId(municipality.id)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
                  }`}
                >
                  <div>
                    <div className="font-semibold">{municipality.name}</div>
                    <div className={`text-xs ${active ? "text-white/70" : "text-neutral-500"}`}>
                      {municipality.region ?? "Bez kraja"}
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4" />}
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                {municipalities[0]?.name ?? "Ružindol"}
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Momentálne je aktívny iba jeden profil, preto sa výber nezobrazuje. Po vytvorení
                ďalšej komunity sa tu automaticky objaví nový profil.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-semibold">Zapamätáme si posledný profil</div>
          <div className="mt-1 text-sm leading-6 text-emerald-800/90">
            Na tomto zariadení sa po ďalšom prihlásení otvorí posledná použitá komunita.
          </div>
        </div>
      </motion.div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-xs text-neutral-500">
          {hasMultipleProfiles
            ? "Vyber si profil, ktorý sa má otvárať automaticky."
            : "Profil je pripravený automaticky."}
        </div>
        <button
          onClick={confirm}
          disabled={loading || !selectedMunicipality}
          className="flex items-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50"
        >
          Pokračovať
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
