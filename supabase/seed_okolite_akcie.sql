-- =============================================================================
--  VOLITEĽNÉ: Ukážkové dáta pre modul "Akcie v okolí" (Tip na víkend)
-- -----------------------------------------------------------------------------
--  Prečo: tabuľka public.okolite_akcie je zatiaľ PRÁZDNA (0 riadkov), preto sa
--         v Aktualitách nezobrazí žiadna karta. Týmto skriptom ju okamžite
--         naplníš, kým nezačne dáta dopĺňať AI agent (Edge Function).
--
--  Spustenie: Supabase Dashboard -> SQL Editor -> vlož a stlač RUN.
--  Bezpečné: opakované spustenie nič nezduplikuje ani nerozbije
--            (ON CONFLICT vďaka indexu okolite_akcie_unique_idx).
--  Vymazanie ukážkových dát: DELETE FROM public.okolite_akcie;
-- =============================================================================

INSERT INTO public.okolite_akcie (nazov, popis, obec, vzdialenost_km, kategoria, datum_cas, miesto)
VALUES
  ('Ružindolský jesenný jarmok', 'Tradičný jarmok s remeslami, občerstvením a programom pre deti.', 'Ružindol', 0.4, 'trhy', 'Sobota 10.10.2026 od 09:00', 'Námestie pred obecným úradom'),
  ('Susedské posedenie pri víne', 'Ochutnávka miestnych vín spojená s hudbou a občerstvením.', 'Ružindol', 0.6, 'gastronomia', 'Piatok 16.10.2026 od 18:00', 'Kultúrny dom Ružindol'),
  ('Trnavské hody', 'Trojdenné hody s kolotočmi, stánkami a večernými zábavami.', 'Trnava', 12.0, 'hodove', '12.10. – 14.10.2026', 'Námestie sv. Mikuláša'),
  ('Trnavský jesenný jarmok', 'Farmárske a remeselné trhy na pešej zóne.', 'Trnava', 12.1, 'trhy', 'Sobota 17.10.2026 od 08:00', 'Hlavná ulica'),
  ('Koncert komorného orchestra', 'Večerný koncert klasickej hudby v historickom priestore.', 'Trnava', 12.3, 'kultura', 'Nedeľa 18.10.2026 od 19:00', 'Kostol sv. Jakuba'),
  ('Farmárske trhy', 'Čerstvé lokálne produkty, syry, pečivo a sezónna zelenina.', 'Suchá nad Parnou', 7.5, 'trhy', 'Sobota 10.10.2026 od 07:30', 'Park pri kostole'),
  ('Futbalový turnaj OŠK', 'Turnaj mládežníckych družstiev s občerstvením.', 'Cífer', 9.5, 'sport', 'Sobota 17.10.2026 od 13:00', 'Futbalové ihrisko'),
  ('Orešanské hody', 'Krojovaná zábava, sprievod obcou a tradičné hody.', 'Dolné Orešany', 13.0, 'hodove', '25.10. – 26.10.2026', 'Námestie a kultúrny dom'),
  ('Vinobranie a koštovka', 'Ochutnávka burčiaku a vín s cimbálovou hudbou.', 'Dolné Orešany', 13.1, 'gastronomia', 'Sobota 24.10.2026 od 15:00', 'Areál pod hradom'),
  ('Beh okolo Smolenického zámku', 'Komunitný beh pre deti aj dospelých, trasy 3 a 8 km.', 'Smolenice', 18.5, 'sport', 'Nedeľa 11.10.2026 od 10:00', 'Park pri Smolenickom zámku'),
  ('Folklórne popoludnie', 'Vystúpenie miestnych folklórnych súborov.', 'Horné Orešany', 15.0, 'kultura', 'Nedeľa 18.10.2026 od 15:00', 'Kultúrny dom'),
  ('Modranské vinobranie', 'Vinobranie s programom, trhmi a ochutnávkou vín.', 'Modra', 25.0, 'gastronomia', 'Sobota 3.10.2026 od 12:00', 'Námestie Ľudovíta Štúra'),
  ('Koncert v evanjelickom kostole', 'Žalmový a vokálny koncert.', 'Trstín', 15.5, 'kultura', 'Nedeľa 25.10.2026 od 17:00', 'Evanjelický kostol')
ON CONFLICT (nazov, obec, datum_cas) DO NOTHING;

-- Kontrola po vložení:
--   SELECT id, nazov, obec, vzdialenost_km, kategoria, datum_cas
--   FROM public.okolite_akcie
--   ORDER BY vzdialenost_km;
