-- 018 — Integração WhatsApp (Evolution API) + notificações por WhatsApp
--
-- Ver docs/WHATSAPP_INTEGRATION_ROADMAP.md para o desenho completo. Reaproveita a tabela
-- `notification_preferences` (criada na 001, nunca usada por nenhuma UI/EF até agora) como
-- as definições de notificação do PAI em vez de criar uma tabela nova — `daily_reminder` +
-- `reminder_time` já eram exatamente o tipo "lembrete para fazer o desafio do dia".
--
-- Segredos da Evolution API (url/api key/instance) vivem no Supabase Vault, nunca em
-- env var do cliente nem em tabela normal — RPCs SECURITY DEFINER restritas a service_role
-- desde o dia 1 (o LukaPsi teve um leak deste tipo — get_vault_secrets/get_evolution_config
-- lá tinham EXECUTE aberto a PUBLIC/anon/authenticated e foi corrigido depois; aqui já nasce
-- restrito).
--
-- NOTA: esta migration já foi aplicada ao projecto remoto pelhtuspcofmejzqtibx em 2026-07-18
-- (via `supabase db query --linked --file`, dado que não existe supabase/migrations/ ligado
-- a `db push` neste repo — ver CLAUDE.md secção Backend). Reaplicar é seguro (idempotente:
-- `add column if not exists`, `create extension if not exists`); as duas `create table` NÃO
-- são idempotentes — se já existirem, falha com "already exists" e pode ignorar-se.

-- ──────────────────────────────────────────────────────────────
-- NÚMEROS DE WHATSAPP — pai e criança
-- ──────────────────────────────────────────────────────────────

alter table public.parent_profiles
  add column if not exists whatsapp_phone     text,
  add column if not exists whatsapp_phone_ddi text not null default '';

alter table public.child_profiles
  add column if not exists whatsapp_phone     text,
  add column if not exists whatsapp_phone_ddi text not null default '';

-- ──────────────────────────────────────────────────────────────
-- DEFINIÇÕES DO PAI — extende notification_preferences (001)
-- Colunas existentes `daily_reminder`/`reminder_time` passam a ser também o gatilho do
-- tipo "daily_reminder" por WhatsApp (não só push, que nunca chegou a ser implementado).
-- ──────────────────────────────────────────────────────────────

alter table public.notification_preferences
  add column if not exists whatsapp_enabled            boolean not null default false,

  add column if not exists unfinished_warning_enabled  boolean not null default true,
  add column if not exists unfinished_warning_time     time    not null default '19:00:00',

  add column if not exists completed_notice_enabled    boolean not null default false,
  add column if not exists completed_notice_time       time    not null default '20:00:00',

  add column if not exists weekly_summary_enabled       boolean not null default false,
  add column if not exists weekly_summary_weekday       smallint not null default 0
                              check (weekly_summary_weekday between 0 and 6), -- 0 = domingo
  add column if not exists weekly_summary_time          time    not null default '19:00:00',

  add column if not exists created_at                  timestamptz not null default now();

comment on column public.notification_preferences.daily_reminder is
  'Tipo "lembrete para fazer o desafio do dia" — dispara via WhatsApp se whatsapp_enabled e o dia ainda não estiver completed em calendar_days no momento do trigger (reminder_time).';

-- ──────────────────────────────────────────────────────────────
-- DEFINIÇÕES POR CRIANÇA — só 2 tipos, enviados para o número da própria criança
-- ──────────────────────────────────────────────────────────────

