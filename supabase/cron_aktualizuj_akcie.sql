-- Automatické generovanie obsahu pre "Akcie v okolí".
--
-- Pred spustením ulož Supabase anon JWT kľúč do Vault (SQL Editor):
--   create extension if not exists supabase_vault with schema vault;
--   select vault.create_secret('<SUPABASE_ANON_JWT>', 'edge_anon_key');
-- Nahraď placeholder skutočným anon JWT kľúčom; kľúč nevkladaj do tohto súboru.
-- Skontroluj, že secret existuje:
--   select name from vault.decrypted_secrets where name = 'edge_anon_key';
--
-- Potom spusti tento celý skript. Funkcie musia byť nasadené a GEMINI_API_KEY
-- musí byť nastavený v Supabase Edge Function Secrets.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'edge_anon_key'
  ) then
    raise exception 'Najprv ulož anon JWT kľúč do Vault pod názvom edge_anon_key.';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tazky-aktualizuj-okolite-akcie') then
    perform cron.unschedule('tazky-aktualizuj-okolite-akcie');
  end if;
  if exists (select 1 from cron.job where jobname = 'tazky-generuj-tyzdenny-sumar') then
    perform cron.unschedule('tazky-generuj-tyzdenny-sumar');
  end if;
  -- Modul "Správy z regiónu" bol zrušený – odoberieme jeho legacy job, ak ešte existuje.
  if exists (select 1 from cron.job where jobname = 'denne-aktualizuj-region-spravy') then
    perform cron.unschedule('denne-aktualizuj-region-spravy');
  end if;
end
$$;

-- Akcie sa obnovujú každý pondelok o 02:00 UTC.
select cron.schedule(
  'tazky-aktualizuj-okolite-akcie',
  '0 2 * * 1',
  $$
  select net.http_post(
    url := 'https://vzmxbbemhsdbzytzwwxz.supabase.co/functions/v1/aktualizuj-akcie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'edge_anon_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Kontrola naplánovania a výsledkov:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'tazky-aktualizuj-okolite-akcie';
-- select jobid, status, return_message, start_time, end_time
-- from cron.job_run_details order by start_time desc limit 10;
-- select id, status_code, content, created
-- from net._http_response order by created desc limit 10;
