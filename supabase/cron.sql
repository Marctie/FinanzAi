-- Promemoria giornalieri push: pg_cron chiama la funzione daily-reminders ogni 15 minuti.
-- NON eseguire a mano: lo applica scripts/deploy-functions.mjs sostituendo __PROJECT_URL__ e __CRON_SECRET__
-- (il segreto viene salvato cifrato nel Vault di Supabase, mai nel codice).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = 'daily_reminders_cron_secret';
  if sid is null then
    perform vault.create_secret('__CRON_SECRET__', 'daily_reminders_cron_secret');
  else
    perform vault.update_secret(sid, '__CRON_SECRET__');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'daily-reminders';
select cron.schedule(
  'daily-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '__PROJECT_URL__/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Pulizia settimanale della telemetria già consegnata (eventi > 90 giorni, errori risolti).
select cron.unschedule(jobid) from cron.job where jobname = 'telemetry-purge';
select cron.schedule('telemetry-purge', '30 3 * * 0', $$ select public.telemetry_purge(90); $$);
