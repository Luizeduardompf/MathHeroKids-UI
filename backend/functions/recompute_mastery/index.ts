/**
 * recompute_mastery — Edge Function (Phase 2.5)
 *
 * Recomputa child_fact_mastery a partir do log histórico de challenge_answers.
 * Idempotente: apaga rows afetadas e replays respostas em ordem cronológica.
 *
 * Protegida por header X-Admin-Token ou role service_role.
 * NÃO exposta a clientes autenticados normais.
 *
 * Request body:
 * {
 *   child_id: string;
 *   fact_id?: string;  // omitir = recomputa todas as 100 questões
 * }
 *
 * Response:
 * {
 *   recomputed: number;  // número de facts recomputados
 *   elapsed_ms: number;
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getRules } from '../_shared/adaptive-rules.ts';
import { updateMastery } from '../_shared/mastery.ts';

const ADMIN_TOKEN = Deno.env.get('RECOMPUTE_ADMIN_TOKEN') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Autenticação: aceitar service_role (Authorization: Bearer <service_key>)
  // ou X-Admin-Token explícito
  const authHeader = req.headers.get('Authorization') ?? '';
  const adminTokenHeader = req.headers.get('X-Admin-Token') ?? '';
  const isServiceRole = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '__none__');
  const isAdminToken = ADMIN_TOKEN.length > 0 && adminTokenHeader === ADMIN_TOKEN;

  if (!isServiceRole && !isAdminToken) {
    return jsonError(403, 'FORBIDDEN', 'Esta função requer service_role ou X-Admin-Token.');
  }

  try {
    const t0 = Date.now();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { child_id, fact_id }: { child_id: string; fact_id?: string } = await req.json();

    if (!child_id) return jsonError(400, 'MISSING_CHILD_ID', 'child_id é obrigatório.');

    // 1. Buscar timezone da criança
    const { data: childData } = await supabase
      .from('child_profiles')
      .select('id, timezone')
      .eq('id', child_id)
      .single();

    if (!childData) return jsonError(404, 'CHILD_NOT_FOUND', 'child_id não encontrado.');
    const childTimezone = childData.timezone ?? 'America/Sao_Paulo';

    // 2. Determinar quais facts recomputar
    let factIds: string[];
    if (fact_id) {
      factIds = [fact_id];
    } else {
      const { data: facts } = await supabase
        .from('multiplication_facts')
        .select('id');
      factIds = (facts ?? []).map((f: { id: string }) => f.id);
    }

    // 3. Apagar mastery existente para os facts afetados
    await supabase
      .from('child_fact_mastery')
      .delete()
      .eq('child_id', child_id)
      .in('fact_id', factIds);

    // 4. Buscar todas as respostas históricas, ordenadas por data
    const { data: answers } = await supabase
      .from('challenge_answers')
      .select('fact_id, is_correct, session_id, created_at')
      .eq('session_id',
        // subquery via join: buscar session_ids do child
        supabase
          .from('challenge_sessions')
          .select('id')
          .eq('child_id', child_id)
      )
      .in('fact_id', factIds)
      .order('created_at', { ascending: true });

    // Nota: a subquery acima não funciona diretamente como .eq com subquery no SDK.
    // Usar approach alternativa: buscar session_ids separadamente.
    const { data: sessions } = await supabase
      .from('challenge_sessions')
      .select('id')
      .eq('child_id', child_id);

    const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);

    const { data: allAnswers } = await supabase
      .from('challenge_answers')
      .select('fact_id, is_correct, session_id, created_at')
      .in('session_id', sessionIds)
      .in('fact_id', factIds)
      .order('created_at', { ascending: true });

    const rules = getRules();

    // 5. Replay em ordem cronológica
    for (const answer of (allAnswers ?? [])) {
      if (!answer.fact_id) continue;
      await updateMastery({
        supabase,
        childId: child_id,
        factId: answer.fact_id,
        sessionId: answer.session_id,
        isCorrect: answer.is_correct,
        childTimezone,
        rules,
      });
    }

    const elapsed = Date.now() - t0;
    return jsonOk({ recomputed: factIds.length, elapsed_ms: elapsed });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('recompute_mastery error:', err);
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
