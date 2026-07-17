-- 014 — Gera os 100 factos de adição (1+1 .. 10+10)
--
-- Tiers de dificuldade (mesma escala 1-5 da multiplicação, critério próprio):
--   T1: soma com operando 1 (mais fácil de contar) — 19 factos
--   T2: soma <= 10 sem "atravessar a dezena" — 28 factos
--   T3: soma 11-13 — 25 factos
--   T4: soma 14-16 — 18 factos
--   T5: soma 17-20 (ex: 9+9, 8+9) — 10 factos
-- fact_group_id partilhado entre a+b e b+a (comutatividade, igual à multiplicação).

insert into public.arithmetic_facts (id, operation, operand_a, operand_b, answer, fact_group_id, base_difficulty)
select
  'fact_add_' || a || '_' || b,
  'addition',
  a, b, a + b,
  'group_add_' || least(a, b) || '_' || greatest(a, b),
  case
    when a = 1 or b = 1 then 1
    when a + b <= 10 then 2
    when a + b <= 13 then 3
    when a + b <= 16 then 4
    else 5
  end
from generate_series(1, 10) a, generate_series(1, 10) b;

-- Validacao pos-seed (deve retornar 100)
-- select count(*) from public.arithmetic_facts where operation = 'addition';
