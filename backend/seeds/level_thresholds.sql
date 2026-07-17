-- Level thresholds seed data
-- Matches LEVEL_THRESHOLDS in src/constants/config.ts

insert into public.level_thresholds (level, xp_required, name_key) values
  (1,  0,     'levels.explorador'),
  (2,  400,   'levels.explorador'),
  (3,  900,   'levels.explorador'),
  (4,  1500,  'levels.explorador'),
  (5,  2200,  'levels.aventureiro'),
  (6,  3000,  'levels.aventureiro'),
  (7,  3900,  'levels.aventureiro'),
  (8,  4900,  'levels.aventureiro'),
  (9,  6000,  'levels.aventureiro'),
  (10, 7200,  'levels.explorador_mestre'),
  (11, 8000,  'levels.aventureiro_mestre'),
  (12, 8900,  'levels.heroi'),
  (13, 9550,  'levels.mago_aprendiz'),
  (14, 10300, 'levels.mago'),
  (15, 11000, 'levels.mestre_numeros'),
  (20, 15000, 'levels.lenda'),
  (50, 60000, 'levels.lenda_matematica'),
  (55, 72000, 'levels.campeao'),
  (60, 85000, 'levels.campeao_supremo'),
  (70, 105000, 'levels.mestre_absoluto'),
  (80, 130000, 'levels.genio'),
  (90, 160000, 'levels.genio_supremo'),
  (100, 200000, 'levels.imortal')
on conflict (level) do update set
  xp_required = excluded.xp_required,
  name_key = excluded.name_key;
