// complete_challenge — versão self-contained para Supabase Dashboard
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) + hash) ^ seed.charCodeAt(i); hash = hash >>> 0; }
  return hash || 1;
}
function mulberry32(state: number): { next: number; value: number } {
  let s = (state + 0x6d2b79f5) >>> 0;
  s = Math.imul(s ^ (s >>> 15), s | 1); s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  return { next: s, value: ((s ^ (s >>> 14)) >>> 0) / 4294967296 };
}
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr]; let state = seed;
  for (let i = result.length - 1; i > 0; i--) {
    const { next, value } = mulberry32(state); state = next;
    const j = Math.floor(value * (i + 1)); const tmp = result[i]!; result[i] = result[j]!; result[j] = tmp;
  }
  return result;
}
function generateQuestions(seed: string, max: number) {
  const pool: [number, number][] = [];
  for (let a = 1; a <= max; a++) for (let b = 1; b <= max; b++) pool.push([a, b]);
  return shuffleWithSeed(pool, hashSeed(seed)).slice(0, 20)
    .map(([a, b], i) => ({ index: i, operand_a: a, operand_b: b, correct_answer: a * b }));
}

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 }, { level: 2, xp: 400 }, { level: 3, xp: 900 }, { level: 4, xp: 1500 },
  { level: 5, xp: 2200 }, { level: 6, xp: 3000 }, { level: 7, xp: 3900 }, { level: 8, xp: 4900 },
  { level: 9, xp: 6000 }, { level: 10, xp: 7200 }, { level: 11, xp: 8000 }, { level: 12, xp: 8900 },
  { level: 13, xp: 9550 }, { level: 14, xp: 10300 }, { level: 15, xp: 11000 }, { level: 20, xp: 15000 }, { level: 50, xp: 60000 },
];
function computeLevel(xp: number): number {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) { if (xp >= t.xp) level = t.level; else break; }
  return level;
}
function daysBetween(a: string, b: string) { return Math.abs(Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000)); }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json() as {
      child_id: string; challenge_date: string; session_id: string; module_id: string;
      timer_seconds: number; multiplication_max: number;
      answers: Array<{ question_index: number; block_number: number; attempt_number: number; operand_a: number; operand_b: number; child_answer: number | null; time_taken_ms: number | null; }>;
    };
    const { child_id, challenge_date, session_id, module_id, multiplication_max, answers } = body;

    // Idempotency
    const { data: existing } = await supabase.from('challenge_sessions').select('*').eq('id', session_id).maybeSingle();
    if (existing?.status === 'completed') {
      const { data: child } = await supabase.from('child_profiles').select('level').eq('id', child_id).single();
      return new Response(JSON.stringify({ session: existing, xp_earned: existing.xp_awarded, level_up: false, new_level: child?.level ?? null, unlocked_reward: null, trophies_earned: [], achievements_earned: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate answers
    const seed = existing?.question_seed ?? `${child_id}:${challenge_date}:${module_id}`;
    const serverQs = generateQuestions(seed, multiplication_max);
    const qMap = new Map(serverQs.map(q => [q.index, q]));
    const correctByIndex = new Set<number>();
    const scored = answers.map(ans => {
      const sq = qMap.get(ans.question_index);
      const is_correct = !!sq && ans.child_answer !== null && ans.child_answer === sq.correct_answer;
      const first = is_correct && !correctByIndex.has(ans.question_index);
      if (first) correctByIndex.add(ans.question_index);
      return { ...ans, operand_a: sq?.operand_a ?? ans.operand_a, operand_b: sq?.operand_b ?? ans.operand_b, is_correct, xp_awarded: first ? 10 : 0 };
    });

    const correctCount = correctByIndex.size;
    const isPerfect = correctCount === 20;
    const totalXp = correctCount * 10 + 200 + (isPerfect ? 100 : 0);

    const { data: child, error: childErr } = await supabase.from('child_profiles')
      .select('xp_total, level, current_streak, best_streak, last_challenge_date').eq('id', child_id).single();
    if (childErr || !child) throw new Error('Child not found');

    const newXp = child.xp_total + totalXp;
    const newLevel = computeLevel(newXp);
    const levelUp = newLevel > child.level;

    const today = new Date().toISOString().split('T')[0]!;
    const isRetroactive = challenge_date !== today;
    let newStreak = child.current_streak, newBestStreak = child.best_streak;
    if (!isRetroactive) {
      const last = child.last_challenge_date;
      newStreak = !last ? 1 : daysBetween(last, today) === 1 ? child.current_streak + 1 : daysBetween(last, today) === 0 ? child.current_streak : 1;
      newBestStreak = Math.max(newStreak, child.best_streak);
    }

    await supabase.from('challenge_answers').insert(scored.map(a => ({
      session_id, block_number: a.block_number, attempt_number: a.attempt_number,
      question_index: a.question_index, operand_a: a.operand_a, operand_b: a.operand_b,
      correct_answer: a.operand_a * a.operand_b, child_answer: a.child_answer,
      is_correct: a.is_correct, time_taken_ms: a.time_taken_ms, xp_awarded: a.xp_awarded,
    })));

    const { data: updatedSession } = await supabase.from('challenge_sessions')
      .update({ status: 'completed', correct_count: correctCount, xp_awarded: totalXp, is_perfect: isPerfect, completed_at: new Date().toISOString() })
      .eq('id', session_id).select().single();

    const profileUpdate: Record<string, unknown> = { xp_total: newXp, level: newLevel };
    if (!isRetroactive) { profileUpdate.current_streak = newStreak; profileUpdate.best_streak = newBestStreak; profileUpdate.last_challenge_date = challenge_date; }
    await supabase.from('child_profiles').update(profileUpdate).eq('id', child_id);

    await supabase.from('calendar_days').upsert({ child_id, day_date: challenge_date, state: 'completed', is_perfect: isPerfect, session_id }, { onConflict: 'child_id,day_date' });
    await supabase.from('child_xp_ledger').insert([
      { child_id, source: 'correct_answer', amount: correctCount * 10, reference_id: session_id },
      { child_id, source: 'challenge_completion', amount: 200 + (isPerfect ? 100 : 0), reference_id: session_id },
    ].filter(r => r.amount > 0));

    let unlockedReward = null;
    if (levelUp) {
      const { data: reward } = await supabase.from('level_rewards').select('*').eq('unlock_level', newLevel).maybeSingle().catch(() => ({ data: null }));
      if (reward) { await supabase.from('child_level_rewards').upsert({ child_id, reward_id: reward.id }, { onConflict: 'child_id,reward_id' }); unlockedReward = reward; }
    }

    return new Response(JSON.stringify({
      session: updatedSession ?? { id: session_id, child_id, challenge_date, module_id, status: 'completed', correct_count: correctCount, xp_awarded: totalXp, is_perfect: isPerfect },
      xp_earned: totalXp, level_up: levelUp, new_level: levelUp ? newLevel : null,
      unlocked_reward: unlockedReward, trophies_earned: [], achievements_earned: [],
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('complete_challenge error:', err);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
