-- 019 — Agendamento pg_cron da EF send-whatsapp-notifications
--
-- Mesmo padrão do LukaPsi (whatsapp-reminder-cron / railway-health-check-cron): pg_cron +
-- pg_net, URL e service_role_key lidos do Vault (nunca hardcoded na migration — os valores
-- foram inseridos manualmente via `vault.create_secret` numa sessão de setup, não
-- versionados; ver docs/WHATSAPP_INTEGRATION_ROADMAP.md).
--
-- Corre a cada hora, ao minuto 0 — a EF compara isso com as colunas `*_time` (só a
-- componente da hora) das definições de cada pai/criança.
--
-- NOTA: já aplicada ao remoto em 2026-07-18 (job `whatsapp-notifications-hourly` activo).
-- Reaplicar é seguro — `cron.unschedule` + `cron.schedule` é idempotente por construção.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'whatsapp-notifications-hourly';

select cron.schedule(
  'whatsapp-notifications-hourly',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-whatsapp-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
  $cron$
);
