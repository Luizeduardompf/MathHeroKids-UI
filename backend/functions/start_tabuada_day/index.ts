/**
 * start_tabuada_day — Edge Function (módulo "Tabuada Semanal Premiada")
 *
 * Cria ou retoma o progresso de hoje: gera as 100 questões do dia — SEMPRE a tabuada
 * completa 1-10 × 1-10 (as 100 combinações, cada uma exactamente uma vez, sem repetição —
 * é a exigência do módulo: ao fim das 100 questões a criança fez a tabuada toda), já
 * repartidas em 5 blocos fixos de 20, e persiste o payload (idempotente por
 * (child_id, day_date), mesmo padrão de start_challenge). Independente do
 * `multiplication_max` configurável do desafio diário normal e do desafio adaptativo em si
 * — não lê/escreve child_fact_mastery, não concede XP. Nunca aceita uma data que não seja
 * "hoje" no timezone da criança: este módulo não tem conceito retroactivo, a medalha
 * semanal exige feitos ao vivo, dia a dia.
 *
 * Request body: { child_id: string }
 * Response: {
 *   dayDate: string;
 *   status: 'new' | 'resumed' | 'completed';
 *   questions: Array<{ position, block_number, fact_id, operand_a, operand_b }>;
 *   blocksState: Array<{ block_number, status, attempts, best_correct_count, passed_at }>;
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { buildDayPayload, initialBlocksState, toLocalDate } from '../_shared/tabuada.ts';
import type { TabuadaFact } from '../_shared/tabuada.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { child_id } = await req.json();
    if (!child_id) {
      return jsonError(400, 'MISSING_FIELDS', 'child_id é obrigatório.');
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

    // Idempotência: já existe progresso de hoje?
    const { data: existing } = await supabase
      .from('weekly_tabuada_days')
      .select('questions_payload, blocks_state, completed_at')
      .eq('child_id', child_id)
      .eq('day_date', today)
      .maybeSingle();

    if (existing) {
      return jsonOk({
        dayDate: today,
        status: existing.completed_at ? 'completed' : 'resumed',
        questions: existing.questions_payload,
        blocksState: existing.blocks_state,
      });
    }

    // Sempre a tabuada completa 1-10 × 1-10 (100 factos) — independente do
    // multiplication_max configurável do desafio diário normal.
    const { data: rangedFacts, error: factsErr } = await supabase
      .from('arithmetic_facts')
      .select('id, operand_a, operand_b, answer')
      .eq('operation', 'multiplication')
      .gte('operand_a', 1).lte('operand_a', 10)
      .gte('operand_b', 1).lte('operand_b', 10);

    if (factsErr) {
      return jsonError(500, 'FACTS_FETCH_FAILED', factsErr.message);
    }

    const pool = (rangedFacts ?? []) as TabuadaFact[];
    if (pool.length !== 100) {
      console.error(`arithmetic_facts tem ${pool.length} factos de multiplicação 1-10, esperava 100.`);
      return jsonError(500, 'FACTS_NOT_SEEDED', 'arithmetic_facts não tem a tabuada 1-10 completa seedada.');
    }

    const questions = buildDayPayload(pool, `${child_id}:${today}`);
    const blocksState = initialBlocksState();

    const { error: upsertErr } = await supabase
      .from('weekly_tabuada_days')
      .upsert({
        child_id,
        day_date: today,
        questions_payload: questions,
        blocks_state: blocksState,
      }, { onConflict: 'child_id,day_date' });

    if (upsertErr) {
      return jsonError(500, 'DAY_UPSERT_FAILED', upsertErr.message);
    }

    return jsonOk({
      dayDate: today,
      status: 'new',
      questions,
      blocksState,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('start_tabuada_day error', err);
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
