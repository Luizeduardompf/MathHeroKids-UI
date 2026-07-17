-- 016 — Configuração de operações por criança
--
-- enabled_operations: quais operações o pai activou para esta criança (mín. 1).
-- mix_operations: quando true, um único desafio mistura questões de todas as activadas;
-- quando false e houver mais de uma activada, a criança escolhe qual antes de começar
-- (ver seletor em challenge/[date].tsx).

alter table public.child_profiles
  add column enabled_operations text[] not null default array['multiplication']
    check (
      array_length(enabled_operations, 1) >= 1
      and enabled_operations <@ array['multiplication','addition','subtraction','division']
    ),
  add column mix_operations boolean not null default false;
