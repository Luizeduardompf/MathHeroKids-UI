/**
 * complete_challenge — Edge Function (Phase 3 — gamification completo)
 *
 * O UNICO caminho para mutar XP, level, streak, mastery. Nunca via escrita direta do cliente.
 *
 * Responsabilidades:
 *  1. Idempotencia (sessao ja completada? retornar resultado em cache)
 *  2. Validar respostas contra questions_payload armazenado (nao regenera com seed)
 *  3. Computar XP (10/resposta correta + bonus completacao + bonus perfeito)
 *  4. Atualizar child_profiles: xp_total, level, current_streak, best_streak, last_challenge_date
 *  5. Upsert calendar_days
 *  6. Append child_xp_ledger
 *  7. Avaliar trophies e achievements completo (Phase 3)
 *  8. Atualizar child_fact_mastery por questao
 *  9. Aplicar comutatividade
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getRules } from '../_shared/adaptive-rules.ts';
import { updateMastery, applyCommutativity } from '../_shared/mastery.ts';
import { getAppConfig, applyRetestOutcomes } from '../_shared/retest.ts';
import type { RetestAnswerOutcome } from '../_shared/retest.ts';
import { toLocalDate, tryCompleteDay } from '../_shared/tabuada.ts';

// ─── XP Constants ─────────────────────────────────────────────────────────────
// Reduzido ~5x (2026-07-17) para alongar a curva e evitar totais exorbitantes
// no longo prazo. Ver .ai/session-handoff.md para o racional.
const XP_PER_CORRECT = 2;
const XP_COMPLETION_BONUS = 4;
const XP_PERFECT_BONUS = 10;

// ─── Level thresholds (fallback — fonte autoritativa: tabela level_thresholds) ──
const LEVEL_THRESHOLDS_FALLBACK = [
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
  { level: 55, xp_required: 72000 },
  { level: 60, xp_required: 85000 },
  { level: 70, xp_required: 105000 },
  { level: 80, xp_required: 130000 },
  { level: 90, xp_required: 160000 },
  { level: 100, xp_required: 200000 },
];

function computeLevelFromThresholds(
  xpTotal: number,
  thresholds: Array<{ level: number; xp_required: number }>,
): number {
  let level = 1;
  for (const t of thresholds) {
    if (xpTotal >= t.xp_required) level = t.level;
    else break;
  }
  return level;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(Math.floor((b - a) / 86400000));
}

// ─── Trophy / Achievement evaluation helpers ──────────────────────────────────

interface TrophyRow {
  id: string;
  name_key: string;
  description_key: string;
  category: string;
  tier: string;
  requirement_type: string;
  requirement_value: number;
  icon_asset: string;
  sort_order: number;
}

interface AchievementRow {
  id: string;
  name_key: string;
  description_key: string;
  category: string;
  condition_type: string;
  condition_value: number | null;
  icon_asset: string;
  sort_order: number;
}

interface GamificationStats {
  challengesTotal: number;
  challengesThisWeek: number;
  challengesThisMonth: number;
  perfectTotal: number;
  masteredFacts: number;
}

async function fetchGamificationStats(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  challengeDate: string,
): Promise<GamificationStats> {
  const [total, weekMonth, perfect, mastery] = await Promise.all([
    // Total completed challenges
    supabase
      .from('challenge_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('status', 'completed'),

    // Weekly + monthly counts via raw SQL (two counts in one query)
    supabase.rpc('get_challenge_counts_for_gamification', {
      p_child_id: childId,
      p_date: challengeDate,
    }).maybeSingle(),

    // Perfect challenges
    supabase
      .from('challenge_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('status', 'completed')
      .eq('is_perfect', true),

    // MASTERED facts
    supabase
      .from('child_fact_mastery')
      .select('fact_id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('state', 'MASTERED'),
  ]);

  // Fallback for RPC (function may not exist yet)
  let challengesThisWeek = 0;
  let challengesThisMonth = 0;
  if (!weekMonth.error && weekMonth.data) {
    challengesThisWeek = (weekMonth.data as { week_count: number; month_count: number }).week_count ?? 0;
    challengesThisMonth = (weekMonth.data as { week_count: number; month_count: number }).month_count ?? 0;
  }

  return {
    challengesTotal: total.count ?? 0,
    challengesThisWeek,
    challengesThisMonth,
    perfectTotal: perfect.count ?? 0,
    masteredFacts: mastery.count ?? 0,
  };
}

function checkTrophyCondition(
  trophy: TrophyRow,
  stats: GamificationStats,
  currentStreak: number,
): boolean {
  const v = trophy.requirement_value;
  switch (trophy.requirement_type) {
    case 'challenges_completed':  return stats.challengesTotal >= v;
    case 'challenges_in_week':    return stats.challengesThisWeek >= v;
    case 'challenges_in_month':   return stats.challengesThisMonth >= v;
    case 'current_streak':        return currentStreak >= v;
    case 'perfect_challenges':    return stats.perfectTotal >= v;
    default:                      return false;
  }
}

function checkAchievementCondition(
  ach: AchievementRow,
  stats: GamificationStats,
  currentStreak: number,
  currentLevel: number,
): boolean {
  const v = ach.condition_value ?? 0;
  switch (ach.condition_type) {
    case 'challenges_total':   return stats.challengesTotal >= v;
    case 'perfect_challenges': return stats.perfectTotal >= v;
    case 'streak_days':        return currentStreak >= v;
    case 'facts_mastered':     return stats.masteredFacts >= v;
    case 'level_reached':      return currentLevel >= v;
    default:                   return false;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

interface AnswerInput {
  position: number;            // 1..20
  fact_id: string;
  child_answer: number | null; // null = timeout
  time_taken_ms: number;
  block_number: number;        // 1..4
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { session_id, answers }: { session_id: string; answers: AnswerInput[] } = await req.json();

    if (!session_id || !answers?.length) {
      return jsonError(400, 'MISSING_FIELDS', 'session_id e answers sao obrigatorios.');
    }

    // ── 0. Carregar level_thresholds do DB ────────────────────────────────
    const { data: dbThresholds } = await supabase
      .from('level_thresholds')
      .select('level, xp_required')
      .order('level', { ascending: true });
    const levelThresholds = dbThresholds?.length
      ? dbThresholds
      : LEVEL_THRESHOLDS_FALLBACK;

    const computeLevel = (xp: number) => computeLevelFromThresholds(xp, levelThresholds);

    // ── 1. Buscar sessao + child ───────────────────────────────────────────
    const { data: session, error: sErr } = await supabase
      .from('challenge_sessions')
      .select('*, child_profiles!inner(id, timezone, xp_total, level, current_streak, best_streak, last_challenge_date)')
      .eq('id', session_id)
      .single();

    if (sErr || !session) return jsonError(404, 'SESSION_NOT_FOUND', 'Session not found.');

    // ── 2. Idempotencia ────────────────────────────────────────────────────
    if (session.status === 'completed') {
      return jsonOk({
        session,
        xp_earned: session.xp_awarded,
        xp_total: session.child_profiles.xp_total,
        level_up: false,
        new_level: session.child_profiles.level,
        unlocked_reward: null,
        trophies_earned: [],
        achievements_earned: [],
      });
    }

    // ── 3. Verificar payload (sessoes legacy sem payload nao sao suportadas) ─
    const payload = session.questions_payload as Array<{
      position: number;
      fact_id: string;
      operand_a: number;
      operand_b: number;
    }> | null;

    if (!payload) {
      return jsonError(409, 'LEGACY_SESSION_UNSUPPORTED',
        'Esta sessao foi criada antes da Phase 2.5 e nao possui questions_payload. Inicie uma nova sessao.');
    }

    // ── 4. Buscar respostas corretas do catalogo ───────────────────────────
    const factIds = payload.map(p => p.fact_id);
    const { data: facts, error: factErr } = await supabase
      .from('arithmetic_facts')
      .select('id, answer, fact_group_id')
      .in('id', factIds);

    if (factErr || !facts) {
      return jsonError(500, 'FACTS_FETCH_FAILED', 'Erro ao buscar arithmetic_facts.');
    }

    const factAnswerMap = new Map(facts.map(f => [f.id, f.answer]));
    const factGroupMap = new Map(facts.map(f => [f.id, f.fact_group_id]));
    const payloadMap = new Map(payload.map(p => [p.position, p]));

    // ── 5. Validar e pontuar respostas ─────────────────────────────────────
    const rules = getRules();
    const childId = session.child_id;
    const child = session.child_profiles;

    const answerRows: Array<{
      session_id: string;
      block_number: number;
      attempt_number: number;
      question_index: number;
      operand_a: number;
      operand_b: number;
      correct_answer: number | undefined;
      child_answer: number | null;
      is_correct: boolean;
      time_taken_ms: number;
      response_time_ms: number;
      xp_awarded: number;
      fact_id: string;
    }> = [];

    const correctByPosition = new Set<number>();

    for (const ans of answers) {
      const q = payloadMap.get(ans.position);
      if (!q || q.fact_id !== ans.fact_id) {
        return jsonError(400, 'ANSWER_MISMATCH',
          `Resposta na posicao ${ans.position} nao bate com o payload da sessao.`);
      }

      const correctAnswer = factAnswerMap.get(ans.fact_id);
      const isCorrect = ans.child_answer !== null && ans.child_answer === correctAnswer;
      const firstCorrect = isCorrect && !correctByPosition.has(ans.position);
      if (firstCorrect) correctByPosition.add(ans.position);

      answerRows.push({
        session_id,
        block_number: ans.block_number,
        attempt_number: 1,
        question_index: ans.position - 1,
        operand_a: q.operand_a,
        operand_b: q.operand_b,
        correct_answer: correctAnswer,
        child_answer: ans.child_answer,
        is_correct: isCorrect,
        time_taken_ms: ans.time_taken_ms,
        response_time_ms: ans.time_taken_ms,
        xp_awarded: firstCorrect ? XP_PER_CORRECT : 0,
        fact_id: ans.fact_id,
      });
    }

    const correctCount = correctByPosition.size;
    // "Perfeito" e por payload desta sessao (session.total_questions), nao pela regra global —
    // question_count e configuravel por crianca desde a Fase C, session.total_questions ja
    // reflecte o valor real usado para gerar o payload.
    const isPerfect = correctCount === (session.total_questions ?? rules.session.questionsPerChallenge);

    // ── 6. Computar XP ─────────────────────────────────────────────────────
    const answerXp = correctCount * XP_PER_CORRECT;
    const completionXp = XP_COMPLETION_BONUS;
    const perfectXp = isPerfect ? XP_PERFECT_BONUS : 0;
    const totalXpEarned = answerXp + completionXp + perfectXp;

    // ── 7. Inserir respostas ───────────────────────────────────────────────
    const { error: insErr } = await supabase.from('challenge_answers').insert(answerRows);
    if (insErr) return jsonError(500, 'INSERT_ANSWERS_FAILED', insErr.message);

    // ── 8. Atualizar mastery por fact ──────────────────────────────────────
    const childTimezone = child.timezone ?? 'America/Sao_Paulo';
    for (const row of answerRows) {
      await updateMastery({
        supabase,
        childId,
        factId: row.fact_id,
        sessionId: session_id,
        isCorrect: row.is_correct,
        childTimezone,
        rules,
      });
    }

    // ── 9. Comutatividade ──────────────────────────────────────────────────
    if (rules.commutativity.enabled) {
      for (const row of answerRows) {
        const groupId = factGroupMap.get(row.fact_id);
        if (groupId) {
          await applyCommutativity({
            supabase,
            childId,
            factId: row.fact_id,
            factGroupId: groupId,
            isCorrect: row.is_correct,
            childTimezone,
            rules,
          });
        }
      }
    }

    // ── 9b. Reteste persistente (child_fact_retest) ────────────────────────
    // Sistema independente de mastery/WEAK — erro em qualquer fato marca-o (+ par
    // comutativo) para reteste garantido em desafios futuros; acerto em sessao/dia
    // distinto avanca o streak ate ao limiar global, que limpa a flag (linha fica).
    {
      const outcomesByFact = new Map<string, { wrong: boolean; correct: boolean }>();
      for (const row of answerRows) {
        const cur = outcomesByFact.get(row.fact_id) ?? { wrong: false, correct: true };
        if (!row.is_correct) { cur.wrong = true; cur.correct = false; }
        outcomesByFact.set(row.fact_id, cur);
      }
      const retestOutcomes: RetestAnswerOutcome[] = [...outcomesByFact.entries()]
        .map(([factId, o]) => ({ factId, wrong: o.wrong, correct: o.correct }));

      const appConfig = await getAppConfig(supabase);
      await applyRetestOutcomes({
        supabase,
        childId,
        childTimezone,
        threshold: appConfig.retestCorrectThreshold,
        outcomes: retestOutcomes,
        factGroupMap,
      });
    }

    // ── 10. Streak ─────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]!;
    const isRetroactive = session.challenge_date !== today;
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
          newStreak = child.current_streak;
        } else {
          newStreak = 1;
        }
      }
      newBestStreak = Math.max(newStreak, child.best_streak);
    }

    // ── 11. Atualizar child_profiles ───────────────────────────────────────
    const oldLevel = child.level;
    const newXpTotal = child.xp_total + totalXpEarned;
    const newLevel = computeLevel(newXpTotal);
    const levelUp = newLevel > oldLevel;

    const profileUpdate: Record<string, unknown> = {
      xp_total: newXpTotal,
      level: newLevel,
    };
    if (!isRetroactive) {
      profileUpdate.current_streak = newStreak;
      profileUpdate.best_streak = newBestStreak;
      profileUpdate.last_challenge_date = session.challenge_date;
    }

    await supabase.from('child_profiles').update(profileUpdate).eq('id', childId);

    // ── 12. Upsert calendar_days ───────────────────────────────────────────
    await supabase
      .from('calendar_days')
      .upsert({
        child_id: childId,
        day_date: session.challenge_date,
        state: 'completed',
        is_perfect: isPerfect,
        is_retroactive: isRetroactive,
        session_id,
      }, { onConflict: 'child_id,day_date' });

    // ── 13. Append XP ledger ───────────────────────────────────────────────
    const ledgerRows = [];
    if (answerXp > 0) {
      ledgerRows.push({ child_id: childId, source: 'correct_answer', amount: answerXp, reference_id: session_id });
    }
    ledgerRows.push({ child_id: childId, source: 'challenge_completion', amount: completionXp, reference_id: session_id });
    if (perfectXp > 0) {
      ledgerRows.push({ child_id: childId, source: 'challenge_completion', amount: perfectXp, reference_id: session_id });
    }
    await supabase.from('child_xp_ledger').insert(ledgerRows);

    // ── 14. Marcar sessao como completa ────────────────────────────────────
    // Feito ANTES da avaliacao de gamificacao: fetchGamificationStats conta
    // challenge_sessions com status='completed', logo esta sessao tem de ja
    // estar completed para contar para os trophies/achievements deste desafio
    // (senao daily1 / firstChallenge / perfect1 nunca disparam no 1o desafio).
    const { data: updatedSession } = await supabase
      .from('challenge_sessions')
      .update({
        status: 'completed',
        correct_count: correctCount,
        xp_awarded: totalXpEarned,
        is_perfect: isPerfect,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session_id)
      .select()
      .single();

    // ── 15. Trophy + Achievement evaluation (Phase 3 — completo) ─────────
    const trophiesEarned: TrophyRow[] = [];
    const achievementsEarned: AchievementRow[] = [];

    try {
      const now = new Date().toISOString();

      // Carregar stats necessarios para avaliacao
      const stats = await fetchGamificationStats(supabase, childId, session.challenge_date);

      // Carregar catalogo de trophies + achievements
      const [{ data: allTrophies }, { data: allAchievements }] = await Promise.all([
        supabase.from('trophies').select('*').order('sort_order'),
        supabase.from('achievements').select('*').order('sort_order'),
      ]);

      // Carregar o que o child ja tem
      const [{ data: earnedTrophies }, { data: earnedAchievements }] = await Promise.all([
        supabase.from('child_trophies').select('trophy_id').eq('child_id', childId),
        supabase.from('child_achievements').select('achievement_id').eq('child_id', childId),
      ]);

      const earnedTrophyIds = new Set((earnedTrophies ?? []).map((r: { trophy_id: string }) => r.trophy_id));
      const earnedAchievementIds = new Set((earnedAchievements ?? []).map((r: { achievement_id: string }) => r.achievement_id));

      // Avaliar trophies
      for (const trophy of (allTrophies ?? []) as TrophyRow[]) {
        if (earnedTrophyIds.has(trophy.id)) continue;
        if (checkTrophyCondition(trophy, stats, newStreak)) {
          await supabase.from('child_trophies').upsert(
            { child_id: childId, trophy_id: trophy.id, progress: trophy.requirement_value, earned_at: now },
            { onConflict: 'child_id,trophy_id' },
          );
          trophiesEarned.push(trophy);
        }
      }

      // Avaliar achievements (one-time only)
      for (const ach of (allAchievements ?? []) as AchievementRow[]) {
        if (earnedAchievementIds.has(ach.id)) continue;
        if (checkAchievementCondition(ach, stats, newStreak, newLevel)) {
          await supabase.from('child_achievements').upsert(
            { child_id: childId, achievement_id: ach.id, progress: ach.condition_value ?? 1, earned_at: now },
            { onConflict: 'child_id,achievement_id' },
          );
          achievementsEarned.push(ach);
        }
      }
    } catch (gamErr) {
      console.error('Gamification eval error (non-fatal):', gamErr);
    }

    // ── 15. Level reward unlock ────────────────────────────────────────────
    let unlockedReward = null;
    if (levelUp) {
      try {
        const { data: reward } = await supabase
          .from('level_rewards').select('*').eq('unlock_level', newLevel).maybeSingle();
        if (reward) {
          await supabase.from('child_level_rewards')
            .upsert({ child_id: childId, reward_id: reward.id }, { onConflict: 'child_id,reward_id' });
          unlockedReward = reward;
        }
      } catch { /* non-fatal */ }
    }

    // ── 15b. Tabuada Semanal Premiada — o desafio diário normal é o "6º bloco" ──
    // Fecha o dia da tabuada (e a semana, se for o 7º dia) se os 5 blocos já
    // estivessem "passed" antes deste desafio terminar. Não-fatal: a Tabuada Semanal
    // é um módulo à parte, uma falha aqui nunca pode comprometer XP/streak/troféus já
    // gravados acima. Usa a data de hoje no timezone da criança (não session.challenge_date
    // — retroativos não fecham o dia de hoje da tabuada, mas o hook em si é seguro correr
    // sempre, já que só actua sobre o dia "hoje").
    try {
      const tabuadaToday = toLocalDate(new Date(), childTimezone);
      await tryCompleteDay(supabase, childId, tabuadaToday);
    } catch (tabuadaErr) {
      console.error('Tabuada Semanal completion hook error (non-fatal):', tabuadaErr);
    }

    // ── 16. Resposta (sessao ja marcada completa no passo 14) ──────────────
    return jsonOk({
      session: updatedSession ?? { id: session_id, status: 'completed', correct_count: correctCount, xp_awarded: totalXpEarned, is_perfect: isPerfect },
      xp_earned: totalXpEarned,
      xp_total: newXpTotal,
      level_up: levelUp,
      new_level: levelUp ? newLevel : null,
      unlocked_reward: unlockedReward,
      trophies_earned: trophiesEarned,
      achievements_earned: achievementsEarned,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('complete_challenge error:', err);
    return jsonError(500, 'INTERNAL_ERROR', message);
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
