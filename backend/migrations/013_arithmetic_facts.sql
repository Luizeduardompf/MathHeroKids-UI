-- 013 — Generaliza multiplication_facts em arithmetic_facts (multi-operação)
--
-- child_fact_mastery e challenge_answers passam a referenciar arithmetic_facts em vez de
-- multiplication_facts. Os 100 factos de multiplicação são migrados com os MESMOS ids
-- (fact_1x1..fact_10x10) para preservar todo o histórico de mastery já acumulado.

create table public.arithmetic_facts (
  id              text primary key,
  operation       text not null check (operation in ('multiplication','addition','subtraction','division')),
  operand_a       smallint not null,
  operand_b       smallint not null,
  answer          smallint not null,
  fact_group_id   text,  -- null = sem par comutativo (subtração/divisão não são comutativas)
  base_difficulty smallint not null check (base_difficulty between 1 and 5),
  created_at      timestamptz not null default now()
);

create index idx_arith_facts_operation on public.arithmetic_facts (operation);
create index idx_arith_facts_difficulty on public.arithmetic_facts (operation, base_difficulty);
create index idx_arith_facts_group on public.arithmetic_facts (fact_group_id) where fact_group_id is not null;

alter table public.arithmetic_facts enable row level security;

create policy arith_facts_read_authenticated on public.arithmetic_facts
  for select to authenticated
  using (true);

-- Migrar os 100 factos de multiplicação existentes, mesmos ids.
insert into public.arithmetic_facts (id, operation, operand_a, operand_b, answer, fact_group_id, base_difficulty, created_at)
select id, 'multiplication', operand_a, operand_b, answer, fact_group_id, base_difficulty, created_at
from public.multiplication_facts;

-- Repontar FKs de multiplication_facts(id) para arithmetic_facts(id).
alter table public.child_fact_mastery
  drop constraint child_fact_mastery_fact_id_fkey,
  add constraint child_fact_mastery_fact_id_fkey
    foreign key (fact_id) references public.arithmetic_facts(id);

alter table public.challenge_answers
  drop constraint challenge_answers_fact_id_fkey,
  add constraint challenge_answers_fact_id_fkey
    foreign key (fact_id) references public.arithmetic_facts(id);

-- multiplication_facts fica deprecada — não apagada nesta migration (ver nota no handoff),
-- para permitir rollback fácil se algo correr mal. Remover numa migration futura depois de
-- confirmar produção estável com arithmetic_facts.
comment on table public.multiplication_facts is
  'DEPRECATED (Phase E) — substituída por arithmetic_facts. Mantida só para rollback seguro.';
