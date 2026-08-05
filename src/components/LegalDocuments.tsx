import { useEffect, useState } from "react";
import { FileText, Scale, ShieldCheck, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type LegalSection = "terms" | "privacy";

type LegalDocumentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: LegalSection;
};

export function LegalDocumentsDialog({
  open,
  onOpenChange,
  initialSection = "terms",
}: LegalDocumentsDialogProps) {
  const [section, setSection] = useState<LegalSection>(initialSection);

  useEffect(() => {
    if (open) {
      setSection(initialSection);
    }
  }, [initialSection, open]);

  const showingTerms = section === "terms";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[220] flex h-[min(92dvh,860px)] w-[calc(100vw-1.25rem)] max-w-3xl flex-col overflow-hidden rounded-[1.5rem] border-border bg-background p-0 text-foreground sm:w-full">
        <DialogHeader className="z-10 border-b border-border bg-background px-4 pb-3 pt-5 text-left sm:px-6 sm:pb-4 sm:pt-6">
          <DialogTitle className="text-xl">
            {showingTerms ? "Podmienky používania" : "Ochrana osobných údajov (GDPR)"}
          </DialogTitle>
          <DialogDescription className="pr-10 sm:pr-12">
            Prehľad pravidiel komunity, používania služby a spracúvania osobných údajov.
          </DialogDescription>
        </DialogHeader>

        <div className="z-10 flex flex-wrap gap-2 border-b border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => setSection("terms")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              showingTerms
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            Podmienky používania
          </button>
          <button
            type="button"
            onClick={() => setSection("privacy")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              !showingTerms
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            Ochrana osobných údajov
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-6 sm:px-6 sm:py-5 sm:pb-8">
          {showingTerms ? <TermsContent /> : <PrivacyContent />}
        </div>

        <DialogFooter className="z-10 border-t border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="mr-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSection("terms")}
              className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              Mám prečítané podmienky
            </button>
            <button
              type="button"
              onClick={() => setSection("privacy")}
              className="rounded-2xl bg-emerald-600/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              Mám prečítané GDPR
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Zavrieť
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LegalLinkButton({
  section,
  onOpen,
  children,
  className = "font-semibold text-emerald-300 underline underline-offset-4 hover:text-emerald-200",
}: {
  section: LegalSection;
  onOpen: (section: LegalSection) => void;
  children: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={() => onOpen(section)} className={className}>
      {children}
    </button>
  );
}

export function LegalInfoPanel() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<LegalSection>("terms");

  return (
    <>
      <div className="rounded-3xl border border-neutral-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/10">
            <Scale className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Právne informácie a súkromie
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Podmienky používania a GDPR informácie máš dostupné kedykoľvek priamo v profile.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSection("terms");
              setOpen(true);
            }}
            className="rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
          >
            Náhľad podmienok používania a GDPR
          </button>
          <button
            type="button"
            onClick={() => {
              setSection("privacy");
              setOpen(true);
            }}
            className="rounded-2xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Otvoriť GDPR časť
          </button>
        </div>
      </div>

      <LegalDocumentsDialog open={open} onOpenChange={setOpen} initialSection={section} />
    </>
  );
}

function TermsContent() {
  return (
    <div className="space-y-6 text-sm leading-6 text-foreground">
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" /> Podmienky používania komunitnej aplikácie
        </div>
        <p>
          <strong>1. Úvodné ustanovenia</strong>
        </p>
        <p>
          1.1. Tieto podmienky upravujú pravidlá používania bezplatnej komunitnej aplikácie určenej
          na susedskú spoluprácu a komunikáciu (ďalej len „aplikácia").
        </p>
        <p>
          1.2. Používateľom aplikácie sa stáva každá fyzická osoba, ktorá úspešne dokončí registráciu
          pomocou e-mailu alebo pozývacieho kódu.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" /> Pravidlá správania sa v aplikácii
        </div>
        <p>
          2.1. Používateľ sa zaväzuje, že bude aplikáciu využívať v súlade s platnými právnymi
          predpismi SR a EÚ a dobrými mravmi.
        </p>
        <p>
          2.2. V aplikácii je prísne zakázané:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Uverejňovať obsah, ktorý je nezákonný, urážlivý, vulgárny, nenávistný alebo obťažujúci.</li>
          <li>Šíriť dezinformácie, spam alebo nevyžiadanú komerčnú inzerciu nesúvisiacu s účelom aplikácie.</li>
          <li>Zdieľať osobné údaje iných osôb bez ich súhlasu.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Scale className="h-4 w-4" /> Zodpovednosť za obsah a fungovanie
        </div>
        <p>
          3.1. Prevádzkovateľ nepreberá zodpovednosť za presnosť, pravdivosť a obsah príspevkov,
          ktoré do aplikácie vložia samotní používatelia (UGC - User Generated Content).
        </p>
        <p>
          3.2. Prevádzkovateľ si vyhradzuje právo kedykoľvek odstrániť akýkoľvek obsah, ktorý
          porušuje tieto podmienky, alebo zablokovať prístup používateľovi.
        </p>
        <p>
          3.3. Prevádzkovateľ nezodpovedá za škody vzniknuté na základe vzájomných dohôd alebo
          aktivít medzi používateľmi navzájom.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" /> Záverečné ustanovenia
        </div>
        <p>
          4.1. Tieto podmienky môže prevádzkovateľ aktualizovať. O zmenách budú používatelia
          informovaní v aplikácii.
        </p>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-6 text-sm leading-6 text-foreground">
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" /> Ochrana osobných údajov a GDPR
        </div>
        <p>
          <strong>1. Prevádzkovateľ a kontakt</strong>
        </p>
        <p>
          1.1. Prevádzkovateľom aplikácie je správca projektu alebo komunity (kontaktné údaje doplní
          prevádzkovateľ v sekcii kontaktu).
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" /> Aké údaje zbierame a prečo
        </div>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li><strong>E-mailová adresa:</strong> registrácia, prihlásenie, overenie identity a nevyhnutná komunikácia k účtu.</li>
          <li><strong>Meno alebo prezývka:</strong> identifikácia používateľa v komunite a susedských aktivitách.</li>
          <li><strong>Pozývací kód:</strong> overenie oprávnenia vstupu do komunity.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Trash2 className="h-4 w-4" /> Doba uchovávania a bezpečnosť
        </div>
        <p>
          3.1. Údaje sú uchovávané po celú dobu, počas ktorej má používateľ aktívny účet.
        </p>
        <p>
          3.2. Dáta sú uložené na zabezpečenej infraštruktúre. Heslá sú ukladané iba vo forme
          bezpečného hashu a nie v čitateľnej podobe.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Scale className="h-4 w-4" /> Práva používateľa podľa GDPR
        </div>
        <p>4.2. Podľa nariadenia GDPR máš právo:</p>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Požadovať prístup k svojim osobným údajom a ich opravu.</li>
          <li>
            Požadovať vymazanie účtu a všetkých údajov (právo na zabudnutie). Účet je možné kedykoľvek
            zmazať priamo v nastaveniach profilu alebo zaslaním požiadavky správcovi.
          </li>
          <li>Odvolať súhlas so spracovaním údajov.</li>
        </ul>
        <p>
          Doplňujúce upresnenie: v tejto aplikácii sa štandardne spracúvajú najmä údaje e-mail,
          meno alebo prezývka a technické údaje potrebné na fungovanie účtu.
        </p>
      </section>
    </div>
  );
}