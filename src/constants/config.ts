/**
 * Static game configuration constants.
 * These match the PRD decisions and database schema CHECK constraints.
 */

export const CHALLENGE = {
  TOTAL_QUESTIONS: 20,
  QUESTIONS_PER_BLOCK: 5,
  BLOCKS_PER_SESSION: 4,
  XP_PER_CORRECT_ANSWER: 10,
  XP_COMPLETION_BONUS: 200,
  MILESTONE_XP: {
    5: 60,
    10: 100,
    15: 150,
    20: 200,
  } as Record<number, number>,
  RETROACTIVE_WINDOW_DAYS: 7,
} as const;

export const TIMER_OPTIONS = [10, 15, 20, 30, 0] as const; // 0 = unlimited
export type TimerOption = (typeof TIMER_OPTIONS)[number];
export const DEFAULT_TIMER = 15 satisfies TimerOption;

export const MULTIPLICATION_RANGES = [10, 12, 15, 20] as const;
export type MultiplicationRange = (typeof MULTIPLICATION_RANGES)[number];
export const DEFAULT_MULTIPLICATION_MAX = 10 satisfies MultiplicationRange;

export const AVATAR_IDS = ['sofia', 'gabriel', 'pedro', 'ana', 'theo', 'mia'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export const SUPPORTED_LOCALES = ['pt', 'en', 'es', 'fr'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'pt';

export const LEVEL_THRESHOLDS: Array<{ level: number; xpRequired: number; nameKey: string }> = [
  { level: 1, xpRequired: 0, nameKey: 'levels.explorador' },
  { level: 2, xpRequired: 400, nameKey: 'levels.explorador' },
  { level: 3, xpRequired: 900, nameKey: 'levels.explorador' },
  { level: 4, xpRequired: 1500, nameKey: 'levels.explorador' },
  { level: 5, xpRequired: 2200, nameKey: 'levels.aventureiro' },
  { level: 6, xpRequired: 3000, nameKey: 'levels.aventureiro' },
  { level: 7, xpRequired: 3900, nameKey: 'levels.aventureiro' },
  { level: 8, xpRequired: 4900, nameKey: 'levels.aventureiro' },
  { level: 9, xpRequired: 6000, nameKey: 'levels.aventureiro' },
  { level: 10, xpRequired: 7200, nameKey: 'levels.explorador_mestre' },
  { level: 11, xpRequired: 8000, nameKey: 'levels.aventureiro_mestre' },
  { level: 12, xpRequired: 8900, nameKey: 'levels.heroi' },
  { level: 13, xpRequired: 9550, nameKey: 'levels.mago_aprendiz' },
  { level: 14, xpRequired: 10300, nameKey: 'levels.mago' },
  { level: 15, xpRequired: 11000, nameKey: 'levels.mestre_numeros' },
  { level: 20, xpRequired: 15000, nameKey: 'levels.lenda' },
  { level: 50, xpRequired: 60000, nameKey: 'levels.lenda_matematica' },
];

export const MODULE_ID = {
  MULTIPLICATION: 'multiplication',
  DIVISION: 'division',       // future
  ADDITION: 'addition',       // future
  SUBTRACTION: 'subtraction', // future
} as const;
export type ModuleId = (typeof MODULE_ID)[keyof typeof MODULE_ID];
