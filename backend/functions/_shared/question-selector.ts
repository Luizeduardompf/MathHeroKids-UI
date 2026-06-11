import type { AdaptiveRules, MasteryState } from './adaptive-rules.ts';

export interface Fact {
  id: string;
  operand_a: number;
  operand_b: number;
  answer: number;
  fact_group_id: string;
  base_difficulty: number;
}

export interface MasteryRow {
  fact_id: string;
  state: MasteryState;
  strength: number;
  last_seen_at: string | null;
}

export interface SelectedQuestion {
  position: number;
  fact_id: string;
  operand_a: number;
  operand_b: number;
  bucket: MasteryState;
}

export interface SelectionMetadata {
  bucketCounts: Record<MasteryState, number>;
  unlockedTiers: number[];
  effectiveWeights: Record<MasteryState, number>;
}

interface SelectInput {
  facts: Fact[];
  mastery: MasteryRow[];
  excludedFactIds: Set<string>;
  rules: AdaptiveRules;
}

export function selectQuestions(input: SelectInput): {
  questions: SelectedQuestion[];
  metadata: SelectionMetadata;
} {
  const { facts, mastery, excludedFactIds, rules } = input;
  const N = rules.session.questionsPerChallenge;

  // Map fact_id -> mastery (default NEW)
  const masteryMap = new Map<string, MasteryRow>();
  mastery.forEach(m => masteryMap.set(m.fact_id, m));

  // Determinar tiers desbloqueados (progressao)
  const unlockedTiers = computeUnlockedTiers(facts, masteryMap, rules);

  // Particionar em buckets
  const buckets: Record<MasteryState, Fact[]> = {
    WEAK: [], LEARNING: [], REVIEWING: [], MASTERED: [], NEW: [],
  };

  facts.forEach(f => {
    if (excludedFactIds.has(f.id)) return;
    if (!unlockedTiers.includes(f.base_difficulty)) return;
    const m = masteryMap.get(f.id);
    const state = (m?.state ?? 'NEW') as MasteryState;
    buckets[state].push(f);
  });

  // Ordenar cada bucket por prioridade
  buckets.WEAK.sort((a, b) => strengthOf(a, masteryMap) - strengthOf(b, masteryMap));
  buckets.LEARNING.sort((a, b) => strengthOf(a, masteryMap) - strengthOf(b, masteryMap));
  buckets.NEW.sort((a, b) => a.base_difficulty - b.base_difficulty || hash(a.id) - hash(b.id));
  buckets.REVIEWING.sort((a, b) => ageOf(b, masteryMap) - ageOf(a, masteryMap)); // mais antigo primeiro
  buckets.MASTERED.sort((a, b) => ageOf(b, masteryMap) - ageOf(a, masteryMap));

  // Calcular cotas por bucket
  const w = rules.selectionMix.weights;
  const quotas: Record<MasteryState, number> = {
    WEAK: Math.min(rules.session.maxWeakPerSession, Math.round(N * w.WEAK)),
    LEARNING: Math.round(N * w.LEARNING),
    REVIEWING: Math.round(N * w.REVIEWING),
    NEW: Math.round(N * w.NEW),
    MASTERED: Math.round(N * w.MASTERED),
  };

  // Coletar respeitando cotas
  const selected: Fact[] = [];
  const selectedIds = new Set<string>();
  const order = rules.selectionMix.fallbackOrder;
  const bucketCounts: Record<MasteryState, number> = {
    WEAK: 0, LEARNING: 0, REVIEWING: 0, NEW: 0, MASTERED: 0,
  };

  // Clonar buckets para nao mutar o original durante o fallback
  const bucketsCopy: Record<MasteryState, Fact[]> = {
    WEAK: [...buckets.WEAK],
    LEARNING: [...buckets.LEARNING],
    REVIEWING: [...buckets.REVIEWING],
    MASTERED: [...buckets.MASTERED],
    NEW: [...buckets.NEW],
  };

  for (const state of order) {
    let remaining = Math.min(quotas[state], bucketsCopy[state].length);
    while (remaining > 0 && selected.length < N) {
      const f = bucketsCopy[state].shift();
      if (!f) break;
      if (selectedIds.has(f.id)) continue;
      selected.push(f);
      selectedIds.add(f.id);
      bucketCounts[state]++;
      remaining--;
    }
  }

  // Fallback: completar com qualquer bucket disponivel
  if (selected.length < N) {
    for (const state of order) {
      while (selected.length < N && bucketsCopy[state].length > 0) {
        const f = bucketsCopy[state].shift();
        if (!f) break;
        if (selectedIds.has(f.id)) continue;
        selected.push(f);
        selectedIds.add(f.id);
        bucketCounts[state]++;
      }
    }
  }

  // Intercalar por dificuldade para nao agrupar T5 no fim
  const shuffled = interleaveByDifficulty(selected);

  const questions: SelectedQuestion[] = shuffled.map((f, idx) => ({
    position: idx + 1,
    fact_id: f.id,
    operand_a: f.operand_a,
    operand_b: f.operand_b,
    bucket: stateOf(f, masteryMap),
  }));

  return {
    questions,
    metadata: {
      bucketCounts,
      unlockedTiers,
      effectiveWeights: w,
    },
  };
}

function strengthOf(f: Fact, m: Map<string, MasteryRow>): number {
  return m.get(f.id)?.strength ?? 0;
}

function ageOf(f: Fact, m: Map<string, MasteryRow>): number {
  const last = m.get(f.id)?.last_seen_at;
  if (!last) return Number.MAX_SAFE_INTEGER;
  return Date.now() - new Date(last).getTime();
}

function stateOf(f: Fact, m: Map<string, MasteryRow>): MasteryState {
  return (m.get(f.id)?.state ?? 'NEW') as MasteryState;
}

function hash(s: string): number {
  // Tie-break deterministico
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function computeUnlockedTiers(
  facts: Fact[],
  m: Map<string, MasteryRow>,
  rules: AdaptiveRules,
): number[] {
  const unlocked = new Set<number>();
  for (const tier of rules.progression.tiers) {
    if (tier.unlockAt === 'start') {
      unlocked.add(tier.base);
      continue;
    }
    if (tier.unlockWhen === 'tierLearned' && tier.minTier != null && tier.minMasteryPct != null) {
      const prevFacts = facts.filter(f => f.base_difficulty === tier.minTier);
      if (prevFacts.length === 0) continue;
      const learned = prevFacts.filter(f => {
        const st = m.get(f.id)?.state;
        return st && st !== 'NEW' && st !== 'WEAK';
      }).length;
      if (learned / prevFacts.length >= tier.minMasteryPct) {
        unlocked.add(tier.base);
      }
    }
  }
  // Sempre incluir T1 e T2 como fallback minimo
  unlocked.add(1);
  unlocked.add(2);
  return [...unlocked].sort((a, b) => a - b);
}

function interleaveByDifficulty(facts: Fact[]): Fact[] {
  const groups = new Map<number, Fact[]>();
  facts.forEach(f => {
    if (!groups.has(f.base_difficulty)) groups.set(f.base_difficulty, []);
    groups.get(f.base_difficulty)!.push(f);
  });
  const tiers = [...groups.keys()].sort((a, b) => a - b);
  const out: Fact[] = [];
  let i = 0;
  const maxIter = facts.length * tiers.length + 1;
  while (out.length < facts.length && i < maxIter) {
    const tier = tiers[i % tiers.length]!;
    const arr = groups.get(tier);
    if (arr && arr.length > 0) out.push(arr.shift()!);
    i++;
  }
  return out;
}
