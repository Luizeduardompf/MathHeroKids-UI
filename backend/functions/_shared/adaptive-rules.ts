// Loader + tipos para adaptive-rules.json.
// Importado por start_challenge e complete_challenge.
// A/B harness: AB_TEST_ENABLED=true ativa atribuição estável 50/50 por child_id.

import rulesJson from '../../config/adaptive-rules.json' with { type: 'json' };
import rulesV2Json from '../../config/adaptive-rules-v2.json' with { type: 'json' };

export type MasteryState = 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED' | 'WEAK';

export interface AdaptiveRules {
  version: number;
  lastUpdated?: string;
  mastery: {
    learning: { distinctSessionsRequired: number };
    mastered: { totalCorrectRequired: number; distinctSessionsRequired: number };
    weak: {
      consecutiveWrongTrigger: number;
      recoveryDistinctSessions: number;
      recoveryCorrectPerSession: number;
    };
  };
  selectionMix: {
    weights: Record<MasteryState, number>;
    fallbackOrder: MasteryState[];
  };
  antiRepeat: {
    intraSessionUnique: boolean;
    crossSessionCooldown: number;
    introduceByDifficulty: boolean;
  };
  progression: {
    tiers: Array<{
      base: number;
      unlockAt?: 'start';
      unlockWhen?: 'tierLearned';
      minTier?: number;
      minMasteryPct?: number;
    }>;
  };
  strength: {
    halfLifeDays: number;
    wrongDecay: number;
    weights: { recency: number; accuracy: number; sessions: number };
    targetSessions: number;
  };
  commutativity: { enabled: boolean; transferFactor: number };
  sessionDistinctness: { mode: 'byCalendarDay' | 'bySessionId' };
  session: {
    questionsPerChallenge: number;
    blockSize: number;
    maxWeakPerSession: number;
  };
}

const rulesV1 = rulesJson as AdaptiveRules;
const rulesV2 = rulesV2Json as AdaptiveRules;

// Permite override via env var sem redeploy.
// No dashboard Supabase: Settings → Edge Functions → Secrets → QUESTIONS_PER_CHALLENGE=5
const _envQ = Deno.env.get('QUESTIONS_PER_CHALLENGE');
if (_envQ) {
  const n = parseInt(_envQ, 10);
  if (!isNaN(n) && n > 0) {
    rulesV1.session.questionsPerChallenge = n;
    rulesV2.session.questionsPerChallenge = n;
  }
}

// Validacao basica no boot — JSON Schema cobre o resto via CI.
function validateRules(r: AdaptiveRules, label: string): void {
  const weightSum = Object.values(r.selectionMix.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 0.001) {
    throw new Error(`[${label}] selectionMix.weights soma ${weightSum}, esperado 1.0`);
  }
  const strSum =
    r.strength.weights.recency + r.strength.weights.accuracy + r.strength.weights.sessions;
  if (Math.abs(strSum - 1) > 0.001) {
    throw new Error(`[${label}] strength.weights soma ${strSum}, esperado 1.0`);
  }
}

validateRules(rulesV1, 'v1');
validateRules(rulesV2, 'v2');

/** Retorna v1 por padrão. Para usar A/B: AB_TEST_ENABLED=true. */
export function getRules(): AdaptiveRules {
  return rulesV1;
}

export function getRulesVersion(): number {
  return rulesV1.version;
}

/**
 * A/B harness — atribuição estável 50/50 por child_id.
 * Controlado pela env var AB_TEST_ENABLED=true.
 * Mesma child_id sempre recebe a mesma versão.
 */
export function getRulesForChild(childId: string): AdaptiveRules {
  const abEnabled = Deno.env.get('AB_TEST_ENABLED') === 'true';
  if (!abEnabled) return rulesV1;
  return simpleHash(childId) % 2 === 0 ? rulesV1 : rulesV2;
}

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}
