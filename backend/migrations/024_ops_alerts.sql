-- 024 — Alertas de operação (email) para falhas de infra do WhatsApp/Evolution API.
--
-- Porta o padrão do LukaPsi (railway-health-check + evolution-webhook connection alerts,
-- ver Luka/Luka/supabase/functions/_shared/opsAlert.ts) com uma camada extra que o Luka não
-- tem: detecção de "zombie state" — a Evolution API pode ficar com state='open' em cache
-- sem a sessão real do WhatsApp estar viva (nenhum connection.update chega, mas os envios
-- reais falham com "Connection Closed"). As duas camadas do Luka sozinhas não teriam
-- apanhado esse cenário (servidor no ar → passa no health check; nenhum evento 'close'
-- chegou → o webhook nunca dispara). A 3ª camada mede o resultado REAL dos envios
-- (whatsapp_notification_log), não o que a Evolution diz sobre si mesma.
--
-- Email via relay SMTP do iCloud (mesmo mecanismo do Luka, credenciais PRÓPRIAS deste
-- projecto no Vault — nunca partilhadas com o projecto Luka, mesmo sendo a mesma conta de
-- email por trás).

-- ──────────────────────────────────────────────────────────────
-- ops_alert_settings — singleton, editável em Developer > Alertas de Sistema
-- ──────────────────────────────────────────────────────────────
create table public.ops_alert_settings (
  id boolean primary key default true,
  email text not null,
  from_email text,
  from_name text not null default 'MathHeroKids Ops',
  whatsapp_alert_enabled boolean not null default true,      -- camada 2: connection.update close/open
  railway_alert_enabled boolean not null default true,       -- camada 1: servidor Railway inacessível
  send_failure_alert_enabled boolean not null default true,  -- camada 3: envios reais a falhar (zombie state)
  updated_at timestamptz not null default now(),
  constraint ops_alert_settings_singleton check (id)
);

alter table public.ops_alert_settings enable row level security;

-- Leitura directa para o pai autenticado (ecrã Developer já double-gate por PIN + senha) —
-- escrita só via update_ops_alert_settings EF (valida campos), mesmo padrão de app_config.
create policy "ops_alert_settings_select_authenticated"
  on public.ops_alert_settings for select
  to authenticated
  using (true);

create policy "ops_alert_settings_service_role_all"
  on public.ops_alert_settings for all
  to service_role
  using (true) with check (true);

insert into public.ops_alert_settings (id, email)
values (true, 'luizeduardompf@gmail.com')
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────
-- railway_health_state — estado do último health check (camada 1), só service_role
-- ──────────────────────────────────────────────────────────────
create table public.railway_health_state (
  id boolean primary key default true,
  is_up boolean not null default true,
  last_checked_at timestamptz not null default now(),
  constraint railway_health_state_singleton check (id)
);

alter table public.railway_health_state enable row level security;

insert into public.railway_health_state (id, is_up)
values (true, true)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────
-- whatsapp_send_health_state — estado da camada 3 (zombie state), só service_role.
-- "unhealthy" = o último tick do cron send-whatsapp-notifications teve pelo menos uma
-- tentativa de envio E todas falharam (Connection Closed ou outro erro real da Evolution).
-- ──────────────────────────────────────────────────────────────
create table public.whatsapp_send_health_state (
  id boolean primary key default true,
  is_healthy boolean not null default true,
  last_checked_at timestamptz not null default now(),
  constraint whatsapp_send_health_state_singleton check (id)
);

alter table public.whatsapp_send_health_state enable row level security;

insert into public.whatsapp_send_health_state (id, is_healthy)
values (true, true)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────
-- VAULT — credenciais SMTP do iCloud, só legíveis por service_role.
-- Os valores (icloud_smtp_user/icloud_smtp_password) são inseridos manualmente via
-- vault.create_secret numa sessão de setup, não versionados — mesmo padrão de
-- evolution_api_key (migration 018).
-- ──────────────────────────────────────────────────────────────
create or replace function public.get_icloud_smtp_credentials()
returns json
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  result json;
begin
  select json_build_object(
    'user', (select decrypted_secret from vault.decrypted_secrets where name = 'icloud_smtp_user' limit 1),
    'password', (select decrypted_secret from vault.decrypted_secrets where name = 'icloud_smtp_password' limit 1)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_icloud_smtp_credentials() from public, anon, authenticated;
grant execute on function public.get_icloud_smtp_credentials() to service_role;

-- ──────────────────────────────────────────────────────────────
-- CRON — railway-health-check a cada 5 min (camada 1). Reaplicar é seguro
-- (cron.unschedule + cron.schedule é idempotente).
-- ──────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'railway-health-check';

select cron.schedule(
  'railway-health-check',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/railway-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
