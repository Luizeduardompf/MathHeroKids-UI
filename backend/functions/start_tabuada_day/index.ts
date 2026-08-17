/**
 * start_tabuada_day — Edge Function (módulo "Tabuada Semanal Premiada")
 *
 * Cria ou retoma o progresso de hoje: gera as 100 questões do dia, já repartidas em 5
 * blocos fixos de 20 (20 questões, 10s cada — nunca mudam, independentes de question_count/
 * timer_seconds do desafio normal), e persiste o payload (idempotente por (child_id,
 * day_date), mesmo padrão de start_challenge). Nunca aceita uma data que não seja "hoje" no
 * timezone da criança: este módulo não tem conceito retroactivo, a medalha semanal exige
 * feitos ao vivo, dia a dia. Rejeita se a criança não tem o módulo ligado
 * (child_profiles.tabuada_enabled) — defesa em profundidade, o cliente já esconde o ponto
 * de entrada.
 *
 * Pool de factos do dia (ver migration 022):
 *   tabuada_use_general_settings=false (default) — SEMPRE a tabuada fixa 1-10 × 1-10 (100
 *     factos de multiplicação), independente do multiplication_max do desafio normal.
 *   tabuada_use_general_settings=true — usa enabled_operations + multiplication_max da
 *     criança (as "regras gerais"), tal como o desafio diário normal.
 * Em ambos os casos, buildDayPayload nunca repete um facto dentro dos 5 blocos do dia.
 * Se o pai mudar esta flag (ou multiplication_max/enabled_operations) a meio do dia mas a
 * criança ainda não tiver respondido nada (attempts=0 em todos os blocos), o dia é
 * regenerado nesta chamada para reflectir a definição actual — só fica "congelado" com o
 * payload antigo depois de haver progresso real.
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
import type { BlockState, TabuadaFact, TabuadaOperation } from '../_shared/tabuada.ts';

type Operation = TabuadaOperation;

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
      .select('timezone, tabuada_enabled, tabuada_use_general_settings, multiplication_max, enabled_operations')
      .eq('id', child_id)
      .maybeSingle();

    if (childErr || !childRow) {
      return jsonError(404, 'CHILD_NOT_FOUND', 'Criança não encontrada.');
    }
    if (!childRow.tabuada_enabled) {
      return jsonError(403, 'TABUADA_DISABLED', 'A Tabuada Semanal Premiada não está activada para esta criança.');
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

    // Se o dia já existe MAS a criança ainda não respondeu nada (0 attempts em todos os
    // blocos), regenera a partir das definições ACTUAIS em vez de devolver o payload
    // antigo — cobre o caso de o pai ligar/desligar "seguir configurações gerais" (ou mudar
    // multiplication_max/enabled_operations) depois do dia ter sido gerado, mas antes da
    // criança começar a jogar. Uma vez com progresso real (attempts>0) ou já completo,
    // mantém o payload tal como está — mudar as questões a meio destruiria o histórico do
    // dia (blocks_state referencia posições/factos deste payload específico).
    const dayUntouched = !!existing
      && !existing.completed_at
      && (existing.blocks_state as BlockState[]).every((b) => b.attempts === 0);

    if (existing && !dayUntouched) {
      return jsonOk({
        dayDate: today,
        status: existing.completed_at ? 'completed' : 'resumed',
        questions: existing.questions_payload,
        blocksState: existing.blocks_state,
      });
    }

    let pool: TabuadaFact[];
    if (childRow.tabuada_use_general_settings) {
      // Regras gerais do desafio normal: operações activas + multiplication_max.
      const enabledOperations: Operation[] = (childRow.enabled_operations?.length
        ? childRow.enabled_operations
        : ['multiplication']) as Operation[];
      const max = childRow.multiplication_max ?? 10;

      // multiplication_max só faz sentido para multiplicação — as outras operações usam
      // sempre o catálogo seedado inteiro (sem conceito de "máximo" configurável).
      const { data: allOpFacts, error: opFactsErr } = await supabase
        .from('arithmetic_facts')
        .select('id, operand_a, operand_b, answer, operation')
        .in('operation', enabledOperations);
      if (opFactsErr) {
        return jsonError(500, 'FACTS_FETCH_FAILED', opFactsErr.message);
      }
      pool = ((allOpFacts ?? []) as TabuadaFact[]).filter(
        (f) => f.operation !== 'multiplication' || (f.operand_a <= max && f.operand_b <= max),
      );
    } else {
      // Default: sempre a tabuada completa 1-10 × 1-10 (100 factos de multiplicação),
      // independente do multiplication_max configurável do desafio diário normal.
      const { data: rangedFacts, error: factsErr } = await supabase
        .from('arithmetic_facts')
        .select('id, operand_a, operand_b, answer')
        .eq('operation', 'multiplication')
        .gte('operand_a', 1).lte('operand_a', 10)
        .gte('operand_b', 1).lte('operand_b', 10);

      if (factsErr) {
        return jsonError(500, 'FACTS_FETCH_FAILED', factsErr.message);
      }
      pool = (rangedFacts ?? []).map((f) => ({ ...f, operation: 'multiplication' as const }));
    }

    if (pool.length < 100) {
      console.error(`Pool de factos da Tabuada Semanal tem ${pool.length}, esperava pelo menos 100.`);
      return jsonError(500, 'FACTS_NOT_SEEDED', 'Não há factos suficientes seedados para gerar o dia.');
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
