/**
 * submit_tabuada_block — Edge Function (módulo "Tabuada Semanal Premiada")
 *
 * Valida as 20 respostas de um bloco contra o payload persistido por start_tabuada_day
 * (nunca confia na correção declarada pelo cliente — mesmo padrão de complete_challenge).
 * Bloco passa com >=70% de acerto; se falhar, fica "pending" e pode ser retentado (mesmas
 * 20 questões, sem gerar um conjunto novo — não há sobra no pool de 100/dia). Quando os 5
 * blocos do dia ficam "passed", marca o dia completo e recalcula weekly_tabuada_weeks
 * (segunda a domingo); ao atingir 7 dias completos na semana, marca medal_earned_at (a
 * notificação ao pai é responsabilidade do cron send-whatsapp-notifications, não desta EF —
 * mantém os segredos do WhatsApp isolados das funções de gameplay).
 *
 * Este módulo NÃO concede XP nem escreve em child_fact_mastery — ver migration
 * 020_weekly_tabuada.sql para o racional.
 *
 * Request body: {
 *   child_id: string;
 *   block_number: number; // 1..5
 *   answers: Array<{ position: number; fact_id: string; child_answer: number | null }>;
 * }
 * Response: {
 *   dayCompleted: boolean;
 *   blockPassed: boolean;
 *   correctCount: number;
 *   blocksState: BlockState[];
 *   weekStatus: { weekStartDate: string; daysCompleted: number; medalEarned: boolean };
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  BLOCKS_PER_DAY,
  PASS_THRESHOLD,
  QUESTIONS_PER_BLOCK,
  DAYS_TO_COMPLETE_WEEK,
  mondayOfWeek,
  toLocalDate,
} from '../_shared/tabuada.ts';
import type { BlockState, TabuadaQuestion } from '../_shared/tabuada.ts';

interface AnswerInput {
  position: number;
  fact_id: string;
  child_answer: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { child_id, block_number, answers }: { child_id: string; block_number: number; answers: AnswerInput[] } =
      await req.json();

    if (!child_id || !block_number || !answers?.length) {
      return jsonError(400, 'MISSING_FIELDS', 'child_id, block_number e answers são obrigatórios.');
    }
    if (block_number < 1 || block_number > BLOCKS_PER_DAY) {
      return jsonError(400, 'INVALID_BLOCK', `block_number deve estar entre 1 e ${BLOCKS_PER_DAY}.`);
    }
    if (answers.length !== QUESTIONS_PER_BLOCK) {
      return jsonError(400, 'INVALID_ANSWER_COUNT', `Este bloco espera exactamente ${QUESTIONS_PER_BLOCK} respostas.`);
    }

    const { data: childRow, error: childErr } = await supabase
      .from('child_profiles')
      .select('timezone')
      .eq('id', child_id)
      .maybeSingle();
    if (childErr || !childRow) {
      return jsonError(404, 'CHILD_NOT_FOUND', 'Criança não encontrada.');
    }
    const timezone = childRow.timezone ?? 'America/Sao_Paulo';
    const today = toLocalDate(new Date(), timezone);

    const { data: day, error: dayErr } = await supabase
      .from('weekly_tabuada_days')
      .select('questions_payload, blocks_state, completed_at')
      .eq('child_id', child_id)
      .eq('day_date', today)
      .maybeSingle();

    if (dayErr || !day) {
      return jsonError(404, 'DAY_NOT_STARTED', 'O dia de hoje ainda não foi iniciado — chame start_tabuada_day primeiro.');
    }

    // Idempotência: dia já completo, não há nada para mutar.
    if (day.completed_at) {
      const weekStatus = await loadWeekStatus(supabase, child_id, mondayOfWeek(today));
      return jsonOk({
        dayCompleted: true,
        blockPassed: true,
        correctCount: QUESTIONS_PER_BLOCK,
        blocksState: day.blocks_state,
        weekStatus,
      });
    }

    const payload = day.questions_payload as TabuadaQuestion[];
    const blockQuestions = payload.filter(q => q.block_number === block_number);
    if (blockQuestions.length !== QUESTIONS_PER_BLOCK) {
      return jsonError(500, 'BLOCK_PAYLOAD_CORRUPT', 'O payload deste bloco está incompleto.');
    }
    const payloadByPosition = new Map(blockQuestions.map(q => [q.position, q]));

    const factIds = blockQuestions.map(q => q.fact_id);
    const { data: facts, error: factsErr } = await supabase
      .from('arithmetic_facts')
      .select('id, answer')
      .in('id', factIds);
    if (factsErr || !facts) {
      return jsonError(500, 'FACTS_FETCH_FAILED', 'Erro ao buscar arithmetic_facts.');
    }
    const answerByFactId = new Map(facts.map(f => [f.id, f.answer]));

    let correctCount = 0;
    for (const ans of answers) {
      const q = payloadByPosition.get(ans.position);
      if (!q || q.fact_id !== ans.fact_id) {
        return jsonError(400, 'ANSWER_MISMATCH', `Resposta na posição ${ans.position} não bate com o payload do bloco.`);
      }
      const correctAnswer = answerByFactId.get(ans.fact_id);
      if (ans.child_answer !== null && ans.child_answer === correctAnswer) correctCount++;
    }

    const accuracy = correctCount / QUESTIONS_PER_BLOCK;
    const blockPassed = accuracy >= PASS_THRESHOLD;

    const blocksState = (day.blocks_state as BlockState[]).map(b => {
      if (b.block_number !== block_number) return b;
      const alreadyPassed = b.status === 'passed';
      return {
        ...b,
        attempts: b.attempts + 1,
        best_correct_count: Math.max(b.best_correct_count, correctCount),
        status: alreadyPassed || blockPassed ? 'passed' : 'pending',
        passed_at: alreadyPassed ? b.passed_at : (blockPassed ? new Date().toISOString() : null),
      } satisfies BlockState;
    });

    const allBlocksPassed = blocksState.every(b => b.status === 'passed');
    const dayUpdate: Record<string, unknown> = { blocks_state: blocksState, updated_at: new Date().toISOString() };
    if (allBlocksPassed) dayUpdate.completed_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('weekly_tabuada_days')
      .update(dayUpdate)
      .eq('child_id', child_id)
      .eq('day_date', today);
    if (updateErr) {
      return jsonError(500, 'DAY_UPDATE_FAILED', updateErr.message);
    }

    let weekStatus = await loadWeekStatus(supabase, child_id, mondayOfWeek(today));
    if (allBlocksPassed) {
      weekStatus = await recomputeWeek(supabase, child_id, mondayOfWeek(today));
    }

    return jsonOk({
      dayCompleted: allBlocksPassed,
      blockPassed,
      correctCount,
      blocksState,
      weekStatus,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('submit_tabuada_block error', err);
    return jsonError(500, 'INTERNAL_ERROR', message);
  }
});

interface WeekStatus {
  weekStartDate: string;
  daysCompleted: number;
  medalEarned: boolean;
}

async function loadWeekStatus(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  weekStartDate: string,
): Promise<WeekStatus> {
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
 * evita contagem duplicada em corridas/retries e é a mesma filosofia de complete_challenge
 * validar sempre contra o estado persistido, nunca confiar num contador incremental solto.
 */
async function recomputeWeek(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  weekStartDate: string,
): Promise<WeekStatus> {
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
