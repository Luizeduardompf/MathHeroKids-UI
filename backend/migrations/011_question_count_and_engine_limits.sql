-- 011: question_count por criança + limites de schema alinhados com counts configuráveis
--
-- start_challenge passa a ler child_profiles.question_count para decidir quantas questões
-- gerar (em vez do valor fixo de adaptive-rules.json). QUESTION_COUNT_OPTIONS já incluía 25
-- em src/constants/config.ts, o que já violava o CHECK antigo de challenge_answers.question_index
-- (0..19) assim que uma sessão passasse de 20 questões — nunca disparou porque question_count
-- nunca era lido. Corrigido aqui antes de ligar o valor de facto.

alter table public.child_profiles
  add column question_count smallint not null default 20
    check (question_count in (5, 10, 15, 20, 25, 0));
comment on column public.child_profiles.question_count is
  '0 = AUTO (usa o default das regras adaptativas). Configurável no parent-area.';

alter table public.challenge_answers
  drop constraint if exists challenge_answers_question_index_check;
alter table public.challenge_answers
  add constraint challenge_answers_question_index_check check (question_index >= 0);

alter table public.challenge_answers
  drop constraint if exists challenge_answers_block_number_check;
alter table public.challenge_answers
  add constraint challenge_answers_block_number_check check (block_number >= 1);
