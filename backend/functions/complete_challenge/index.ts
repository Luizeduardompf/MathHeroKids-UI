/**
 * complete_challenge — Edge Function (Deno)
 *
 * The ONLY way XP and progression are mutated. Never via direct client writes.
 *
 * Responsibilities:
 *  1. Validate idempotency (already completed? return cached result)
 *  2. Regenerate questions server-side using the same seed
 *  3. Validate answers against regenerated questions
 *  4. Compute XP (10/correct answer, first occurrence only + completion bonus)
 *  5. Update child_profiles: xp_total, level, current_streak, best_streak, last_challenge_date
 *  6. Upsert calendar_days
 *  7. Append child_xp_ledger rows
 *  8. Evaluate trophy progress
 *  9. Evaluate achievement unlocks
 * 10. Return CompleteChallengeResponse
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Question generator (mirrors src/lib/question-generator.ts) ───────────────

function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash || 1;
}

function mulberry32(state: number): { next: number; value: number } {
  let s = (state + 0x6d2b79f5) >>> 0;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  const value = ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  return { next: s, value };
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let state = seed;
  for (let i = result.length - 1; i > 0; i--) {
    const { next, value } = mulberry32(state);
    state = next;
    const j = Math.floor(value * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

interface ServerQuestion {
  index: number;
  operand_a: number;
  operand_b: number;
  correct_answer: number;
}

function generateQuestions(seed: string, multiplicationMax: number): ServerQuestion[] {
  const prngSeed = hashSeed(seed);
  const pool: Array<[number, number]> = [];
  for (let a = 1; a <= multiplicationMax; a++) {
    for (let b = 1; b <= multiplicationMax; b++) {
      pool.push([a, b]);
    }
  }
  return shuffleWithSeed(pool, prngSeed)
    .slice(0, 20)
    .map(([a, b], i) => ({ index: i, operand_a: a, operand_b: b, correct_answer: a * b }));
}

// ─── XP constants ─────────────────────────────────────────────────────────────

const XP_PER_CORRECT = 10;
const XP_COMPLETION_BONUS = 200;
const XP_PERFECT_BONUS = 100; // all 20 correct

// ─── Level thresholds (mirrors LEVEL_THRESHOLDS in config.ts) ─────────────────

const LEVEL_THRESHOLDS = [
  { level: 1, xp_required: 0 },
  { level: 2, xp_required: 400 },
  { level: 3, xp_required: 900 },
  { level: 4, xp_required: 1500 },
  { level: 5, xp_required: 2200 },
  { level: 6, xp_required: 3000 },
  { level: 7, xp_required: 3900 },
  { level: 8, xp_required: 4900 },
  { level: 9, xp_required: 6000 },
  { level: 10, xp_required: 7200 },
  { level: 11, xp_required: 8000 },
  { level: 12, xp_required: 8900 },
  { level: 13, xp_required: 9550 },
  { level: 14, xp_required: 10300 },
  { level: 15, xp_required: 11000 },
  { level: 20, xp_required: 15000 },
  { level: 50, xp_required: 60000 },
];

function computeLevel(xpTotal: number): number {
  let level = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xpTotal >= threshold.xp_required) level = threshold.level;
    else break;
  }
  return level;
}

// ─── Streak helpers ───────────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(Math.floor((b - a) / 86400000));
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json() as {
      child_id: string;
      challenge_date: string;
      session_id: string;
      module_id: string;
      timer_seconds: number;
      multiplication_max: number;
      answers: Array<{
        question_index: number;
        block_number: number;
        attempt_number: number;
        operand_a: number;
        operand_b: number;
        child_answer: number | null;
        time_taken_ms: number | null;
      }>;
    };

    const { child_id, challenge_date, session_id, module_id, multiplication_max, answers } = body;
    const { timer_seconds } = body;

    // ── 1. Idempotency check + session upsert ─────────────────────────────
    // Strategy: check by (child_id, challenge_date, module_id) first — this covers
    // both the normal case (same session_id) and the edge case where start_challenge
    // created a session with a DIFFERENT UUID (would violate the unique constraint
    // if we tried to upsert by id). Then fallback to check by session_id.
    const today = new Date().toISOString().split('T')[0]!;
    const isRetroactivePre = challenge_date !== today;
    const questionSeedFallback = `${child_id}:${challenge_date}:${module_id}`;

    // Primary check: by (child_id, challenge_date, module_id)
    const { data: byDay } = await supabase
      .from('challenge_sessions')
      .select('*')
      .eq('child_id', child_id)
      .eq('challenge_date', challenge_date)
      .eq('module_id', module_id)
      .maybeSingle();

    // Secondary check: by session_id (if no row exists for this day yet)
    const { data: byId } = !byDay ? await supabase
      .from('challenge_sessions')
      .select('*')
      .eq('id', session_id)
      .maybeSingle() : { data: null };

    const existingSession = byDay ?? byId ?? null;
    // Use the session id that actually exists in the DB (may differ from client's UUID)
    const effectiveSessionId = existingSession?.id ?? session_id;

    if (!existingSession) {
      // Session was never created — create it now so FK on challenge_answers works
      const { error: insertErr } = await supabase.from('challenge_sessions').insert({
        id: session_id,
        child_id,
        challenge_date,
        module_id,
        question_seed: questionSeedFallback,
        status: 'in_progress',
        total_questions: answers.length,
        correct_count: 0,
        xp_awarded: 0,
        is_retroactive: isRetroactivePre,
        is_perfect: false,
        timer_seconds: timer_seconds ?? 15,
        multiplication_max,
      });
      if (insertErr) {
        // Race condition or unique violation — fetch the real session
        const { data: raceSession } = await supabase
          .from('challenge_sessions')
          .select('*')
          .eq('child_id', child_id)
          .eq('challenge_date', challenge_date)
          .eq('module_id', module_id)
          .maybeSingle();
        if (raceSession) {
          // Re-run as if session existed — return cached or continue scoring
          if (raceSession.status === 'completed') {
            const { data: child } = await supabase.from('child_profiles')
              .select('xp_total, level, current_streak, best_streak').eq('id', child_id).single();
            return new Response(JSON.stringify({
              session: raceSession, xp_earned: raceSession.xp_awarded,
              level_up: false, new_level: child?.level ?? null,
              unlocked_reward: null, trophies_earned: [], achievements_earned: [],
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else {
          throw new Error(`Session insert failed: ${insertErr.message}`);
        }
      }
    }

    if (existingSession?.status === 'completed') {
      // Already completed — return cached XP (no re-award)
      const { data: child } = await supabase
        .from('child_profiles')
        .select('xp_total, level, current_streak, best_streak')
        .eq('id', child_id)
        .single();

      return new Response(JSON.stringify({
        session: existingSession,
        xp_earned: existingSession.xp_awarded,
        level_up: false,
        new_level: child?.level ?? null,
        unlocked_reward: null,
        trophies_earned: [],
        achievements_earned: [],
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 2. Regenerate questions (server validation) ───────────────────────
    const questionSeed = existingSession?.question_seed
      ?? `${child_id}:${challenge_date}:${module_id}`;
    const serverQuestions = generateQuestions(questionSeed, multiplication_max);
    const questionMap = new Map(serverQuestions.map((q) => [q.index, q]));

    // ── 3. Validate + score answers ───────────────────────────────────────
    // First correct answer per question_index wins; retries get xp_awarded=0
    const correctByIndex = new Set<number>();
    const scoredAnswers: Array<typeof answers[0] & { is_correct: boolean; xp_awarded: number }> = [];

    for (const ans of answers) {
      const serverQ = questionMap.get(ans.question_index);
      const is_correct = serverQ !== undefined
        && ans.child_answer !== null
        && ans.child_answer === serverQ.correct_answer;

      const firstCorrect = is_correct && !correctByIndex.has(ans.question_index);
      if (firstCorrect) correctByIndex.add(ans.question_index);

      scoredAnswers.push({
        ...ans,
        operand_a: serverQ?.operand_a ?? ans.operand_a,
        operand_b: serverQ?.operand_b ?? ans.operand_b,
        is_correct,
        xp_awarded: firstCorrect ? XP_PER_CORRECT : 0,
      });
    }

    const correctCount = correctByIndex.size;
    const isPerfect = correctCount === 20;

    // ── 4. Compute XP ─────────────────────────────────────────────────────
    const answerXp = correctCount * XP_PER_CORRECT;
    const completionXp = XP_COMPLETION_BONUS;
    const perfectXp = isPerfect ? XP_PERFECT_BONUS : 0;
    const totalXpEarned = answerXp + completionXp + perfectXp;

    // ── 5. Fetch current child profile ────────────────────────────────────
    const { data: child, error: childError } = await supabase
      .from('child_profiles')
      .select('xp_total, level, current_streak, best_streak, last_challenge_date')
      .eq('id', child_id)
      .single();

    if (childError || !child) throw new Error('Child profile not found');

    const oldLevel = child.level;
    const newXpTotal = child.xp_total + totalXpEarned;
    const newLevel = computeLevel(newXpTotal);
    const levelUp = newLevel > oldLevel;

    // ── 6. Streak calculation (non-retroactive only) ───────────────────────
    const isRetroactive = isRetroactivePre;
    let newStreak = child.current_streak;
    let newBestStreak = child.best_streak;

    if (!isRetroactive) {
      const lastDate = child.last_challenge_date;
      if (!lastDate) {
        newStreak = 1;
      } else {
        const diff = daysBetween(lastDate, today);
        if (diff === 1) {
          newStreak = child.current_streak + 1;
        } else if (diff === 0) {
          newStreak = child.current_streak; // already played today
        } else {
          newStreak = 1; // streak broken
        }
      }
      newBestStreak = Math.max(newStreak, child.best_streak);
    }

    // ── 7. Insert answers ─────────────────────────────────────────────────
    const answerRows = scoredAnswers.map((a) => ({
      session_id: effectiveSessionId,
      block_number: a.block_number,
      attempt_number: a.attempt_number,
      question_index: a.question_index,
      operand_a: a.operand_a,
      operand_b: a.operand_b,
      correct_answer: a.operand_a * a.operand_b,
      child_answer: a.child_answer,
      is_correct: a.is_correct,
      time_taken_ms: a.time_taken_ms,
      xp_awarded: a.xp_awarded,
    }));

    await supabase.from('challenge_answers').insert(answerRows);

    // ── 8. Update challenge_session ───────────────────────────────────────
    const { data: updatedSession } = await supabase
      .from('challenge_sessions')
      .update({
        status: 'completed',
        correct_count: correctCount,
        xp_awarded: totalXpEarned,
        is_perfect: isPerfect,
        completed_at: new Date().toISOString(),
      })
      .eq('id', effectiveSessionId)
      .select()
      .single();

    // ── 9. Update child_profiles ──────────────────────────────────────────
    const profileUpdate: Record<string, unknown> = {
      xp_total: newXpTotal,
      level: newLevel,
    };
    if (!isRetroactive) {
      profileUpdate.current_streak = newStreak;
      profileUpdate.best_streak = newBestStreak;
      profileUpdate.last_challenge_date = challenge_date;
    }

    await supabase
      .from('child_profiles')
      .update(profileUpdate)
      .eq('id', child_id);

    // ── 10. Upsert calendar_days ──────────────────────────────────────────
    await supabase
      .from('calendar_days')
      .upsert({
        child_id,
        day_date: challenge_date,
        state: 'completed',
        is_perfect: isPerfect,
        session_id: effectiveSessionId,
      }, { onConflict: 'child_id,day_date' });

    // ── 11. Append XP ledger ──────────────────────────────────────────────
    const ledgerRows = [];
    if (answerXp > 0) {
      ledgerRows.push({ child_id, source: 'correct_answer', amount: answerXp, reference_id: effectiveSessionId });
    }
    ledgerRows.push({ child_id, source: 'challenge_completion', amount: completionXp, reference_id: effectiveSessionId });
    if (perfectXp > 0) {
      ledgerRows.push({ child_id, source: 'challenge_completion', amount: perfectXp, reference_id: effectiveSessionId });
    }
    await supabase.from('child_xp_ledger').insert(ledgerRows);

    // ── 12. Trophy evaluation (simplified for Phase 2) ────────────────────
    // Full trophy logic in Phase 3; here we just update daily_trophy progress
    const trophiesEarned: unknown[] = [];
    try {
      const { data: dailyTrophy } = await supabase
        .from('trophies')
        .select('id')
        .eq('id', 'daily_trophy')
        .maybeSingle();

      if (dailyTrophy) {
        await supabase
          .from('child_trophies')
          .upsert({ child_id, trophy_id: 'daily_trophy', progress: 1, earned_at: new Date().toISOString() },
            { onConflict: 'child_id,trophy_id' });
      }
    } catch { /* trophy table may not exist yet — non-fatal */ }

    // ── 13. Achievement evaluation (simplified for Phase 2) ──────────────
    const achievementsEarned: unknown[] = [];

    // ── 14. Level reward unlock ───────────────────────────────────────────
    let unlockedReward = null;
    if (levelUp) {
      try {
        const { data: reward } = await supabase
          .from('level_rewards')
          .select('*')
          .eq('unlock_level', newLevel)
          .maybeSingle();

        if (reward) {
          await supabase
            .from('child_level_rewards')
            .upsert({ child_id, reward_id: reward.id }, { onConflict: 'child_id,reward_id' });
          unlockedReward = reward;
        }
      } catch { /* non-fatal */ }
    }

    // ── Response ──────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        session: updatedSession ?? {
          id: effectiveSessionId,
          child_id,
          challenge_date,
          module_id,
          status: 'completed',
          correct_count: correctCount,
          xp_awarded: totalXpEarned,
          is_perfect: isPerfect,
        },
        xp_earned: totalXpEarned,
        level_up: levelUp,
        new_level: levelUp ? newLevel : null,
        unlocked_reward: unlockedReward,
        trophies_earned: trophiesEarned,
        achievements_earned: achievementsEarned,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('complete_challenge error:', err);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
