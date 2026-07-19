/**
 * start_challenge — Edge Function (Phase 2.5+ — adaptive engine multi-operacao)
 *
 * Cria ou retoma uma challenge_session. Le enabled_operations/mix_operations do
 * child_profiles para decidir de que operacoes tirar questoes:
 * - mix_operations=true: usa todas as enabled_operations, module_id resolvido = 'mixed'.
 * - mix_operations=false + 1 activada: usa-a, ignora module_id do request.
 * - mix_operations=false + >1 activadas: exige module_id do request (uma delas) — o cliente
 *   mostra um seletor antes de chamar esta EF.
 * Questoes de cada operacao sao seleccionadas independentemente (mastery/tiers por operacao
 * fazem sentido separados) e depois combinadas + reembaralhadas para a ordem final.
 *
 * Request body:
 * {
 *   child_id: string;
 *   challenge_date: string;   // YYYY-MM-DD
 *   module_id?: string;       // operacao escolhida quando ha mais de uma activada e nao mistura
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
 *     operation: 'multiplication' | 'addition' | 'subtraction' | 'division';
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
import type { MasteryState } from '../_shared/adaptive-rules.ts';
import { selectQuestions } from '../_shared/question-selector.ts';
import type { Fact, Operation, SelectedQuestion } from '../_shared/question-selector.ts';
import { getAppConfig, getActiveRetestFacts } from '../_shared/retest.ts';

const RETROACTIVE_WINDOW_DAYS = 30;

function splitCount(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

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
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const { child_id, challenge_date, session_id, timer_seconds } = body;
    const requestedOperation = body.module_id as Operation | undefined;

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

    // Configuracao de operacoes da crianca — determina o module_id resolvido ANTES de
    // qualquer lookup de idempotencia (a unicidade da sessao e por module_id resolvido,
    // nao pelo valor bruto que o cliente enviou).
    const { data: childRow } = await supabase
      .from('child_profiles')
      .select('question_count, enabled_operations, mix_operations')
      .eq('id', child_id)
      .maybeSingle();

    const enabledOperations: Operation[] = (childRow?.enabled_operations?.length
      ? childRow.enabled_operations
      : ['multiplication']) as Operation[];
    const mixOperations = childRow?.mix_operations ?? false;

    let sessionOperations: Operation[];
    let module_id: string;
    if (mixOperations) {
      sessionOperations = enabledOperations;
      module_id = 'mixed';
    } else if (enabledOperations.length === 1) {
      sessionOperations = enabledOperations;
      module_id = enabledOperations[0]!;
    } else {
      if (!requestedOperation || !enabledOperations.includes(requestedOperation)) {
        return jsonError(400, 'OPERATION_REQUIRED',
          'Esta crianca tem varias operacoes activadas e nao mistura — module_id deve ser uma delas.');
      }
      sessionOperations = [requestedOperation];
      module_id = requestedOperation;
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

    // Carregar catalogo de facts das operacoes desta sessao
    const { data: allFacts, error: factsErr } = await supabase
      .from('arithmetic_facts')
      .select('id, operation, operand_a, operand_b, answer, fact_group_id, base_difficulty')
      .in('operation', sessionOperations);

    if (factsErr || !allFacts || allFacts.length === 0) {
      return jsonError(500, 'FACTS_NOT_SEEDED', 'arithmetic_facts table is empty for the requested operations.');
    }
    const facts = allFacts as Fact[];

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

    // Quantidade de questoes vem do perfil da crianca (0 = AUTO, cai no default da regra
    // global; null/coluna inexistente idem), repartida por igual entre as operacoes da sessao.
    const questionCount = childRow?.question_count || rules.session.questionsPerChallenge;

    // Reteste persistente (child_fact_retest) — fatos a_retestar=true entram com GARANTIA,
    // mais antigos primeiro, ate 2x cada, antes da selecao adaptativa normal (que so preenche
    // as vagas restantes). Independente de mastery/WEAK — ver _shared/retest.ts.
    const appConfig = await getAppConfig(supabase);
    const factsById = new Map(facts.map(f => [f.id, f]));
    const masteryStateMap = new Map((mastery ?? []).map(m => [m.fact_id, m.state as MasteryState]));
    const retestFacts = await getActiveRetestFacts(supabase, child_id, new Set(facts.map(f => f.id)));
    const retestSlots = Math.round(questionCount * appConfig.retestPercentage);
    const retestQuestions: SelectedQuestion[] = [];
    for (let pass = 0; pass < 2 && retestQuestions.length < retestSlots; pass++) {
      for (const rf of retestFacts) {
        if (retestQuestions.length >= retestSlots) break;
        const f = factsById.get(rf.fact_id);
        if (!f) continue;
        retestQuestions.push({
          position: 0, // renumerado no fim, junto com o resto
          fact_id: f.id,
          operation: f.operation,
          operand_a: f.operand_a,
          operand_b: f.operand_b,
          bucket: masteryStateMap.get(f.id) ?? 'NEW',
        });
      }
    }
    // Excluidos da selecao adaptativa normal — ja garantidos pelo bloco de reteste acima,
    // nao pode ser escolhido de novo (evitaria passar do maximo de 2 aparicoes/sessao).
    retestQuestions.forEach(q => excludedFactIds.add(q.fact_id));

    const remainingCount = Math.max(0, questionCount - retestQuestions.length);
    const perOpCounts = splitCount(remainingCount, sessionOperations.length);

    const bucketCountsMerged: Record<string, number> = {};
    let allQuestions: SelectedQuestion[] = [...retestQuestions];
    for (let i = 0; i < sessionOperations.length; i++) {
      const op = sessionOperations[i]!;
      const opFacts = facts.filter(f => f.operation === op);
      const { questions: opQuestions, metadata: opMetadata } = selectQuestions({
        facts: opFacts,
        mastery: mastery ?? [],
        excludedFactIds,
        rules,
        seed: `${effectiveSessionId}:${op}`,
        questionCount: perOpCounts[i]!,
      });
      allQuestions = allQuestions.concat(opQuestions);
      for (const [bucket, count] of Object.entries(opMetadata.bucketCounts)) {
        bucketCountsMerged[bucket] = (bucketCountsMerged[bucket] ?? 0) + count;
      }
    }

    // Reembaralhar o conjunto combinado (quando ha mais de uma operacao) e renumerar posicoes.
    const combinedRng = mulberry32(seedFromString(effectiveSessionId));
    const finalQuestions = seededShuffle(allQuestions, combinedRng)
      .map((q, idx) => ({ ...q, position: idx + 1 }));

    // Upsert da sessao com payload persistido
    const { error: upsertErr } = await supabase
      .from('challenge_sessions')
      .upsert({
        id: effectiveSessionId,
        child_id,
        challenge_date,
        module_id,
        questions_payload: finalQuestions,
        rules_version: getRulesVersion(),
        selection_metadata: {
          bucketCounts: bucketCountsMerged,
          operations: sessionOperations,
          retestCount: retestQuestions.length,
          // Pool esgotado (operacao com poucos factos + cooldown cross-sessao) pode entregar
          // menos questoes do que o pedido — regista para diagnostico, nunca silencioso.
          ...(finalQuestions.length < questionCount
            ? { requestedQuestionCount: questionCount, shortfall: questionCount - finalQuestions.length }
            : {}),
        },
        timer_seconds,
        multiplication_max: 10,
        status: 'in_progress',
        // total_questions reflete o que foi REALMENTE entregue (finalQuestions.length), nao o
        // pedido (questionCount) — sao a mesma coisa no caminho feliz, mas divergem quando o
        // pool de factos elegiveis (apos cooldown/tier-gating) e menor que o pedido. Usar o
        // valor pedido aqui fazia complete_challenge nunca marcar is_perfect=true numa sessao
        // encurtada, mesmo com 100% de acertos — a crianca perdia XP/troféu por um bug, nao
        // por ter errado nada.
        total_questions: finalQuestions.length,
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
      questions: finalQuestions,
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
