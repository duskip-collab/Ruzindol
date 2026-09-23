import { CheckCircle2, Download, MoreVertical } from "lucide-react";
import { AnimatedModal } from "@/components/AnimatedModal";

/**
 * Manuálny návod na inštaláciu PWA pre Android pre prehliadače/verzie,
 * v ktorých nie je dostupný event `beforeinstallprompt`
 * (Samsung Internet, starší Chrome, atď.).
 *
 * Zatváracie tlačidlo „X" rešpektuje bezpečnú zónu iOS – AnimatedModal
 * používa pt-[max(1rem,env(safe-area-inset-top))] na hlavičke.
 */
const STEPS = [
  {
    icon: MoreVertical,
    title: "Otvorte menu prehliadača",
    description:
      "Kliknite na ikonu troch bodiek ⋮ v pravom hornom rohu prehliadača.",
  },
  {
    icon: Download,
    title: "Vyberte inštaláciu",
    description:
      "V menu zvoľte „Inštalovať aplikáciu“ alebo „Pridať na domovskú obrazovku“ (príp. „Pridať na plochu“).",
  },
  {
    icon: CheckCircle2,
    title: "Potvrďte inštaláciu",
    description:
      "Postup potvrďte – ikona aplikácie sa objaví na vašej domovskej obrazovke a bude sa otvárať ako samostatná aplikácia.",
  },
];

export function AndroidInstallGuideModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ako nainštalovať na Android"
      description="Váš prehliadač neponúka priamy inštalačný prompt. Postupujte podľa krokov nižšie:"
      cancelText="Rozumiem"
    >
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-600 text-[13px] font-bold text-white">
              {index + 1}
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <step.icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                {step.title}
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                {step.description}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-800 dark:border-amber-300 dark:bg-amber-100 dark:text-amber-900">
        <strong>Poznámka:</strong> V niektorých prehliadačoch (Samsung Internet,
        starší Chrome) sa ponuka volá odlišne – hľadajte možnosť „Inštalovať
        aplikáciu“, „Pridať na domovskú obrazovku“ alebo „Pridať na plochu“.
      </div>
    </AnimatedModal>
  );
}

export default AndroidInstallGuideModal;