create table public.child_notification_settings (
  child_id                    uuid primary key references public.child_profiles(id) on delete cascade,
  whatsapp_enabled             boolean not null default false,

  daily_reminder_enabled       boolean not null default false,
  daily_reminder_time          time    not null default '16:00:00',

  unfinished_warning_enabled   boolean not null default false,
  unfinished_warning_time      time    not null default '19:00:00',

  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

alter table public.child_notification_settings enable row level security;

create policy child_notification_settings_read_own on public.child_notification_settings
  for select to authenticated
  using (
    child_id in (select id from public.child_profiles where parent_id = auth.uid())
  );

create policy child_notification_settings_write_own on public.child_notification_settings
  for all to authenticated
  using (
    child_id in (select id from public.child_profiles where parent_id = auth.uid())
  )
  with check (
    child_id in (select id from public.child_profiles where parent_id = auth.uid())
  );

-- Edge Functions (service_role) precisam de ler todas as linhas para o cron de envio
create policy child_notification_settings_read_service on public.child_notification_settings
  for select to service_role
  using (true);

-- ──────────────────────────────────────────────────────────────
-- LOG DE ENVIOS — dedup (1 envio por tipo/dia/destinatário) + auditoria
-- ──────────────────────────────────────────────────────────────

create table public.whatsapp_notification_log (
  id                    uuid primary key default gen_random_uuid(),
  parent_id             uuid not null references public.parent_profiles(id) on delete cascade,
  child_id              uuid references public.child_profiles(id) on delete cascade,
  target                text not null check (target in ('parent', 'child')),
  notification_type     text not null check (
                           notification_type in ('daily_reminder', 'unfinished_warning', 'completed_notice', 'weekly_summary')
                         ),
  recipient_phone       text not null,
  send_date             date not null,
  status                text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  evolution_message_id  text,
  error_detail          text,
  created_at            timestamptz not null default now()
);

-- Dedup: para envios "por criança" (completed_notice/daily_reminder/unfinished_warning
-- associados a uma criança específica), único por (parent, child, target, tipo, dia).
create unique index uq_whatsapp_log_child
  on public.whatsapp_notification_log (parent_id, child_id, target, notification_type, send_date)
  where child_id is not null;

-- Dedup: para envios agregados ao pai sem criança específica (ex.: weekly_summary combinado),
-- único por (parent, target, tipo, dia).
create unique index uq_whatsapp_log_parent
  on public.whatsapp_notification_log (parent_id, target, notification_type, send_date)
  where child_id is null;

create index idx_whatsapp_log_parent_date on public.whatsapp_notification_log (parent_id, send_date desc);

alter table public.whatsapp_notification_log enable row level security;

create policy whatsapp_log_read_own on public.whatsapp_notification_log
  for select to authenticated
  using (parent_id = auth.uid());

-- Só Edge Functions escrevem
create policy whatsapp_log_write_service on public.whatsapp_notification_log
  for all to service_role
  using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- EVENTOS BRUTOS DO WEBHOOK — só service_role (nunca exposto ao cliente, nem ao
-- ecrã Developer directamente — este lê status/QR sempre via evolution-dev EF)
-- ──────────────────────────────────────────────────────────────

create table public.whatsapp_events (
  id          uuid primary key default gen_random_uuid(),
  event       text not null,
  instance    text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index idx_whatsapp_events_created on public.whatsapp_events (created_at desc);

alter table public.whatsapp_events enable row level security;

create policy whatsapp_events_service_only on public.whatsapp_events
  for all to service_role
  using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- VAULT — segredos da Evolution API, só legíveis por service_role
-- ──────────────────────────────────────────────────────────────

create extension if not exists supabase_vault;

create or replace function public.get_evolution_config()
returns json
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  result json;
begin
  select json_object_agg(name, decrypted_secret) into result
  from vault.decrypted_secrets
  where name in ('evolution_api_url', 'evolution_api_key', 'evolution_instance_name');
  return result;
end;
$$;

revoke all on function public.get_evolution_config() from public, anon, authenticated;
grant execute on function public.get_evolution_config() to service_role;

create or replace function public.get_vault_secrets(secret_names text[])
returns table(name text, value text)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
  select decrypted_secrets.name, decrypted_secrets.decrypted_secret
  from vault.decrypted_secrets
  where decrypted_secrets.name = any(secret_names);
end;
$$;

revoke all on function public.get_vault_secrets(text[]) from public, anon, authenticated;
grant execute on function public.get_vault_secrets(text[]) to service_role;
