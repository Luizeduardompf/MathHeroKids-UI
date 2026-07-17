-- 012: timer_auto — tempo de resposta ajusta-se automaticamente ao nível da criança
--
-- timer_seconds continua a existir como valor manual (10/15/20/30/0=ilimitado). timer_auto,
-- quando true, ignora esse valor e usa resolveTimerSeconds(level) em src/constants/config.ts —
-- o tempo desce por patamares de nível para dificultar progressivamente (pedido do user).

alter table public.child_profiles
  add column timer_auto boolean not null default false;
comment on column public.child_profiles.timer_auto is
  'Quando true, o tempo de resposta é calculado a partir do nível (ver resolveTimerSeconds em config.ts), ignorando timer_seconds.';
