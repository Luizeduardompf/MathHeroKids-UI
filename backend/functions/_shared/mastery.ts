import type { AdaptiveRules, MasteryState } from './adaptive-rules.ts';

interface UpdateInput {
  supabase: ReturnType<typeof import('npm:@supabase/supabase-js@2').createClient>;
  childId: string;
  factId: string;
  sessionId: string;
  isCorrect: boolean;
  childTimezone: string;
  rules: AdaptiveRules;
}

interface MasteryRecord {
  child_id: string;
  fact_id: string;
  state: MasteryState;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  distinct_sessions_correct: number;
  consecutive_correct: number;
  consecutive_wrong: number;
  last_seen_at: string | null;
  last_correct_at: string | null;
  last_wrong_at: string | null;
  last_correct_local_date: string | null;
  strength: number;
  updated_at?: string;
}

export async function updateMastery(input: UpdateInput): Promise<void> {
  const { supabase, childId, factId, isCorrect, childTimezone, rules } = input;

  const { data: existing } = await supabase
    .from('child_fact_mastery')
    .select('*')
    .eq('child_id', childId)
    .eq('fact_id', factId)
    .maybeSingle();

  const now = new Date();
  const todayLocal = toLocalDate(now, childTimezone);

  const m: MasteryRecord = existing ?? {
    child_id: childId,
    fact_id: factId,
    state: 'NEW' as MasteryState,
    times_seen: 0,
    times_correct: 0,
    times_wrong: 0,
    distinct_sessions_correct: 0,
    consecutive_correct: 0,
    consecutive_wrong: 0,
    last_seen_at: null,
    last_correct_at: null,
    last_wrong_at: null,
    last_correct_local_date: null,
    strength: 0,
  };

  m.times_seen += 1;
  m.last_seen_at = now.toISOString();

  if (isCorrect) {
    m.times_correct += 1;
    m.consecutive_correct += 1;
    m.consecutive_wrong = 0;
    m.last_correct_at = now.toISOString();
    // DP-7: incrementa distinct_sessions_correct apenas se mudou o dia local
    if (m.last_correct_local_date !== todayLocal) {
      m.distinct_sessions_correct += 1;
      m.last_correct_local_date = todayLocal;
    }
  } else {
    m.times_wrong += 1;
    m.consecutive_wrong += 1;
    m.consecutive_correct = 0;
    m.last_wrong_at = now.toISOString();
  }

  m.strength = computeStrength(m, rules, now);
  m.state = nextState(m, rules);

  await supabase
    .from('child_fact_mastery')
    .upsert({ ...m, updated_at: now.toISOString() }, { onConflict: 'child_id,fact_id' });
}

export async function applyCommutativity(input: {
  supabase: ReturnType<typeof import('npm:@supabase/supabase-js@2').createClient>;
  childId: string;
  factId: string;
  factGroupId: string;
  isCorrect: boolean;
  childTimezone: string;
  rules: AdaptiveRules;
}): Promise<void> {
  if (!input.rules.commutativity.enabled) return;

  // Buscar o fact irmaoo no mesmo group_id com operandos invertidos
  const { data: facts } = await input.supabase
    .from('multiplication_facts')
    .select('id, operand_a, operand_b')
    .eq('fact_group_id', input.factGroupId)
    .neq('id', input.factId);

  if (!facts || facts.length === 0) return;

  const tf = input.rules.commutativity.transferFactor;
  const now = new Date();
  const todayLocal = toLocalDate(now, input.childTimezone);

  for (const sibling of facts) {
    const { data: existing } = await input.supabase
      .from('child_fact_mastery')
      .select('*')
      .eq('child_id', input.childId)
      .eq('fact_id', sibling.id)
      .maybeSingle();

    if (!existing) continue; // so aplica em facts que a crianca ja viu

    const m: MasteryRecord = { ...existing };

    if (input.isCorrect) {
      // Credito parcial: incrementa strength proporcional ao transferFactor
      const currentStrength = m.strength;
      const delta = (1 - currentStrength) * tf;
      m.strength = Math.min(1, currentStrength + delta);
      // Tambem contabiliza como vista e correta (parcialmente) mas NAO muda distinct_sessions
      // para evitar inflacao de mastery por comutatividade
    }

    m.state = nextState(m, input.rules);

    await input.supabase
      .from('child_fact_mastery')
      .upsert({ ...m, updated_at: now.toISOString() }, { onConflict: 'child_id,fact_id' });
  }
}

export function computeStrength(m: MasteryRecord, rules: AdaptiveRules, now: Date): number {
  const w = rules.strength.weights;

  let recency = 0;
  if (m.last_correct_at) {
    const dtDays = (now.getTime() - new Date(m.last_correct_at).getTime()) / 86400000;
    recency = Math.pow(2, -dtDays / rules.strength.halfLifeDays);
  }

  const accuracy = m.times_correct / Math.max(1, m.times_seen);
  const sessionFactor = Math.min(1, m.distinct_sessions_correct / rules.strength.targetSessions);
  const wrongPenalty = Math.exp(-rules.strength.wrongDecay * m.consecutive_wrong);

  const base = w.recency * recency + w.accuracy * accuracy + w.sessions * sessionFactor;
  return Math.max(0, Math.min(1, base * wrongPenalty));
}

export function nextState(m: MasteryRecord, rules: AdaptiveRules): MasteryState {
  const current = m.state as MasteryState;
  const { learning, mastered, weak } = rules.mastery;

  // WEAK trigger: erro apos REVIEWING/MASTERED
  if (
    m.consecutive_wrong >= weak.consecutiveWrongTrigger &&
    (current === 'REVIEWING' || current === 'MASTERED')
  ) {
    return 'WEAK';
  }

  // WEAK recovery
  if (current === 'WEAK') {
    if (
      m.distinct_sessions_correct >= weak.recoveryDistinctSessions &&
      m.consecutive_correct >= weak.recoveryCorrectPerSession
    ) {
      return 'LEARNING';
    }
    return 'WEAK';
  }

  // NEW -> LEARNING: primeira aparicao
  if (current === 'NEW' && m.times_seen >= 1) return 'LEARNING';

  // LEARNING -> REVIEWING (ponto A)
  if (current === 'LEARNING' && m.distinct_sessions_correct >= learning.distinctSessionsRequired) {
    return 'REVIEWING';
  }

  // REVIEWING -> MASTERED (ponto B + C)
  if (
    current === 'REVIEWING' &&
    m.times_correct >= mastered.totalCorrectRequired &&
    m.distinct_sessions_correct >= mastered.distinctSessionsRequired
  ) {
    return 'MASTERED';
  }

  return current;
}

function toLocalDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
