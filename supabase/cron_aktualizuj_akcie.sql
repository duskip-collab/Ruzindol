-- =============================================================================
--  OPRAVENÝ CRON — automatická aktualizácia modulu "Akcie v okolí"
-- -----------------------------------------------------------------------------
--  Rieši 2 chyby pôvodnej úlohy:
--    1) chýbajúce rozšírenie pg_net  -> bez neho funkcia net.http_post neexistuje
--    2) prázdny Authorization header -> current_setting('request.jwt.claim.role')
--       je v cron kontexte NULL, takže sa posielal 'Bearer ' bez kľúča (401)
--
--  Spustenie: Supabase Dashboard -> SQL Editor -> vlož CELÉ a stlač RUN.
--  Bezpečné spúšťať opakovane (stará úloha sa najprv odstráni).
-- =============================================================================

-- 1) Rozšírenia: pg_cron = plánovač, pg_net = HTTP volania z DB na pozadí
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Odstránenie prípadnej starej úlohy (aby sa skript dal spustiť opakovane)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'tazky-aktualizuj-okolite-akcie') then
    perform cron.unschedule('tazky-aktualizuj-okolite-akcie');
  end if;
end
$$;

-- 3) Naplánovanie: každý pondelok o 02:00 UTC.
--    AKO_KEY nižšie je VEREJNÝ (publishable) anon kľúč — je bezpečné ho tu mať.
--    (Funguje aj service_role kľúč, ale anon úplne stačí — funkcia si service_role
--     berie sama zo svojho prostredia.)
select cron.schedule(
  'tazky-aktualizuj-okolite-akcie',
  '0 2 * * 1',
  $$
  select net.http_post(
    url  := 'https://vzmxbbemhsdbzytzwwxz.supabase.co/functions/v1/aktualizuj-akcie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey',       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bXhiYmVtaHNkYnp5dHp3d3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODExNDEsImV4cCI6MjA5OTI1NzE0MX0.SCe8XA5UQRcys-n5Sfsb97Cb-dd4ol5G9HqE70iTEno',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bXhiYmVtaHNkYnp5dHp3d3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODExNDEsImV4cCI6MjA5OTI1NzE0MX0.SCe8XA5UQRcys-n5Sfsb97Cb-dd4ol5G9HqE70iTEno'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =============================================================================
--  OVERENIE (spusti samostatne po naplánovaní)
-- =============================================================================
-- a) Je úloha naplánovaná a aktívna?
--    select jobid, jobname, schedule, active from cron.job;
--
-- b) História behov (status 'succeeded', prípadná chyba v return_message):
--    select jobid, status, return_message, start_time, end_time
--    from cron.job_run_details order by start_time desc limit 10;
--
-- c) Čo vrátilo samotné HTTP volanie (hľadaj status_code = 200):
--    select id, status_code, content, created
--    from net._http_response order by created desc limit 10;
--
-- d) Koľko akcií je v tabuľke:
--    select count(*) from public.okolite_akcie;
--
-- e) Manuálne spustenie na test (mimo cron):
--    select net.http_post(
--      url  := 'https://vzmxbbemhsdbzytzwwxz.supabase.co/functions/v1/aktualizuj-akcie',
--      headers := jsonb_build_object(
--        'Content-Type', 'application/json',
--        'Authorization', 'Bearer <ANON_KEY>'
--      ),
--      body := '{}'::jsonb
--    );

-- =============================================================================
--  POZNÁMKY
-- -----------------------------------------------------------------------------
--  * pg_cron beží v UTC. '0 2 * * 1' = pondelok 02:00 UTC = 04:00 (letný čas) /
--    03:00 (zimný čas) u nás. Pre 02:00 nášho času použi napr. '0 0 * * 1'.
--  * Voliteľne (bezpečnejšie) môžeš kľúč držať vo Vault a čítať ho takto:
--      select vault.create_secret('<ANON_KEY>', 'okolite_anon');
--      ... 'Authorization', 'Bearer ' || (select decrypted_secret
--            from vault.decrypted_secrets where name = 'okolite_anon')
--  * Ak funkciu nasadíš s --no-verify-jwt, hlavička Authorization nie je nutná,
--    ale ponechať ju je bezpečnejšie (zabraňuje cudziemu spúšťaniu na tvoj účet).
-- =============================================================================
