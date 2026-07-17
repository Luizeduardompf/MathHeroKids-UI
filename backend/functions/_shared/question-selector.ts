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
  /** Semente de aleatoriedade — normalmente o session_id. Mesma sessão = mesma ordem (resume estável); sessões diferentes = ordens diferentes. */
  seed: string;
  /** Número de questões a selecionar. Default: rules.session.questionsPerChallenge (config por criança sobrepõe-se à regra global). */
  questionCount?: number;
}

// ─── PRNG determinístico por seed (mulberry32) ────────────────────────────────
// Mesma seed = mesma sequência (resume de sessão estável); seeds diferentes
// (session_id novo a cada dia) = ordens diferentes. Não é para segurança,
// só para variar a apresentação das questões.
function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return function () {
    t |= 0; t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function selectQuestions(input: SelectInput): {
  questions: SelectedQuestion[];
  metadata: SelectionMetadata;
} {
  const { facts, mastery, excludedFactIds, rules } = input;
  const N = input.questionCount ?? rules.session.questionsPerChallenge;
  const rng = mulberry32(seedFromString(input.seed));
  const tieBreak = new Map<string, number>();
  facts.forEach(f => tieBreak.set(f.id, rng()));

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

  // Ordenar cada bucket por prioridade — em caso de empate, tieBreak (aleatório
  // por sessão) decide, para não repetir sempre a mesma ordem para o mesmo estado.
  const tb = (id: string) => tieBreak.get(id) ?? 0;
  buckets.WEAK.sort((a, b) => strengthOf(a, masteryMap) - strengthOf(b, masteryMap) || tb(a.id) - tb(b.id));
  buckets.LEARNING.sort((a, b) => strengthOf(a, masteryMap) - strengthOf(b, masteryMap) || tb(a.id) - tb(b.id));
  buckets.NEW.sort((a, b) => a.base_difficulty - b.base_difficulty || tb(a.id) - tb(b.id));
  buckets.REVIEWING.sort((a, b) => ageOf(b, masteryMap) - ageOf(a, masteryMap) || tb(a.id) - tb(b.id)); // mais antigo primeiro
  buckets.MASTERED.sort((a, b) => ageOf(b, masteryMap) - ageOf(a, masteryMap) || tb(a.id) - tb(b.id));

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

  // Embaralhar a ordem final — aleatorização real por sessão (antes era
  // determinístico: interleaveByDifficulty produzia sempre a mesma ordem para
  // o mesmo conjunto de questões, e sem seed nenhuma sessão variava).
  const shuffled = seededShuffle(selected, rng);

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
