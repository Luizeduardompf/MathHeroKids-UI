-- ──────────────────────────────────────────────────────────────
-- 007 — Child Fact Mastery + Adaptive Engine columns
-- ──────────────────────────────────────────────────────────────

-- Timezone por crianca (necessario para DP-7: sessao distinta por dia calendario)
alter table public.child_profiles
  add column timezone text not null default 'America/Sao_Paulo';

-- Mastery por crianca x questao
create table public.child_fact_mastery (
  child_id                  uuid not null references public.child_profiles(id) on delete cascade,
  fact_id                   text not null references public.multiplication_facts(id),
  state                     text not null default 'NEW'
                              check (state in ('NEW','LEARNING','REVIEWING','MASTERED','WEAK')),
  times_seen                integer not null default 0 check (times_seen >= 0),
  times_correct             integer not null default 0 check (times_correct >= 0),
  times_wrong               integer not null default 0 check (times_wrong >= 0),
  distinct_sessions_correct integer not null default 0 check (distinct_sessions_correct >= 0),
  consecutive_correct       integer not null default 0,
  consecutive_wrong         integer not null default 0,
  last_seen_at              timestamptz,
  last_correct_at           timestamptz,
  last_wrong_at             timestamptz,
  last_correct_local_date   date,  -- date no timezone da crianca (para DP-7)
  strength                  real not null default 0 check (strength between 0 and 1),
  next_review_at            timestamptz,
  updated_at                timestamptz not null default now(),
  primary key (child_id, fact_id)
);

create index idx_mastery_state on public.child_fact_mastery (child_id, state);
create index idx_mastery_next_review on public.child_fact_mastery (child_id, next_review_at)
  where next_review_at is not null;

-- RLS
alter table public.child_fact_mastery enable row level security;

create policy mastery_read_own on public.child_fact_mastery
  for select to authenticated
  using (
    child_id in (
      select id from public.child_profiles where parent_id = auth.uid()
    )
  );

-- Apenas service_role escreve (via Edge Functions)
create policy mastery_write_service on public.child_fact_mastery
  for all to service_role
  using (true) with check (true);

-- Extensao de challenge_sessions: payload persistido + versao das regras
alter table public.challenge_sessions
  add column questions_payload  jsonb,
  add column rules_version      integer,
  add column selection_metadata jsonb;

-- question_seed agora e legacy. Manter coluna por compatibilidade,
-- mas tornar nullable (novas sessoes nao usam).
alter table public.challenge_sessions
  alter column question_seed drop not null;

comment on column public.challenge_sessions.question_seed is
  'DEPRECATED (Phase 2.5). Sessoes geradas server-side a partir de questions_payload.';

-- Extensao de challenge_answers: fact_id + response time
alter table public.challenge_answers
  add column fact_id          text references public.multiplication_facts(id),
  add column response_time_ms integer;

create index idx_answers_child_fact on public.challenge_answers (fact_id, id)
  where fact_id is not null;
