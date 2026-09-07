import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Loader2 } from "lucide-react";
import { HelpGuideEditPanel } from "@/components/HelpGuideEditPanel";

type HelpSection = {
  id: string;
  section_key: string;
  section_title: string;
  section_emoji: string;
  section_order: number;
  content: {
    description: string;
    items: Array<{
      label: string;
      text: string;
    }>;
  };
  updated_at: string;
};

export function HelpGuidePanel() {
  const isAdmin = useIsAdmin();
  const [sections, setSections] = useState<HelpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSections = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from("help_guide_sections")
          .select("*")
          .eq("is_active", true)
          .order("section_order", { ascending: true });

        if (fetchError) {
          console.warn(
            "Help guide sections not found in DB, using fallback content"
          );
          // Fallback na hardkódovaný obsah ak tabuľka neexistuje
          setSections(getFallbackSections());
          setError(null);
        } else {
          setSections(data || []);
        }
      } catch (err) {
        console.error("Error loading help sections:", err);
        // Na chybu, použi fallback
        setSections(getFallbackSections());
      } finally {
        setLoading(false);
      }
    };

    loadSections();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ak je admin, zobraz edit panel
  if (isAdmin) {
    return (
      <div className="space-y-4">
        <HelpGuideEditPanel />
      </div>
    );
  }

  // Normálni používatelia - zobraz obsah
  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-sky-50 to-blue-50 p-5 dark:from-sky-950/40 dark:to-blue-950/40">
        <h2 className="text-lg font-bold text-foreground">
          📖 Kompletná nápoveda k aplikácii Moji Susedia
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vitajte v užívateľskej príručke aplikácie{" "}
          <strong>Moji Susedia</strong>, ktorá vám pomôže zorientovať sa vo
          všetkých jej funkciách, sekciách a možnostiach nastavenia.
        </p>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <section
          key={section.id}
          className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-sm"
        >
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
            <span className="text-lg">{section.section_emoji}</span>{" "}
            {section.section_title}
          </h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {section.content?.description}
          </p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {section.content?.items?.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="font-semibold text-foreground min-w-fit">
                  • {item.label}:
                </span>
                <span className="whitespace-pre-wrap">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Footer */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:from-amber-950/40 dark:to-orange-950/40">
        <p className="text-sm text-muted-foreground leading-relaxed">
          💡 <strong>Ďakujeme,</strong> že používate aplikáciu Moji Susedia.
          Ak máte otázky alebo návrhy na zlepšenie, neváhajte nás kontaktovať
          prostredníctvom správ alebo kontaktného formulára v aplikácii.
        </p>
      </div>
    </div>
  );
}

