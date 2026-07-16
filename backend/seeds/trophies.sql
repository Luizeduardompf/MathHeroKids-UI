-- Trophies catalog seed — 15 troféus
--
-- name_key / description_key vão directos ao t() do i18next (ver trophy-room.tsx,
-- TrophyEarnedModal.tsx) — têm de casar com as chaves de src/locales/*.json.
-- requirement_type tem de casar com checkTrophyCondition() em
-- backend/functions/complete_challenge/index.ts.
-- Os requirement_value vêm das descrições em pt.json (ex.: "5 desafios em uma semana").
--
-- icon_asset não é lido pelo cliente (a UI usa Ionicons fixos: trophy / lock-closed),
-- mas a coluna é NOT NULL — mantido preenchido para quando a UI passar a usá-lo.
--
-- Requer migration 008 (índice único em name_key).

insert into public.trophies
  (name_key, description_key, category, tier, requirement_type, requirement_value, icon_asset, sort_order)
values
  ('trophies.daily1.name',     'trophies.daily1.desc',     'daily',   'bronze',  'challenges_completed',   1, 'trophy-outline',  1),
  ('trophies.daily7.name',     'trophies.daily7.desc',     'daily',   'silver',  'challenges_completed',   7, 'trophy-outline',  2),
  ('trophies.daily30.name',    'trophies.daily30.desc',    'daily',   'gold',    'challenges_completed',  30, 'trophy-outline',  3),
  ('trophies.daily100.name',   'trophies.daily100.desc',   'daily',   'diamond', 'challenges_completed', 100, 'trophy-outline',  4),

  ('trophies.weekly1.name',    'trophies.weekly1.desc',    'weekly',  'bronze',  'challenges_in_week',     5, 'calendar-outline', 5),
  ('trophies.weekly2.name',    'trophies.weekly2.desc',    'weekly',  'silver',  'challenges_in_week',     7, 'calendar-outline', 6),

  ('trophies.monthly1.name',   'trophies.monthly1.desc',   'monthly', 'silver',  'challenges_in_month',   20, 'calendar-number-outline', 7),
  ('trophies.monthly2.name',   'trophies.monthly2.desc',   'monthly', 'gold',    'challenges_in_month',   30, 'calendar-number-outline', 8),

  ('trophies.streak3.name',    'trophies.streak3.desc',    'streak',  'bronze',  'current_streak',         3, 'flame-outline',   9),
  ('trophies.streak7.name',    'trophies.streak7.desc',    'streak',  'silver',  'current_streak',         7, 'flame-outline',  10),
  ('trophies.streak30.name',   'trophies.streak30.desc',   'streak',  'gold',    'current_streak',        30, 'flame-outline',  11),
  ('trophies.streak100.name',  'trophies.streak100.desc',  'streak',  'diamond', 'current_streak',       100, 'flame-outline',  12),

  ('trophies.perfect1.name',   'trophies.perfect1.desc',   'special', 'bronze',  'perfect_challenges',     1, 'star-outline',   13),
  ('trophies.perfect10.name',  'trophies.perfect10.desc',  'special', 'gold',    'perfect_challenges',    10, 'star-outline',   14),
  ('trophies.perfect30.name',  'trophies.perfect30.desc',  'special', 'diamond', 'perfect_challenges',    30, 'star-outline',   15)
on conflict (name_key) do update set
  description_key   = excluded.description_key,
  category          = excluded.category,
  tier              = excluded.tier,
  requirement_type  = excluded.requirement_type,
  requirement_value = excluded.requirement_value,
  icon_asset        = excluded.icon_asset,
  sort_order        = excluded.sort_order;
