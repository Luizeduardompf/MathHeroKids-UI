-- 009: calendar_days.is_retroactive
--
-- complete_challenge já sabe se a sessão foi retroativa (challenge_sessions.is_retroactive),
-- mas nunca gravava essa informação em calendar_days — a linha ficava indistinguível de
-- um dia concluído no próprio dia. Isso fazia o calendário "esquecer" que um dia tinha sido
-- recuperado (estado "Atrasado"/"Recuperado") assim que a sessão terminava, mostrando-o
-- apenas como Perfeito/Concluído normal.

alter table public.calendar_days
  add column if not exists is_retroactive boolean not null default false;
