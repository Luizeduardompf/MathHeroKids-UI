-- 015 — Gera subtração (inversa da adição) e divisão (inversa da multiplicação)
--
-- Subtração e divisão NÃO são comutativas — fact_group_id fica null, sem transferência de
-- mastery entre pares. Dificuldade herdada do facto de origem (a carga cognitiva de "20-8"
-- é a mesma de aprender "12+8", só invertida).
--
-- Para cada facto de adição (a,b,c=a+b) gera-se a subtração c-a=b. Como (a,b) e (b,a) existem
-- ambos no catálogo de adição, isto produz naturalmente as duas subtrações c-a=b e c-b=a sem
-- duplicar — 100 factos de subtração, um por facto de adição.
insert into public.arithmetic_facts (id, operation, operand_a, operand_b, answer, fact_group_id, base_difficulty)
select
  'fact_sub_' || answer || '_' || operand_a,
  'subtraction',
  answer, operand_a, operand_b,
  null,
  base_difficulty
from public.arithmetic_facts
where operation = 'addition';

-- Idem para divisão: cada facto de multiplicação (a,b,c=a*b) gera a divisão c/a=b. 100 factos.
insert into public.arithmetic_facts (id, operation, operand_a, operand_b, answer, fact_group_id, base_difficulty)
select
  'fact_div_' || answer || '_' || operand_a,
  'division',
  answer, operand_a, operand_b,
  null,
  base_difficulty
from public.arithmetic_facts
where operation = 'multiplication';

-- Validacao pos-seed (deve retornar 400 no total: 100 por operacao)
-- select operation, count(*) from public.arithmetic_facts group by operation;
