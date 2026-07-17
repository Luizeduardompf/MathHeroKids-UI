-- Level rewards catalog seed — 7 rewards
--
-- name_key vai directo ao t() (ver rewards.tsx, LevelUpModal.tsx) — tem de casar
-- com as chaves de src/locales/*.json. Estas entradas só têm 'name' no i18n
-- (sem 'desc'), e a tabela não tem description_key — coerente.
--
-- unlock_level: 2, 5, 8, 10, 12, 15, 20 (registado no handoff da sessão 7).
-- reward_type é limitado pelo CHECK da migration 001.
--
-- Requer migration 008 (índice único em name_key).

insert into public.level_rewards
  (name_key, reward_type, unlock_level, icon_asset, sort_order)
values
  ('rewards.frame_star.name',    'frame',  2,  'star-outline',   1),
  ('rewards.outfit_hero.name',   'outfit', 5,  'shirt-outline',  2),
  ('rewards.medal_bronze.name',  'medal',  8,  'medal-outline',  3),
  ('rewards.frame_fire.name',    'frame',  10, 'flame-outline',  4),
  ('rewards.outfit_mage.name',   'outfit', 12, 'shirt-outline',  5),
  ('rewards.medal_silver.name',  'medal',  15, 'medal-outline',  6),
  ('rewards.frame_rainbow.name', 'frame',  20, 'color-palette-outline', 7)
on conflict (name_key) do update set
  reward_type  = excluded.reward_type,
  unlock_level = excluded.unlock_level,
  icon_asset   = excluded.icon_asset,
  sort_order   = excluded.sort_order;
