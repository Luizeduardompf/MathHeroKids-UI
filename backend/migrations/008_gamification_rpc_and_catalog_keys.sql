-- 008: RPC de contagens para gamificação + chaves naturais dos catálogos
--
-- Reconstrói objectos que tinham sido aplicados ad-hoc via Management API na
-- sessão 7 e nunca chegaram ao repo (perdidos com o projecto antigo).
--
-- Os índices únicos em name_key dão aos catálogos uma chave natural, o que torna
-- os seeds re-executáveis (on conflict do update) — o PK é um uuid gerado, logo
-- sem isto cada re-run duplicaria as linhas.

create unique index if not exists trophies_name_key_uidx      on public.trophies (name_key);
create unique index if not exists achievements_name_key_uidx  on public.achievements (name_key);
create unique index if not exists level_rewards_name_key_uidx on public.level_rewards (name_key);

-- Contagens semanal e mensal de desafios completados, relativas à semana/mês de
-- p_date. Consumida por complete_challenge (trophies challenges_in_week /
-- challenges_in_month). A EF corre com service_role, logo sem RLS pelo meio.
--
-- date_trunc('week') no Postgres começa à segunda-feira.

create or replace function public.get_challenge_counts_for_gamification(
  p_child_id uuid,
  p_date     date
)
returns table (week_count bigint, month_count bigint)
language sql
stable
as $$
  select
    count(*) filter (
      where cs.challenge_date >= date_trunc('week', p_date)::date
        and cs.challenge_date <  (date_trunc('week', p_date) + interval '7 days')::date
    ) as week_count,
    count(*) filter (
      where cs.challenge_date >= date_trunc('month', p_date)::date
        and cs.challenge_date <  (date_trunc('month', p_date) + interval '1 month')::date
    ) as month_count
  from public.challenge_sessions cs
  where cs.child_id = p_child_id
    and cs.status = 'completed';
$$;
