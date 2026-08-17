-- 022 — Ligar/desligar a Tabuada Semanal Premiada por criança + seguir regras gerais
--
-- O módulo passa a ser opt-in: só aparece na app (card na home, ecrã dedicado) quando
-- tabuada_enabled=true para essa criança. start_tabuada_day rejeita pedidos quando
-- desligado (defesa em profundidade — o cliente já esconde o ponto de entrada).
--
-- tabuada_use_general_settings controla o pool de factos do dia:
--   false (default) — SEMPRE a tabuada fixa 1-10 × 1-10 (100 factos de multiplicação,
--     comportamento original do módulo, independente de qualquer configuração do desafio
--     diário normal).
--   true — usa as MESMAS "regras gerais" do desafio diário normal (enabled_operations +
--     multiplication_max), tal como configuradas em Configurações do jogo. O número de
--     questões por bloco (20) e o tempo por questão (10s) da Tabuada Semanal nunca mudam,
--     mesmo com a flag activa — só o pool de factos elegíveis muda.

alter table public.child_profiles
  add column if not exists tabuada_enabled boolean not null default false,
  add column if not exists tabuada_use_general_settings boolean not null default false;

comment on column public.child_profiles.tabuada_enabled is
  'Liga/desliga o módulo Tabuada Semanal Premiada para esta criança — controla visibilidade na app e start_tabuada_day.';

comment on column public.child_profiles.tabuada_use_general_settings is
  'Se true, o pool diário de factos usa enabled_operations + multiplication_max (as "regras gerais" do desafio normal) em vez da tabuada fixa 1-10 × 1-10.';
