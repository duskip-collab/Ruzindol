-- Create help_guide_sections table for storing editable help guide content
CREATE TABLE IF NOT EXISTS help_guide_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  section_title TEXT NOT NULL,
  section_emoji TEXT,
  section_order INT NOT NULL,
  content JSONB NOT NULL, -- Stores the full section content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE help_guide_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active sections
CREATE POLICY "Anyone can read active help sections"
  ON help_guide_sections FOR SELECT
  USING (is_active = true);

-- Policy: Only admins can update sections
CREATE POLICY "Admins can update help sections"
  ON help_guide_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
    )
  );

-- Policy: Only admins can insert sections
CREATE POLICY "Admins can insert help sections"
  ON help_guide_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
    )
  );

-- Create index for faster lookups
CREATE INDEX help_guide_sections_key_idx ON help_guide_sections(section_key);
CREATE INDEX help_guide_sections_order_idx ON help_guide_sections(section_order);

-- Insert default sections
INSERT INTO help_guide_sections (section_key, section_title, section_emoji, section_order, content, is_active)
VALUES
  (
    'notifications',
    '1. Zvonček a notifikácie (Dôležité upozornenia)',
    '🔔',
    1,
    '{"description": "Ikona zvončeka v hornej lište aplikácie slúži ako vaše priame prepojenie s dianím v obci a okolí:", "items": [{"label": "Ako to funguje", "text": "Po kliknutí na ikonu zvončeka sa vám zotriedene zobrazia všetky dôležité upozornenia a správy."}, {"label": "Reálne notifikácie", "text": "Vďaka notifikáciám dostávate okamžité upozornenia priamo z obecného úradu v prípade mimoriadnych udalostí (napr. nečakané odstávky, výstrahy pred počasím, havárie) alebo dôležitých oznamov."}, {"label": "Ako si ich zapnúť", "text": "1. Kliknite na ikonu zvončeka 🔔\n2. Ak sa vám zobrazuje nápoveda, kliknite na \"Kliknúť a povoliť\"\n3. V kontextovom okne vášho zariadenia potvrďte povolenie notifikácií\n💡 Tip: Zelená pulzujúca bodka pri zvončeku vás upozorňuje na to, že ešte nemáte povolené doručovanie upozornení do zariadenia."}]}'::jsonb,
    true
  ),
  (
    'nastenka',
    '2. Nástenka a Susedský život',
    '📄',
    2,
    '{"description": "Nástenka je hlavným srdcom celej aplikácie, kde prebieha každodenný život komunity.", "items": [{"label": "Čo sa tu zobrazuje", "text": "Príspevky, postrehy, otázky a oznamy, ktoré vkladajú samotní obyvatelia a susedia."}, {"label": "Kto to pridáva", "text": "Overení obyvatelia komunity."}, {"label": "Typy príspevkov", "text": "Otázky: Potrebujete poradiť, zohnať odporúčanie na remeselníka alebo sa opýtať na dianie v obci?\nStraty a nálezy: Stratili ste kľúče, domáceho miláčika, alebo ste niečo našli? K príspevku môžete pridať fotku, čo výrazne zvýši šancu na úspešné nájdenie.\nInformácie pre susedov: Dôležité upozornenia, pozvánky na susedské stretnutia alebo zaujímavosti z okolia."}]}'::jsonb,
    true
  ),
  (
    'aktuality',
    '3. Aktuality (Obecný hlásnik)',
    '📢',
    3,
    '{"description": "Táto sekcia slúži na oficiálne informácie, oznamy a prehľad harmonogramov súvisiacich s chodom obce Ružindol.", "items": [{"label": "Podnety", "text": "Priestor, kde môžu občania posielať svoje podnety, nápady na zlepšenie alebo hlásiť nedostatky v obci."}, {"label": "Zdieľaný kalendár", "text": "Prehľad všetkých blížiacich sa kultúrnych, spoločenských či športových akcií v obci."}, {"label": "Oznamy obce", "text": "Oficiálne správy a nariadenia z obecného úradu."}, {"label": "Kalendár zberu odpadov", "text": "Praktický harmonogram vývozu jednotlivých druhov odpadu, aby ste vždy vedeli, kedy akú nádobu vyložiť."}, {"label": "Stránkové dni", "text": "Úradné hodiny a dni, kedy je obecný úrad otvorený pre verejnosť."}, {"label": "Digitálny rozhlas", "text": "Textová podoba obecného rozhlasu pre prípad, že ste zmeškali hlásenie vonku."}]}'::jsonb,
    true
  ),
  (
    'komunita',
    '4. Špeciálne komunitné sekcie pre Ružindol',
    '🛡️',
    4,
    '{"description": "Aplikácia spája rôzne zložky a komunity pôsobiace priamo v obci:", "items": [{"label": "OŠK Ružindol", "text": "Oficiálna sekcia miestneho športového klubu. Nájdete tu výsledky zápasov, športové oznamy a pozvánky na podujatia."}, {"label": "DHZ Ružindol", "text": "Dobrovoľný hasičský zbor. Informácie o činnosti našich hasičov, výcvikoch, súťažiach či preventívnych opatreniach a požiarnych vyhliadkach v obci."}, {"label": "Dôchodcovia Ružindol", "text": "Vyhradený priestor pre seniorskú komunitu a klub dôchodcov, kde sa zdieľajú informácie o stretnutiach, výletoch a aktivitách."}, {"label": "Farnosť", "text": "Miesto pre farské oznamy. Miestny farár alebo správca tu zverejňuje poriadok svätých omší, úradné hodiny farského úradu, pozvánky na farské akcie."}, {"label": "Služby a firmy", "text": "Katalóg overených lokálnych firiem, remeselníkov a poskytovateľov služieb, ktorí pôsobia v blízkosti našej komunity."}]}'::jsonb,
    true
  ),
  (
    'sklad',
    '5. 📦 Sklad (Trh a zdieľanie)',
    '📦',
    5,
    '{"description": "Sekcia Sklad slúži na ekologické a ekonomické zdieľanie vecí medzi susedmi. Delí sa na tri podkategórie:", "items": [{"label": "Susedský trh", "text": "Miesto, kde môžete ponúknuť na predaj alebo výmenu veci, ktoré už nepotrebujete, prípadne pohľadať to, čo iní ponúkajú."}, {"label": "Darovanie", "text": "Sekcia pre veci, ktoré darujete za odvoz (napr. prebytočný materiál, knihy, oblečenie či rastliny)."}, {"label": "Susedská požičovňa", "text": "Ponuka náradia, záhradnej techniky či pomôcok (rebríky, kosačky, vŕtačky), ktoré si susedia vedia navzájom požičať."}]}'::jsonb,
    true
  ),
  (
    'spravy',
    '6. 💬 Správy',
    '💬',
    6,
    '{"description": "Správy sa aktivujú vtedy, keď zareagujete na inzerát alebo ponuku iného suseda.", "items": [{"label": "Kedy sa zobrazujú", "text": "Správy sa aktivujú vtedy, keď zareagujete na inzerát alebo ponuku iného suseda (napr. v Sklade)."}, {"label": "Účel", "text": "Slúžia výhradne na vzájomnú dohodu ohľadom vyzdvihnutia veci, termínu alebo upresnenia podrobností k inzerátu."}, {"label": "Upozornenie", "text": "Nejedná sa o platformu na všeobecné chatovanie – na bežnú komunikáciu slúžia iné četové aplikácie."}]}'::jsonb,
    true
  ),
  (
    'profil',
    '7. 👤 Profil a Nastavenia',
    '👤',
    7,
    '{"description": "V sekcii Profil nájdete kompletnú správu svojho účtu a aplikácie:", "items": [{"label": "Osobné informácie", "text": "Možnosť zmeniť si svoje údaje a prispôsobiť profil."}, {"label": "Nastavenie notifikácií", "text": "Správa upozornení, aby vám nič dôležité neuniklo."}, {"label": "Veľkosť písma", "text": "Možnosť prispôsobiť si veľkosť textu v aplikácii pre čo najpohodlnejšie čítanie."}, {"label": "Panel rolí", "text": "Informácie o vašich oprávneniach a priradených úlohach v systéme."}, {"label": "Pozvať suseda", "text": "Jednoduchá možnosť, ako vygenerovať pozvánku a privítať v aplikácii ďalších členov susedstva."}, {"label": "Moje inzeráty", "text": "Správa vašich publikovaných ponúk. Svoje inzeráty tu môžete kedykoľvek upraviť, vymazať alebo ich nanovo publikovať, ak sú opäť aktuálne."}, {"label": "Účet a odhlásenie", "text": "Možnosť bezpečného odhlásenia sa zo zariadenia, prípadne trvalého zmazania účtu, ak sa rozhodnete aplikáciu viac nepoužívať."}]}'::jsonb,
    true
  )
ON CONFLICT (section_key) DO NOTHING;
