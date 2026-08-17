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
 * Constrói o payload de 100 questões do dia a partir de `pool` (sem repetição — nenhum
 * facto aparece duas vezes nos 5 blocos do mesmo dia). Quando `tabuada_use_general_settings`
 * está desligado (default), `pool` é sempre exactamente a tabuada 1-10 × 1-10 (100 factos) e
 * as 100 saem todas, só a ORDEM (e por isso a divisão em blocos) muda todos os dias — ver
 * `seed`, que inclui a data local da criança. Quando ligado, `pool` pode ser maior (várias
 * operações activas) — nesse caso amostra 100 ao acaso sem reposição, cobrindo um subconjunto
 * diferente a cada dia. Nunca aceita pool menor que 100 (erro de configuração/seed, não algo
 * a disfarçar repetindo factos).
 */
export function buildDayPayload(pool: TabuadaFact[], seed: string): TabuadaQuestion[] {
  if (pool.length < QUESTIONS_PER_DAY) {
    throw new Error(`Pool de factos tem ${pool.length}, esperava pelo menos ${QUESTIONS_PER_DAY}.`);
  }

  // Duas voltas de mulberry32 antes de usar — reforça a separação entre seeds parecidas
  // (mesma criança, datas consecutivas) mesmo que seedFromString produza hashes próximos.
  const rng = mulberry32(seedFromString(seed));
  rng(); rng();
  const shuffled = seededShuffle(pool, rng).slice(0, QUESTIONS_PER_DAY);

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

// ─── Fecho do dia + recálculo da semana (partilhado por submit_tabuada_block e
// complete_challenge — o dia pode fechar por qualquer ordem dos dois eventos) ───────────

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface TabuadaWeekStatus {
  weekStartDate: string;
  daysCompleted: number;
  medalEarned: boolean;
}

export async function loadWeekStatus(
  supabase: SupabaseLike,
  childId: string,
  weekStartDate: string,
): Promise<TabuadaWeekStatus> {
  const { data } = await supabase
    .from('weekly_tabuada_weeks')
    .select('days_completed, medal_earned_at')
    .eq('child_id', childId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();
  return {
    weekStartDate,
    daysCompleted: data?.days_completed ?? 0,
    medalEarned: !!data?.medal_earned_at,
  };
}

/**
 * Recalcula days_completed a partir da fonte (weekly_tabuada_days), em vez de incrementar —
 * evita contagem duplicada em corridas/retries, mesma filosofia de complete_challenge
 * validar sempre contra o estado persistido.
 */
export async function recomputeWeek(
  supabase: SupabaseLike,
  childId: string,
  weekStartDate: string,
): Promise<TabuadaWeekStatus> {
  const weekEndExclusive = new Date(`${weekStartDate}T00:00:00Z`);
  weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);
  const weekEndIso = weekEndExclusive.toISOString().slice(0, 10);

  const { count } = await supabase
    .from('weekly_tabuada_days')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .gte('day_date', weekStartDate)
    .lt('day_date', weekEndIso)
    .not('completed_at', 'is', null);

  const daysCompleted = count ?? 0;

  const { data: existingWeek } = await supabase
    .from('weekly_tabuada_weeks')
    .select('medal_earned_at')
    .eq('child_id', childId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  const medalEarnedAt = existingWeek?.medal_earned_at ?? (daysCompleted >= DAYS_TO_COMPLETE_WEEK ? new Date().toISOString() : null);

  await supabase
    .from('weekly_tabuada_weeks')
    .upsert({
      child_id: childId,
      week_start_date: weekStartDate,
      days_completed: daysCompleted,
      medal_earned_at: medalEarnedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'child_id,week_start_date' });

  return { weekStartDate, daysCompleted, medalEarned: !!medalEarnedAt };
}

/**
 * Tenta fechar o dia de `dayDate`: só marca `completed_at` quando os 5 blocos da tabuada
 * estão "passed" E o desafio diário normal desse dia está `completed` em `calendar_days`
 * (decisão do utilizador: o 6º "bloco" — o desafio diário normal — passa a contar para a
 * medalha semanal, não é só informativo). Chamável a partir de submit_tabuada_block (quando
 * o último bloco da tabuada passa) e de complete_challenge (quando o desafio normal
 * termina) — o dia fecha por qualquer ordem em que os dois eventos aconteçam. Devolve
 * `null` se a criança ainda nem começou a tabuada desse dia (nada a fazer).
 */
export async function tryCompleteDay(
  supabase: SupabaseLike,
  childId: string,
  dayDate: string,
): Promise<{ dayCompleted: boolean; tabuadaBlocksPassed: boolean; weekStatus: TabuadaWeekStatus } | null> {
  const { data: day } = await supabase
    .from('weekly_tabuada_days')
    .select('blocks_state, completed_at')
    .eq('child_id', childId)
    .eq('day_date', dayDate)
    .maybeSingle();
  if (!day) return null;

  const weekStartDate = mondayOfWeek(dayDate);

  if (day.completed_at) {
    return { dayCompleted: true, tabuadaBlocksPassed: true, weekStatus: await loadWeekStatus(supabase, childId, weekStartDate) };
  }

  const blocksState = day.blocks_state as BlockState[];
  const tabuadaBlocksPassed = blocksState.every((b) => b.status === 'passed');
  if (!tabuadaBlocksPassed) {
    return { dayCompleted: false, tabuadaBlocksPassed: false, weekStatus: await loadWeekStatus(supabase, childId, weekStartDate) };
  }

  const { data: calDay } = await supabase
    .from('calendar_days')
    .select('state')
    .eq('child_id', childId)
    .eq('day_date', dayDate)
    .maybeSingle();
  const dailyChallengeDone = calDay?.state === 'completed';
  if (!dailyChallengeDone) {
    return { dayCompleted: false, tabuadaBlocksPassed: true, weekStatus: await loadWeekStatus(supabase, childId, weekStartDate) };
  }

  await supabase
    .from('weekly_tabuada_days')
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('child_id', childId)
    .eq('day_date', dayDate);

  const weekStatus = await recomputeWeek(supabase, childId, weekStartDate);
  return { dayCompleted: true, tabuadaBlocksPassed: true, weekStatus };
}
