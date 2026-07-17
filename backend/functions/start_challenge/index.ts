/**
 * start_challenge — Edge Function (Phase 2.5 — adaptive engine)
 *
 * Cria ou retoma uma challenge_session. Diferenca para v1:
 * - Ignora question_seed (legacy).
 * - Gera 20 questoes adaptativamente a partir de child_fact_mastery + adaptive-rules.json.
 * - Persiste payload em challenge_sessions.questions_payload.
 *
 * Request body:
 * {
 *   child_id: string;
 *   challenge_date: string;   // YYYY-MM-DD
 *   module_id?: string;       // default 'multiplication'
 *   session_id: string;       // client UUID (idempotencia)
 *   timer_seconds: number;
 * }
 *
 * Response:
 * {
 *   sessionId: string;
 *   status: 'new' | 'resumed';
 *   questions: Array<{
 *     position: number;
 *     fact_id: string;
 *     operand_a: number;
 *     operand_b: number;
 *     bucket: MasteryState;
 *   }>;
 *   rulesVersion: number;
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getRules, getRulesVersion } from '../_shared/adaptive-rules.ts';
import { selectQuestions } from '../_shared/question-selector.ts';

const RETROACTIVE_WINDOW_DAYS = 30;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const { child_id, challenge_date, session_id, timer_seconds } = body;
    const module_id = body.module_id ?? 'multiplication';

    // Validacao de inputs
    if (!child_id || !challenge_date || !session_id || timer_seconds == null) {
      return jsonError(400, 'MISSING_FIELDS', 'child_id, challenge_date, session_id e timer_seconds sao obrigatorios.');
    }

    // Validacao de data
    const today = new Date().toISOString().split('T')[0]!;
    const diffDays = Math.floor(
      (new Date(today).getTime() - new Date(challenge_date).getTime()) / 86400000,
    );
    if (diffDays < 0) {
      return jsonError(400, 'FUTURE_DATE', 'Cannot start a challenge for a future date.');
    }
    if (diffDays > RETROACTIVE_WINDOW_DAYS) {
      return jsonError(429, 'RETROACTIVE_WINDOW_EXPIRED', 'Outside 7-day retroactive window.');
    }

    // Idempotencia: 1) por session_id (mesmo cliente)
    const { data: existing } = await supabase
      .from('challenge_sessions')
      .select('id, status, questions_payload, rules_version, correct_count, xp_awarded, is_perfect')
      .eq('id', session_id)
      .maybeSingle();

    if (existing?.status === 'completed') {
      return jsonError(409, 'ALREADY_COMPLETED', 'Este desafio ja foi concluido.', {
        correctCount: existing.correct_count,
        xpAwarded: existing.xp_awarded,
        isPerfect: existing.is_perfect,
      });
    }

    if (existing?.questions_payload) {
      return jsonOk({
        sessionId: existing.id,
        status: 'resumed',
        questions: existing.questions_payload,
        rulesVersion: existing.rules_version,
      });
    }

    // Idempotencia: 2) por (child_id, challenge_date, module_id) — previne unique constraint ao retry
    // Inclui sessoes sem payload (criadas por tentativas anteriores que falharam a meio).
    const { data: existingByDate } = await supabase
      .from('challenge_sessions')
      .select('id, status, questions_payload, rules_version, correct_count, xp_awarded, is_perfect')
      .eq('child_id', child_id)
      .eq('challenge_date', challenge_date)
      .eq('module_id', module_id)
      .maybeSingle();

    // Dia ja concluido: recusar reabertura — nao ha XP a ganhar de novo e as
    // perguntas seriam as mesmas (o filho estaria so a repetir sem efeito real).
    if (existingByDate?.status === 'completed') {
      return jsonError(409, 'ALREADY_COMPLETED', 'Este desafio ja foi concluido.', {
        correctCount: existingByDate.correct_count,
        xpAwarded: existingByDate.xp_awarded,
        isPerfect: existingByDate.is_perfect,
      });
    }

    // Se ja tem payload: retornar directamente
    if (existingByDate?.questions_payload) {
      return jsonOk({
        sessionId: existingByDate.id,
        status: 'resumed',
        questions: existingByDate.questions_payload,
        rulesVersion: existingByDate.rules_version,
      });
    }

    // Se existe mas sem payload (orfao): reutilizar o mesmo id para o upsert nao colidir
    const effectiveSessionId = existingByDate?.id ?? session_id;

    // Carregar mastery atual da crianca
    const { data: mastery, error: masteryErr } = await supabase
      .from('child_fact_mastery')
      .select('fact_id, state, strength, last_seen_at')
      .eq('child_id', child_id);

    if (masteryErr) {
      console.error('mastery fetch error', masteryErr);
      return jsonError(500, 'MASTERY_FETCH_FAILED', masteryErr.message);
    }

    // Carregar catalogo de facts
    const { data: facts, error: factsErr } = await supabase
      .from('multiplication_facts')
      .select('id, operand_a, operand_b, answer, fact_group_id, base_difficulty');

    if (factsErr || !facts || facts.length === 0) {
      return jsonError(500, 'FACTS_NOT_SEEDED', 'multiplication_facts table is empty.');
    }

    // Cooldown: facts usados nas ultimas N sessoes
    const rules = getRules();
    const { data: recentSessions } = await supabase
      .from('challenge_sessions')
      .select('questions_payload')
      .eq('child_id', child_id)
      .neq('id', session_id)
      .not('questions_payload', 'is', null)
      .order('started_at', { ascending: false })
      .limit(rules.antiRepeat.crossSessionCooldown);

    const excludedFactIds = new Set<string>();
    (recentSessions ?? []).forEach((s: { questions_payload: Array<{ fact_id: string }> | null }) => {
      (s.questions_payload ?? []).forEach(q => excludedFactIds.add(q.fact_id));
    });

    // Selecionar questoes adaptativamente — quantidade vem do perfil da crianca
    // (fallback para a regra global se a coluna ainda nao existir/for null)
    const { data: childRow } = await supabase
      .from('child_profiles')
      .select('question_count')
      .eq('id', child_id)
      .maybeSingle();
    const questionCount = childRow?.question_count ?? rules.session.questionsPerChallenge;

    const { questions, metadata } = selectQuestions({
      facts,
      mastery: mastery ?? [],
      excludedFactIds,
      rules,
      seed: effectiveSessionId,
      questionCount,
    });

    // Upsert da sessao com payload persistido
    const { error: upsertErr } = await supabase
      .from('challenge_sessions')
      .upsert({
        id: effectiveSessionId,
        child_id,
        challenge_date,
        module_id,
        questions_payload: questions,
        rules_version: getRulesVersion(),
        selection_metadata: metadata,
        timer_seconds,
        multiplication_max: 10,
        status: 'in_progress',
        total_questions: rules.session.questionsPerChallenge,
        is_retroactive: diffDays > 0,
        question_seed: null, // legacy — deprecado na Phase 2.5
      }, { onConflict: 'id' });

    if (upsertErr) {
      console.error('upsert error', upsertErr);
      return jsonError(500, 'SESSION_UPSERT_FAILED', upsertErr.message);
    }

    return jsonOk({
      sessionId: effectiveSessionId,
      status: 'new',
      questions,
      rulesVersion: getRulesVersion(),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('start_challenge error', err);
    return jsonError(500, 'INTERNAL_ERROR', message);
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: code, message, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
