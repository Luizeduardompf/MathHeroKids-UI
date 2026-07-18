-- 017 — Sistema de reteste persistente cross-challenge
--
-- Substitui o retestQueue client-side (fim de sessão, efémero) por uma tabela
-- persistente: um erro marca o fato para reteste obrigatório em desafios FUTUROS,
-- até acumular acertos suficientes em sessões/dias distintos. Independente de
-- child_fact_mastery/WEAK (que continuam a medir domínio de longo prazo sem
-- alteração nenhuma) — ver CLAUDE.md secção Challenge para o desenho completo.

create table public.child_fact_retest (
  child_id                uuid not null references public.child_profiles(id) on delete cascade,
  fact_id                 text not null references public.arithmetic_facts(id),
  a_retestar              boolean not null default true,
  retest_correct_streak   integer not null default 0 check (retest_correct_streak >= 0),
  retest_wrong_count      integer not null default 0 check (retest_wrong_count >= 0),
  -- Data local (timezone da criança) do último acerto contado para o streak — evita que
  -- múltiplos desafios no mesmo dia inflem o streak (mesmo critério de child_fact_mastery).
  last_correct_local_date date,
  first_flagged_at        timestamptz not null default now(),
  cleared_at               timestamptz,
  updated_at              timestamptz not null default now(),
  primary key (child_id, fact_id)
);

create index idx_retest_active on public.child_fact_retest (child_id, first_flagged_at)
  where a_retestar = true;

alter table public.child_fact_retest enable row level security;

create policy retest_read_own on public.child_fact_retest
  for select to authenticated
  using (
    child_id in (
      select id from public.child_profiles where parent_id = auth.uid()
    )
  );

-- Apenas service_role escreve (via Edge Functions start_challenge/complete_challenge)
create policy retest_write_service on public.child_fact_retest
  for all to service_role
  using (true) with check (true);

-- Config global simples (key/value), editável em runtime pela tela "Developers".
-- Só a EF update_app_config (service_role) escreve; leitura é pública para autenticados
-- (não é dado sensível, é config de comportamento do motor adaptativo).
create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.app_config enable row level security;

create policy app_config_read_all on public.app_config
  for select to authenticated
  using (true);

create policy app_config_write_service on public.app_config
  for all to service_role
  using (true) with check (true);

insert into public.app_config (key, value) values
  ('retest_correct_threshold', '5'),
  ('retest_percentage', '0.25')
on conflict (key) do nothing;
