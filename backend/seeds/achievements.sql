-- Achievements catalog seed — 13 achievements
--
-- condition_type tem de casar com checkAchievementCondition() em
-- backend/functions/complete_challenge/index.ts.
-- Os condition_value vêm das descrições em pt.json (ex.: "Dominou 25 tabuadas").
-- category é limitada pelo CHECK da migration 001 a 4 valores — os mesmos 4 que
-- CATEGORY_ICON/CATEGORY_ORDER usam em app/(app)/achievements.tsx. (pt.json tem
-- ainda labels 'desempenho' e 'colecao', que o CHECK não aceita — não usar.)
--
-- Requer migration 008 (índice único em name_key).

insert into public.achievements
  (name_key, description_key, category, condition_type, condition_value, icon_asset, sort_order)
values
  ('achievements.firstChallenge.name', 'achievements.firstChallenge.desc', 'primeiros_passos', 'challenges_total',     1, 'star-outline',   1),
  ('achievements.firstPerfect.name',   'achievements.firstPerfect.desc',   'primeiros_passos', 'perfect_challenges',   1, 'star-outline',   2),

  ('achievements.streak3.name',        'achievements.streak3.desc',        'sequencias',       'streak_days',          3, 'flame-outline',  3),
  ('achievements.streak7.name',        'achievements.streak7.desc',        'sequencias',       'streak_days',          7, 'flame-outline',  4),
  ('achievements.streak30.name',       'achievements.streak30.desc',       'sequencias',       'streak_days',         30, 'flame-outline',  5),
  ('achievements.streak100.name',      'achievements.streak100.desc',      'sequencias',       'streak_days',        100, 'flame-outline',  6),

  ('achievements.mastery25.name',      'achievements.mastery25.desc',      'habilidades',      'facts_mastered',      25, 'flash-outline',  7),
  ('achievements.mastery100.name',     'achievements.mastery100.desc',     'habilidades',      'facts_mastered',     100, 'flash-outline',  8),

  ('achievements.challenges10.name',   'achievements.challenges10.desc',   'especiais',        'challenges_total',    10, 'ribbon-outline', 9),
  ('achievements.challenges50.name',   'achievements.challenges50.desc',   'especiais',        'challenges_total',    50, 'ribbon-outline', 10),
  ('achievements.perfect10.name',      'achievements.perfect10.desc',      'especiais',        'perfect_challenges',  10, 'ribbon-outline', 11),
  ('achievements.level5.name',         'achievements.level5.desc',         'especiais',        'level_reached',        5, 'ribbon-outline', 12),
  ('achievements.level10.name',        'achievements.level10.desc',        'especiais',        'level_reached',       10, 'ribbon-outline', 13)
on conflict (name_key) do update set
  description_key = excluded.description_key,
  category        = excluded.category,
  condition_type  = excluded.condition_type,
  condition_value = excluded.condition_value,
  icon_asset      = excluded.icon_asset,
  sort_order      = excluded.sort_order;
