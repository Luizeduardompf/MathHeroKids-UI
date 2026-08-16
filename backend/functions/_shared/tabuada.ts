// Helpers partilhados por start_tabuada_day e submit_tabuada_block (módulo "Tabuada Semanal
// Premiada"). Independente do motor adaptativo (_shared/mastery.ts, question-selector.ts) —
// este módulo não lê/escreve child_fact_mastery nem concede XP, ver comentário no topo da
// migration 020_weekly_tabuada.sql para o racional.

export const QUESTIONS_PER_DAY = 100;
export const BLOCKS_PER_DAY = 5;
export const QUESTIONS_PER_BLOCK = 20;
export const PASS_THRESHOLD = 0.7; // 14/20
export const DAYS_TO_COMPLETE_WEEK = 7;

export interface TabuadaFact {
  id: string;
  operand_a: number;
  operand_b: number;
  answer: number;
}

export interface TabuadaQuestion {
  position: number; // 1..100
  block_number: number; // 1..5
  fact_id: string;
  operand_a: number;
  operand_b: number;
}

export type BlockStatus = 'pending' | 'passed';

export interface BlockState {
  block_number: number;
  status: BlockStatus;
  attempts: number;
  best_correct_count: number;
  passed_at: string | null;
}

export function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

export function mulberry32(seed: number): () => number {
  let t = seed;
  return function () {
    t |= 0; t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Constrói o payload de 100 questões do dia: a tabuada completa 1-10 × 1-10, cada
 * combinação exactamente UMA VEZ (sem repetição — é a exigência do módulo: ao fim das 100
 * questões a criança fez a tabuada toda). Independente do `multiplication_max` do desafio
 * diário normal — este módulo é sempre a grelha 1-10 fixa, por isso `pool` tem de ter
 * exactamente 100 factos únicos (o caller filtra operand_a/b entre 1-10 antes de chamar
 * isto). Só embaralha a ordem — nunca repete nem descarta um facto.
 */
export function buildDayPayload(pool: TabuadaFact[], seed: string): TabuadaQuestion[] {
  if (pool.length !== QUESTIONS_PER_DAY) {
    throw new Error(`Pool de factos de multiplicação tem ${pool.length}, esperava exactamente ${QUESTIONS_PER_DAY} (tabuada 1-10 completa).`);
  }

  const rng = mulberry32(seedFromString(seed));
  const shuffled = seededShuffle(pool, rng);

  return shuffled.map((f, idx) => ({
    position: idx + 1,
    block_number: Math.floor(idx / QUESTIONS_PER_BLOCK) + 1,
    fact_id: f.id,
    operand_a: f.operand_a,
    operand_b: f.operand_b,
  }));
}

export function initialBlocksState(): BlockState[] {
  return Array.from({ length: BLOCKS_PER_DAY }, (_, i) => ({
    block_number: i + 1,
    status: 'pending' as const,
    attempts: 0,
    best_correct_count: 0,
    passed_at: null,
  }));
}

/** Data local (YYYY-MM-DD) da criança, mesmo critério de _shared/mastery.ts toLocalDate. */
export function toLocalDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Segunda-feira (YYYY-MM-DD) da semana ISO que contém `isoDate`. */
export function mondayOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Dom..6=Sáb
  const diffToMonday = (day + 6) % 7; // Seg->0, Ter->1, ..., Dom->6
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}
