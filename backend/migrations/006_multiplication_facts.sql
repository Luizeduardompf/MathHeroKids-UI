-- ──────────────────────────────────────────────────────────────
-- 006 — Multiplication Facts (Phase 2.5)
-- Catalogo estatico das 100 questoes (1x1..10x10)
-- ──────────────────────────────────────────────────────────────

create table public.multiplication_facts (
  id              text primary key,
  operand_a       smallint not null check (operand_a between 1 and 10),
  operand_b       smallint not null check (operand_b between 1 and 10),
  answer          smallint not null,
  fact_group_id   text not null,
  base_difficulty smallint not null check (base_difficulty between 1 and 5),
  created_at      timestamptz not null default now()
);

create index idx_facts_difficulty on public.multiplication_facts (base_difficulty);
create index idx_facts_group on public.multiplication_facts (fact_group_id);
create index idx_facts_operands on public.multiplication_facts (operand_a, operand_b);

-- RLS: leitura publica autenticada (catalogo estatico)
alter table public.multiplication_facts enable row level security;

create policy facts_read_authenticated on public.multiplication_facts
  for select to authenticated
  using (true);

-- Seed completo (100 rows)
insert into public.multiplication_facts (id, operand_a, operand_b, answer, fact_group_id, base_difficulty) values
  ('fact_1x1', 1, 1, 1, 'group_1x1', 1),
  ('fact_1x2', 1, 2, 2, 'group_1x2', 1),
  ('fact_1x3', 1, 3, 3, 'group_1x3', 1),
  ('fact_1x4', 1, 4, 4, 'group_1x4', 1),
  ('fact_1x5', 1, 5, 5, 'group_1x5', 1),
  ('fact_1x6', 1, 6, 6, 'group_1x6', 1),
  ('fact_1x7', 1, 7, 7, 'group_1x7', 1),
  ('fact_1x8', 1, 8, 8, 'group_1x8', 1),
  ('fact_1x9', 1, 9, 9, 'group_1x9', 1),
  ('fact_1x10', 1, 10, 10, 'group_1x10', 1),
  ('fact_2x1', 2, 1, 2, 'group_1x2', 1),
  ('fact_2x2', 2, 2, 4, 'group_2x2', 2),
  ('fact_2x3', 2, 3, 6, 'group_2x3', 2),
  ('fact_2x4', 2, 4, 8, 'group_2x4', 2),
  ('fact_2x5', 2, 5, 10, 'group_2x5', 2),
  ('fact_2x6', 2, 6, 12, 'group_2x6', 2),
  ('fact_2x7', 2, 7, 14, 'group_2x7', 2),
  ('fact_2x8', 2, 8, 16, 'group_2x8', 2),
  ('fact_2x9', 2, 9, 18, 'group_2x9', 2),
  ('fact_2x10', 2, 10, 20, 'group_2x10', 2),
  ('fact_3x1', 3, 1, 3, 'group_1x3', 1),
  ('fact_3x2', 3, 2, 6, 'group_2x3', 2),
  ('fact_3x3', 3, 3, 9, 'group_3x3', 2),
  ('fact_3x4', 3, 4, 12, 'group_3x4', 3),
  ('fact_3x5', 3, 5, 15, 'group_3x5', 2),
  ('fact_3x6', 3, 6, 18, 'group_3x6', 3),
  ('fact_3x7', 3, 7, 21, 'group_3x7', 3),
  ('fact_3x8', 3, 8, 24, 'group_3x8', 3),
  ('fact_3x9', 3, 9, 27, 'group_3x9', 3),
  ('fact_3x10', 3, 10, 30, 'group_3x10', 2),
  ('fact_4x1', 4, 1, 4, 'group_1x4', 1),
  ('fact_4x2', 4, 2, 8, 'group_2x4', 2),
  ('fact_4x3', 4, 3, 12, 'group_3x4', 3),
  ('fact_4x4', 4, 4, 16, 'group_4x4', 2),
  ('fact_4x5', 4, 5, 20, 'group_4x5', 2),
  ('fact_4x6', 4, 6, 24, 'group_4x6', 3),
  ('fact_4x7', 4, 7, 28, 'group_4x7', 4),
  ('fact_4x8', 4, 8, 32, 'group_4x8', 4),
  ('fact_4x9', 4, 9, 36, 'group_4x9', 3),
  ('fact_4x10', 4, 10, 40, 'group_4x10', 2),
  ('fact_5x1', 5, 1, 5, 'group_1x5', 1),
  ('fact_5x2', 5, 2, 10, 'group_2x5', 2),
  ('fact_5x3', 5, 3, 15, 'group_3x5', 2),
  ('fact_5x4', 5, 4, 20, 'group_4x5', 2),
  ('fact_5x5', 5, 5, 25, 'group_5x5', 2),
  ('fact_5x6', 5, 6, 30, 'group_5x6', 2),
  ('fact_5x7', 5, 7, 35, 'group_5x7', 2),
  ('fact_5x8', 5, 8, 40, 'group_5x8', 2),
  ('fact_5x9', 5, 9, 45, 'group_5x9', 2),
  ('fact_5x10', 5, 10, 50, 'group_5x10', 2),
  ('fact_6x1', 6, 1, 6, 'group_1x6', 1),
  ('fact_6x2', 6, 2, 12, 'group_2x6', 2),
  ('fact_6x3', 6, 3, 18, 'group_3x6', 3),
  ('fact_6x4', 6, 4, 24, 'group_4x6', 3),
  ('fact_6x5', 6, 5, 30, 'group_5x6', 2),
  ('fact_6x6', 6, 6, 36, 'group_6x6', 4),
  ('fact_6x7', 6, 7, 42, 'group_6x7', 5),
  ('fact_6x8', 6, 8, 48, 'group_6x8', 4),
  ('fact_6x9', 6, 9, 54, 'group_6x9', 5),
  ('fact_6x10', 6, 10, 60, 'group_6x10', 2),
  ('fact_7x1', 7, 1, 7, 'group_1x7', 1),
  ('fact_7x2', 7, 2, 14, 'group_2x7', 2),
  ('fact_7x3', 7, 3, 21, 'group_3x7', 3),
  ('fact_7x4', 7, 4, 28, 'group_4x7', 4),
  ('fact_7x5', 7, 5, 35, 'group_5x7', 2),
  ('fact_7x6', 7, 6, 42, 'group_6x7', 5),
  ('fact_7x7', 7, 7, 49, 'group_7x7', 5),
  ('fact_7x8', 7, 8, 56, 'group_7x8', 5),
  ('fact_7x9', 7, 9, 63, 'group_7x9', 4),
  ('fact_7x10', 7, 10, 70, 'group_7x10', 2),
  ('fact_8x1', 8, 1, 8, 'group_1x8', 1),
  ('fact_8x2', 8, 2, 16, 'group_2x8', 2),
  ('fact_8x3', 8, 3, 24, 'group_3x8', 3),
  ('fact_8x4', 8, 4, 32, 'group_4x8', 4),
  ('fact_8x5', 8, 5, 40, 'group_5x8', 2),
  ('fact_8x6', 8, 6, 48, 'group_6x8', 4),
  ('fact_8x7', 8, 7, 56, 'group_7x8', 5),
  ('fact_8x8', 8, 8, 64, 'group_8x8', 4),
  ('fact_8x9', 8, 9, 72, 'group_8x9', 5),
  ('fact_8x10', 8, 10, 80, 'group_8x10', 2),
  ('fact_9x1', 9, 1, 9, 'group_1x9', 1),
  ('fact_9x2', 9, 2, 18, 'group_2x9', 2),
  ('fact_9x3', 9, 3, 27, 'group_3x9', 3),
  ('fact_9x4', 9, 4, 36, 'group_4x9', 3),
  ('fact_9x5', 9, 5, 45, 'group_5x9', 2),
  ('fact_9x6', 9, 6, 54, 'group_6x9', 5),
  ('fact_9x7', 9, 7, 63, 'group_7x9', 4),
  ('fact_9x8', 9, 8, 72, 'group_8x9', 5),
  ('fact_9x9', 9, 9, 81, 'group_9x9', 4),
  ('fact_9x10', 9, 10, 90, 'group_9x10', 2),
  ('fact_10x1', 10, 1, 10, 'group_1x10', 1),
  ('fact_10x2', 10, 2, 20, 'group_2x10', 2),
  ('fact_10x3', 10, 3, 30, 'group_3x10', 2),
  ('fact_10x4', 10, 4, 40, 'group_4x10', 2),
  ('fact_10x5', 10, 5, 50, 'group_5x10', 2),
  ('fact_10x6', 10, 6, 60, 'group_6x10', 2),
  ('fact_10x7', 10, 7, 70, 'group_7x10', 2),
  ('fact_10x8', 10, 8, 80, 'group_8x10', 2),
  ('fact_10x9', 10, 9, 90, 'group_9x10', 2),
  ('fact_10x10', 10, 10, 100, 'group_10x10', 2);

-- Validacao pos-seed (deve retornar 100)
-- select count(*) from public.multiplication_facts;
-- Distribuicao esperada: T1=19, T2=47, T3=14, T4=11, T5=9
