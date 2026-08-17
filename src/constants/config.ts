/**
 * Static game configuration constants.
 * These match the PRD decisions and database schema CHECK constraints.
 */

export const CHALLENGE = {
  TOTAL_QUESTIONS: 20,
  QUESTIONS_PER_BLOCK: 5,
  // Valores de exibição apenas — a fonte autoritativa dos ganhos é a Edge
  // Function complete_challenge (backend/functions/complete_challenge/index.ts).
  XP_PER_CORRECT_ANSWER: 2,
  XP_COMPLETION_BONUS: 4,
  XP_PERFECT_BONUS: 10,
  RETROACTIVE_WINDOW_DAYS: 30,
} as const;

export const TIMER_OPTIONS = [10, 15, 20, 30, 0] as const;
// 0 = sem limite de tempo
export type TimerOption = (typeof TIMER_OPTIONS)[number];
export const DEFAULT_TIMER = 15 satisfies TimerOption;

/** Patamares do timer automático — desce conforme o nível sobe, para dificultar. */
const AUTO_TIMER_BANDS: Array<{ minLevel: number; seconds: number }> = [
  { minLevel: 1, seconds: 20 },
  { minLevel: 5, seconds: 15 },
  { minLevel: 10, seconds: 12 },
  { minLevel: 15, seconds: 10 },
  { minLevel: 20, seconds: 8 },
  { minLevel: 30, seconds: 6 },
];

/** Resolve o tempo de resposta efectivo: manual se timer_auto=false, por nível se true. */
export function resolveTimerSeconds(level: number, manualSeconds: TimerOption, autoEnabled: boolean): number {
  if (!autoEnabled) return manualSeconds;
  let seconds = AUTO_TIMER_BANDS[0]!.seconds;
  for (const band of AUTO_TIMER_BANDS) {
    if (level >= band.minLevel) seconds = band.seconds;
  }
  return seconds;
}

// Número de questões por sessão. 0 = AUTO (ajustado ao nível, default = 20)
export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25, 0] as const;
export type QuestionCountOption = (typeof QUESTION_COUNT_OPTIONS)[number];
export const DEFAULT_QUESTION_COUNT = 20 satisfies QuestionCountOption;

/** Resolve o número real de questões (0 = AUTO → default 20) */
export function resolveQuestionCount(opt: QuestionCountOption, _level = 1): number {
  return opt === 0 ? CHALLENGE.TOTAL_QUESTIONS : opt;
}

export const MULTIPLICATION_RANGES = [10, 12, 15, 20] as const;
export type MultiplicationRange = (typeof MULTIPLICATION_RANGES)[number];
export const DEFAULT_MULTIPLICATION_MAX = 10 satisfies MultiplicationRange;

