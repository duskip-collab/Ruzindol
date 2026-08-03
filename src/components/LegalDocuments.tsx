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
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden rounded-[1.5rem] border-border bg-background p-0 text-foreground">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle className="text-xl">
            {showingTerms ? "Podmienky používania" : "Ochrana osobných údajov (GDPR)"}
          </DialogTitle>
          <DialogDescription>
            Prehľad pravidiel komunity, používania služby a spracúvania osobných údajov.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b border-border px-6 py-4">
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

        <div className="overflow-y-auto px-6 py-5">
          {showingTerms ? <TermsContent /> : <PrivacyContent />}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
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
          <FileText className="h-4 w-4" /> Základ používania
        </div>
        <p>
          Aplikácia Komunita slúži na susedskú komunikáciu, lokálne oznamy a koordináciu aktivít v
          komunite. Používaním služby potvrdzuješ, že poskytuješ pravdivé údaje a budeš aplikáciu
          používať v súlade s právnymi predpismi Slovenskej republiky.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" /> Pravidlá komunity
        </div>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Publikuj len obsah, ktorý súvisí s komunitou a neporušuje zákon ani práva tretích osôb.</li>
          <li>Zakázané sú urážky, nenávistný obsah, klamlivé informácie a zneužívanie identity.</li>
          <li>Pri inzerátoch a výmenách nesieš zodpovednosť za pravdivosť ponuky a podmienky dohody.</li>
          <li>Opakované porušovanie pravidiel môže viesť k obmedzeniu alebo zrušeniu účtu.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Scale className="h-4 w-4" /> Obmedzenie zodpovednosti
        </div>
        <p>
          Prevádzkovateľ nezodpovedá za obsah vytvorený používateľmi, výsledok susedských dohôd,
          kvalitu ponúkaných vecí ani škody spôsobené nepravdivými informáciami od tretích strán.
          Môže však odstrániť obsah alebo obmedziť účet, ak je to potrebné na ochranu komunity alebo
          splnenie zákonných povinností.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" /> Ochrana proti spamu
        </div>
        <p>
          Nie je dovolené hromadné rozosielanie reklamy, automatizované vytváranie účtov, opakované
          zasielanie nevyžiadanej komunikácie ani zneužívanie notifikácií. Prevádzkovateľ si vyhradzuje
          právo blokovať podozrivé aktivity a príspevky, ktoré narúšajú bežné fungovanie aplikácie.
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
          <ShieldCheck className="h-4 w-4" /> Aké údaje spracúvame
        </div>
        <p>
          Pri registrácii a používaní aplikácie spracúvame len nevyhnutné údaje: e-mail, meno alebo
          prezývku a voliteľne adresné údaje profilu, ktoré zadáš pre fungovanie komunitných funkcií.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" /> Účel spracúvania
        </div>
        <p>
          Tieto údaje používame na vytvorenie a správu účtu, zobrazenie identity v komunite,
          doručovanie systémových správ a zabezpečenie základného fungovania aplikácie.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Trash2 className="h-4 w-4" /> Tvoje práva podľa GDPR
        </div>
        <p>
          Kedykoľvek môžeš požiadať o výmaz účtu. V profile je dostupné tlačidlo na zmazanie účtu,
          ktoré odstráni tvoj autentifikačný účet aj naviazané používateľské dáta v rozsahu,
          ktorý systém technicky eviduje. Máš tiež právo na prístup k údajom a ich opravu.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Scale className="h-4 w-4" /> Uchovávanie a bezpečnosť
        </div>
        <p>
          Údaje uchovávame len počas trvania účtu alebo dovtedy, kým je to potrebné na splnenie
          prevádzkových a zákonných povinností. Pri spracúvaní využívame technické a organizačné
          opatrenia primerané rozsahu služby.
        </p>
      </section>
    </div>
  );
}