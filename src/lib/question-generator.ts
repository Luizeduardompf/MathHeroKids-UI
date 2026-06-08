/**
 * Deterministic question generator for multiplication challenges.
 *
 * Seed format: `${child_id}:${date}:${module_id}` (e.g. "abc-123:2024-01-15:multiplication")
 *
 * The same seed always produces the same 20 questions — this allows the server
 * to regenerate and validate answers without storing the questions themselves.
 *
 * Algorithm:
 *  1. Hash the seed string to a 32-bit integer (djb2).
 *  2. Use Mulberry32 PRNG seeded with that integer.
 *  3. Generate all possible unique pairs (a, b) within [1, max] × [1, max].
 *  4. Fisher-Yates shuffle the pool using the PRNG.
 *  5. Take the first 20 pairs.
 */

import { CHALLENGE } from '@/constants/config';
import type { MultiplicationRange } from '@/constants/config';

export interface Question {
  index: number;        // 0–19, absolute position in session
  operand_a: number;
  operand_b: number;
  correct_answer: number;
}

// ─── PRNG ─────────────────────────────────────────────────────────────────────

/** djb2 hash — converts a string to an unsigned 32-bit integer */
function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash || 1; // avoid 0 seed
}

/** Mulberry32 PRNG — returns a new state and a float in [0, 1) */
function mulberry32(state: number): { next: number; value: number } {
  let s = (state + 0x6d2b79f5) >>> 0;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  const value = ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  return { next: s, value };
}

/** Fisher-Yates shuffle using Mulberry32 */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let state = seed;
  for (let i = result.length - 1; i > 0; i--) {
    const { next, value } = mulberry32(state);
    state = next;
    const j = Math.floor(value * (i + 1));
    // swap
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic set of 20 multiplication questions.
 *
 * @param seed - `${child_id}:${date}:${module_id}`
 * @param multiplicationMax - upper bound for operands (1–N)
 */
export function generateQuestions(
  seed: string,
  multiplicationMax: MultiplicationRange,
): Question[] {
  const prngSeed = hashSeed(seed);

  // Build all unique (a, b) pairs where a, b ∈ [1, max]
  const pool: Array<[number, number]> = [];
  for (let a = 1; a <= multiplicationMax; a++) {
    for (let b = 1; b <= multiplicationMax; b++) {
      pool.push([a, b]);
    }
  }

  // Shuffle deterministically
  const shuffled = shuffleWithSeed(pool, prngSeed);

  // Take first TOTAL_QUESTIONS
  return shuffled.slice(0, CHALLENGE.TOTAL_QUESTIONS).map(([a, b], i) => ({
    index: i,
    operand_a: a,
    operand_b: b,
    correct_answer: a * b,
  }));
}

/**
 * Build the canonical seed string used by both client and server.
 */
export function buildQuestionSeed(
  childId: string,
  challengeDate: string, // YYYY-MM-DD
  moduleId: string,
): string {
  return `${childId}:${challengeDate}:${moduleId}`;
}