// Fallback hardkódovaný obsah
function getFallbackSections(): HelpSection[] {
  return [
    {
      id: "1",
      section_key: "notifications",
      section_title: "1. Zvonček a notifikácie (Dôležité upozornenia)",
      section_emoji: "🔔",
      section_order: 1,
      content: {
        description:
          "Ikona zvončeka v hornej lište aplikácie slúži ako vaše priame prepojenie s dianím v obci a okolí:",
        items: [
          {
            label: "Ako to funguje",
            text: "Po kliknutí na ikonu zvončeka sa vám zotriedene zobrazia všetky dôležité upozornenia a správy.",
          },
          {
            label: "Reálne notifikácie",
            text: "Vďaka notifikáciám dostávate okamžité upozornenia priamo z obecného úradu v prípade mimoriadnych udalostí (napr. nečakané odstávky, výstrahy pred počasím, havárie) alebo dôležitých oznamov.",
          },
          {
            label: "Ako si ich zapnúť",
            text: "1. Kliknite na ikonu zvončeka 🔔\n2. Ak sa vám zobrazuje nápoveda, kliknite na \"Kliknúť a povoliť\"\n3. V kontextovom okne vášho zariadenia potvrďte povolenie notifikácií\n💡 Tip: Zelená pulzujúca bodka pri zvončeku vás upozorňuje na to, že ešte nemáte povolené doručovanie upozornení do zariadenia.",
          },
        ],
      },
      updated_at: new Date().toISOString(),
    },
    {
      id: "2",
      section_key: "nastenka",
      section_title: "2. Nástenka a Susedský život",
      section_emoji: "📄",
      section_order: 2,
      content: {
        description:
          "Nástenka je hlavným srdcom celej aplikácie, kde prebieha každodenný život komunity.",
        items: [
          {
            label: "Čo sa tu zobrazuje",
            text: "Príspevky, postrehy, otázky a oznamy, ktoré vkladajú samotní obyvatelia a susedia.",
          },
          {
            label: "Kto to pridáva",
            text: "Overení obyvatelia komunity.",
          },
          {
            label: "Typy príspevkov",
            text: "Otázky: Potrebujete poradiť, zohnať odporúčanie na remeselníka alebo sa opýtať na dianie v obci?\nStraty a nálezy: Stratili ste kľúče, domáceho miláčika, alebo ste niečo našli? K príspevku môžete pridať fotku, čo výrazne zvýší šancu na úspešné nájdenie.\nInformácie pre susedov: Dôležité upozornenia, pozvánky na susedské stretnutia alebo zaujímavosti z okolia.",
          },
        ],
      },
      updated_at: new Date().toISOString(),
    },
    {
      id: "3",
      section_key: "aktuality",
      section_title: "3. Aktuality (Obecný hlásnik)",
      section_emoji: "📢",
      section_order: 3,
      content: {
        description:
          "Táto sekcia slúži na oficiálne informácie, oznamy a prehľad harmonogramov súvisiacich s chodom obce Ružindol.",
        items: [
          {
            label: "Podnety",
            text: "Priestor, kde môžu občania posielať svoje podnety, nápady na zlepšenie alebo hlásiť nedostatky v obci.",
          },
          {
            label: "Zdieľaný kalendár",
            text: "Prehľad všetkých blížiacich sa kultúrnych, spoločenských či športových akcií v obci.",
          },
          {
            label: "Oznamy obce",
            text: "Oficiálne správy a nariadenia z obecného úradu.",
          },
          {
            label: "Kalendár zberu odpadov",
            text: "Praktický harmonogram vývozu jednotlivých druhov odpadu, aby ste vždy vedeli, kedy akú nádobu vyložiť.",
          },
          {
            label: "Stránkové dni",
            text: "Úradné hodiny a dni, kedy je obecný úrad otvorený pre verejnosť.",
          },
          {
            label: "Digitálny rozhlas",
            text: "Textová podoba obecného rozhlasu pre prípad, že ste zmeškali hlásenie vonku.",
          },
        ],
      },
      updated_at: new Date().toISOString(),
    },
    {
      id: "4",
      section_key: "komunita",
      section_title: "4. Špeciálne komunitné sekcie pre Ružindol",
      section_emoji: "🛡️",
      section_order: 4,
      content: {
        description:
          "Aplikácia spája rôzne zložky a komunity pôsobiace priamo v obci:",
        items: [
          {
            label: "OŠK Ružindol",
            text: "Oficiálna sekcia miestneho športového klubu. Nájdete tu výsledky zápasov, športové oznamy a pozvánky na podujatia.",
          },
          {
            label: "DHZ Ružindol",
            text: "Dobrovoľný hasičský zbor. Informácie o činnosti našich hasičov, výcvikoch, súťažiach či preventívnych opatreniach a požiarnych vyhliadkach v obci.",
          },
          {
            label: "Dôchodcovia Ružindol",
            text: "Vyhradený priestor pre seniorskú komunitu a klub dôchodcov, kde sa zdieľajú informácie o stretnutiach, výletoch a aktivitách.",
          },
          {
            label: "Farnosť",
            text: "Miesto pre farské oznamy. Miestny farár alebo správca tu zverejňuje poriadok svätých omší, úradné hodiny farského úradu, pozvánky na farské akcie.",
          },
          {
            label: "Služby a firmy",
            text: "Katalóg overených lokálnych firiem, remeselníkov a poskytovateľov služieb, ktorí pôsobia v blízkosti našej komunity.",
          },
        ],
      },
      updated_at: new Date().toISOString(),
    },
    {
      id: "5",
      section_key: "sklad",
      section_title: "5. 📦 Sklad (Trh a zdieľanie)",
      section_emoji: "📦",
      section_order: 5,
      content: {
        description:
          "Sekcia Sklad slúži na ekologické a ekonomické zdieľanie vecí medzi susedmi. Delí sa na tri podkategórie:",
        items: [
          {
            label: "Susedský trh",
            text: "Miesto, kde môžete ponúknuť na predaj alebo výmenu veci, ktoré už nepotrebujete, prípadne pohľadať to, čo iní ponúkajú.",
          },
          {
            label: "Darovanie",
            text: "Sekcia pre veci, ktoré darujete za odvoz (napr. prebytočný materiál, knihy, oblečenie či rastliny).",
          },
          {
            label: "Susedská požičovňa",
            text: "Ponuka náradia, záhradnej techniky či pomôcok (rebríky, kosačky, vŕtačky), ktoré si susedia vedia navzájom požičať.",
          },
        ],
      },
      updated_at: new Date().toISOString(),
    },
    {
      id: "6",
      section_key: "spravy",
      section_title: "6. 💬 Správy",
      section_emoji: "💬",
      section_order: 6,
      content: {
        description:
          "Správy sa aktivujú vtedy, keď zareagujete na inzerát alebo ponuku iného suseda.",
        items: [
          {
            label: "Kedy sa zobrazujú",
            text: "Správy sa aktivujú vtedy, keď zareagujete na inzerát alebo ponuku iného suseda (napr. v Sklade).",
          },
          {
            label: "Účel",
            text: "Slúžia výhradne na vzájomnú dohodu ohľadom vyzdvihnutia veci, termínu alebo upresnenia podrobností k inzerátu.",
          },
          {
            label: "Upozornenie",
            text: "Nejedná sa o platformu na všeobecné chatovanie – na bežnú komunikáciu slúžia iné četové aplikácie.",
          },
        ],
      },
      updated_at: new Date().toISOString(),
    },
    {
      id: "7",
      section_key: "profil",
      section_title: "7. 👤 Profil a Nastavenia",
      section_emoji: "👤",
      section_order: 7,
      content: {
        description:
          "V sekcii Profil nájdete kompletnú správu svojho účtu a aplikácie:",
        items: [
          {
            label: "Osobné informácie",
            text: "Možnosť zmeniť si svoje údaje a prispôsobiť profil.",
          },
          {
            label: "Nastavenie notifikácií",
            text: "Správa upozornení, aby vám nič dôležité neuniklo.",
          },
          {
            label: "Veľkosť písma",
            text: "Možnosť prispôsobiť si veľkosť textu v aplikácii pre čo najpohodlnejšie čítanie.",
          },
          {
            label: "Panel rolí",
            text: "Informácie o vašich oprávneniach a priradených úlohach v systéme.",
          },
          {
            label: "Pozvať suseda",
            text: "Jednoduchá možnosť, ako vygenerovať pozvánku a privítať v aplikácii ďalších členov susedstva.",
          },
          {
            label: "Moje inzeráty",
            text: "Správa vašich publikovaných ponúk. Svoje inzeráty tu môžete kedykoľvek upraviť, vymazať alebo ich nanovo publikovať, ak sú opäť aktuálne.",
          },
          {
            label: "Účet a odhlásenie",
            text: "Možnosť bezpečného odhlásenia sa zo zariadenia, prípadne trvalého zmazania účtu, ak sa rozhodnete aplikáciu viac nepoužívať.",
          },
        ],
      },
      updated_at: new Date().toISOString(),
    },
  ];
}
