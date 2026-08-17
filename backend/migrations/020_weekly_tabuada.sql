-- 020 — Tabuada Semanal Premiada
--
-- Módulo independente do desafio diário adaptativo (não escreve em child_fact_mastery,
-- não concede XP, não passa por complete_challenge — ver CLAUDE.md regra "XP só via
-- complete_challenge"). A criança tem de fazer, todos os dias, 100 questões de
-- multiplicação — SEMPRE a tabuada completa 1-10 × 1-10 (as 100 combinações, cada uma
-- exactamente uma vez, sem repetição — independente do `multiplication_max` configurável
-- do desafio diário normal), repartida em 5 blocos fixos de 20, com pelo menos 70% de
-- acerto POR BLOCO. Um bloco que falhe fica "pending" e pode ser retentado (reaproveitando
-- o mesmo conjunto de 20 factos desse bloco — não há sobra no pool de 100 para gerar um
-- conjunto alternativo). O dia fica completo quando os 5 blocos
-- estão "passed". Ao completar 7 dias consecutivos numa semana (segunda a domingo), a
-- criança ganha a "medalha" (sinal para o pai depositar a mesada) — o pai é notificado por
-- WhatsApp pelo cron horário já existente (send-whatsapp-notifications), sem cron novo.

-- ──────────────────────────────────────────────────────────────
-- PROGRESSO DIÁRIO — payload das 100 questões + estado dos 5 blocos
-- ──────────────────────────────────────────────────────────────

create table public.weekly_tabuada_days (
  id                 uuid primary key default gen_random_uuid(),
  child_id           uuid not null references public.child_profiles(id) on delete cascade,
  day_date           date not null,
  -- Array de 100 { position(1..100), block_number(1..5), fact_id, operand_a, operand_b } —
  -- gerado uma vez por start_tabuada_day e nunca regenerado (idempotente, como
  -- challenge_sessions.questions_payload).
  questions_payload  jsonb not null,
  -- Array de 5 { block_number, status: 'pending'|'passed', attempts, best_correct_count,
  -- passed_at }. Mutado por submit_tabuada_block.
  blocks_state       jsonb not null default '[]'::jsonb,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (child_id, day_date)
);

create index idx_weekly_tabuada_days_child_date on public.weekly_tabuada_days (child_id, day_date desc);

alter table public.weekly_tabuada_days enable row level security;

create policy weekly_tabuada_days_read_own on public.weekly_tabuada_days
  for select to authenticated
  using (
    child_id in (select id from public.child_profiles where parent_id = auth.uid())
  );

-- Só as Edge Functions (service_role) escrevem — o cliente nunca grava progresso
-- directamente, mesmo não havendo XP em jogo aqui (mesma lógica de complete_challenge:
-- servidor valida sempre as respostas contra o payload persistido).
create policy weekly_tabuada_days_write_service on public.weekly_tabuada_days
  for all to service_role
  using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- PROGRESSO SEMANAL — contagem de dias completos + medalha
-- ──────────────────────────────────────────────────────────────

create table public.weekly_tabuada_weeks (
  id                 uuid primary key default gen_random_uuid(),
  child_id           uuid not null references public.child_profiles(id) on delete cascade,
  week_start_date    date not null, -- sempre uma segunda-feira
  days_completed     smallint not null default 0 check (days_completed between 0 and 7),
  medal_earned_at    timestamptz,
  -- Reivindicado atomicamente pelo cron (update ... where medal_notified_at is null) antes
  -- de enviar o WhatsApp ao pai — evita notificação duplicada em corridas concorrentes,
  -- mesmo padrão do "insere a linha de dedup antes de enviar" usado em whatsapp_notification_log.
  medal_notified_at  timestamptz,
  updated_at         timestamptz not null default now(),
  unique (child_id, week_start_date)
);

create index idx_weekly_tabuada_weeks_pending_notice
  on public.weekly_tabuada_weeks (child_id)
  where medal_earned_at is not null and medal_notified_at is null;

alter table public.weekly_tabuada_weeks enable row level security;

create policy weekly_tabuada_weeks_read_own on public.weekly_tabuada_weeks
  for select to authenticated
  using (
    child_id in (select id from public.child_profiles where parent_id = auth.uid())
  );

create policy weekly_tabuada_weeks_write_service on public.weekly_tabuada_weeks
  for all to service_role
  using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- NOTIFICAÇÕES — lembretes à criança (até 4x/dia) + aviso da medalha ao pai
-- ──────────────────────────────────────────────────────────────

alter table public.child_notification_settings
  add column if not exists tabuada_reminder_enabled boolean not null default false,
  add column if not exists tabuada_reminder_hours smallint[] not null default '{}';

alter table public.child_notification_settings
  add constraint child_notification_settings_tabuada_hours_max4
    check (array_length(tabuada_reminder_hours, 1) is null or array_length(tabuada_reminder_hours, 1) <= 4);

comment on column public.child_notification_settings.tabuada_reminder_hours is
  'Até 4 horas (0-23, mesmo array de NOTIFICATION_HOURS) em que send-whatsapp-notifications avisa a criança se ainda não completou a tabuada semanal premiada de hoje.';

alter table public.notification_preferences
  add column if not exists tabuada_medal_notice_enabled boolean not null default true;

comment on column public.notification_preferences.tabuada_medal_notice_enabled is
  'Notificação única (não agendada) ao pai quando o filho completa 7 dias seguidos da tabuada semanal premiada — sinal para depositar a mesada.';

alter table public.whatsapp_notification_log
  drop constraint whatsapp_notification_log_notification_type_check;

alter table public.whatsapp_notification_log
  add constraint whatsapp_notification_log_notification_type_check
    check (notification_type in (
      'daily_reminder', 'unfinished_warning', 'completed_notice', 'weekly_summary',
      'tabuada_reminder_1', 'tabuada_reminder_2', 'tabuada_reminder_3', 'tabuada_reminder_4',
      'tabuada_medal_parent'
    ));