export const AVATAR_IDS = ['sofia', 'lucas', 'luna', 'mia', 'pedro', 'theo'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

// Horas disponíveis para agendar notificações WhatsApp — o cron corre 1x/hora (ver
// backend/functions/send-whatsapp-notifications), por isso só a hora importa, não os minutos.
export const NOTIFICATION_HOURS = [7, 8, 9, 12, 14, 16, 17, 18, 19, 20, 21, 22] as const;
export type NotificationHour = (typeof NOTIFICATION_HOURS)[number];
export function hourToTimeString(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00:00`;
}
export function timeStringToHour(time: string | null | undefined, fallback: number): number {
  if (!time) return fallback;
  const h = parseInt(time.split(':')[0] ?? '', 10);
  return Number.isFinite(h) ? h : fallback;
}

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
  { level: 55, xpRequired: 72000, nameKey: 'levels.campeao' },
  { level: 60, xpRequired: 85000, nameKey: 'levels.campeao_supremo' },
  { level: 70, xpRequired: 105000, nameKey: 'levels.mestre_absoluto' },
  { level: 80, xpRequired: 130000, nameKey: 'levels.genio' },
  { level: 90, xpRequired: 160000, nameKey: 'levels.genio_supremo' },
  { level: 100, xpRequired: 200000, nameKey: 'levels.imortal' },
];

/** XP no início do nível atual (piso para cálculo de progresso). */
export function getLevelXpFloor(level: number): number {
  return LEVEL_THRESHOLDS.find((t) => t.level === level)?.xpRequired ?? 0;
}

/** XP necessário para o próximo threshold da tabela (tabela é esparsa — nem todo nível tem entrada). */
export function getLevelXpCeil(level: number): number {
  const next = LEVEL_THRESHOLDS.find((t) => t.level > level);
  if (next) return next.xpRequired;
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]?.xpRequired ?? 0;
}

// ─── Tabuada Semanal Premiada ───────────────────────────────────────────────
// Módulo independente do desafio diário adaptativo: 100 questões por dia — SEMPRE a
// tabuada completa 1-10 × 1-10 (as 100 combinações, cada uma exactamente uma vez, sem
// repetição — independente do multiplication_max configurável do desafio normal),
// repartidas em 5 blocos fixos de 20, cada um exigindo >=70% de acerto para passar. Sem
// XP — a recompensa é a "medalha" ao completar 7 dias seguidos (segunda a domingo), sinal
// para o pai depositar a mesada. Estes valores são só de exibição — a fonte autoritativa é
// a Edge Function submit_tabuada_block (backend/functions/submit_tabuada_block/index.ts).
export const WEEKLY_TABUADA = {
  QUESTIONS_PER_DAY: 100,
  BLOCKS_PER_DAY: 5,
  QUESTIONS_PER_BLOCK: 20,
  TIME_PER_QUESTION_SECONDS: 10,
  PASS_THRESHOLD: 0.7,
  DAYS_TO_COMPLETE_WEEK: 7,
} as const;

const TABUADA_TOTAL_QUESTIONS_PER_WEEK =
  WEEKLY_TABUADA.DAYS_TO_COMPLETE_WEEK * WEEKLY_TABUADA.BLOCKS_PER_DAY * WEEKLY_TABUADA.QUESTIONS_PER_BLOCK; // 700

/** Converte euros (ex: 14.5) para cêntimos inteiros. */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

export function centsToEuroLabel(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/**
 * Cêntimos ganhos por 1 bloco (0-20 acertos) — calculado em cêntimos inteiros num único
 * passo, nunca por soma repetida de frações, para não acumular deriva de vírgula flutuante
 * ao longo dos até 35 blocos da semana. Ver [[tabuada-rounding-safety]].
 */
export function tabuadaBlockEarnedCents(weeklyRewardEuros: number, correctCount: number): number {
  if (weeklyRewardEuros <= 0) return 0;
  const weeklyRewardCents = eurosToCents(weeklyRewardEuros);
  return Math.round((weeklyRewardCents * correctCount) / TABUADA_TOTAL_QUESTIONS_PER_WEEK);
}

/** Soma cêntimos já calculados, sem nunca ultrapassar o valor total configurado (limite duro). */
export function capTabuadaCents(rawCents: number, weeklyRewardEuros: number): number {
  return Math.min(rawCents, eurosToCents(weeklyRewardEuros));
}

/** Soma em cêntimos o ganho dos blocos de um dia (já cap'ada ao valor total da semana). */
export function sumTabuadaBlocksEarnedCents(
  blocksState: Array<{ best_correct_count: number }>,
  weeklyRewardEuros: number,
): number {
  const raw = blocksState.reduce((sum, b) => sum + tabuadaBlockEarnedCents(weeklyRewardEuros, b.best_correct_count), 0);
  return capTabuadaCents(raw, weeklyRewardEuros);
}

/** Segunda-feira (0) a domingo (6) — mesma convenção usada nos rótulos do calendário. */
export const WEEK_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const MODULE_ID = {
  MULTIPLICATION: 'multiplication',
  DIVISION: 'division',
  ADDITION: 'addition',
  SUBTRACTION: 'subtraction',
} as const;
export type ModuleId = (typeof MODULE_ID)[keyof typeof MODULE_ID];
export const OPERATIONS: ModuleId[] = ['multiplication', 'addition', 'subtraction', 'division'];

export const OPERATION_SYMBOLS: Record<ModuleId, string> = {
  multiplication: '×',
  addition: '+',
  subtraction: '−',
  division: '÷',
};

export const OPERATION_CATEGORY_KEYS: Record<ModuleId, string> = {
  multiplication: 'challenge.categoryMultiplication',
  addition: 'challenge.categoryAddition',
  subtraction: 'challenge.categorySubtraction',
  division: 'challenge.categoryDivision',
};

/** Calcula a resposta correta a partir da operação — usado só para feedback local imediato; a EF é a fonte autoritativa. */
export function computeAnswer(operation: ModuleId, operandA: number, operandB: number): number {
  switch (operation) {
    case 'multiplication': return operandA * operandB;
    case 'addition': return operandA + operandB;
    case 'subtraction': return operandA - operandB;
    case 'division': return operandA / operandB;
  }
}
