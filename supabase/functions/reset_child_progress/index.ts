/**
 * reset_child_progress — Edge Function (Deno)
 *
 * Apaga TODO o progresso de jogo de uma criança (XP, níveis, streak, desafios,
 * calendário, troféus, achievements, mastery, reteste, Tabuada Semanal Premiada) para
 * ela recomeçar do zero — usado pela tela "Developers" > "Resetar progresso". Mantém
 * identidade (username, display_name, avatar, birth_date), settings configuráveis
 * (timer, operações, WhatsApp, tabuada_enabled/reward) e dados sociais (amigos,
 * mensagens) intactos — só a progressão é apagada. Irreversível.
 *
 * Mesmo padrão de auth de list_all_children/update_app_config: requer só um parent
 * autenticado, sem ownership check (ferramenta "para nós", já atrás do double-gate da
 * tela Developers) — ao contrário de delete_child, que é acionável por qualquer pai a
 * partir do seu próprio ecrã de perfil e por isso restringe a dono.
 *
 * Request body: { child_id: string }
 * Response: { ok: boolean, error?: string, message?: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    const body = await req.json() as { child_id?: string };
    const childId = body.child_id;
    if (!childId) return json({ ok: false, error: 'MISSING_CHILD_ID' }, 400);

    const { data: child, error: childError } = await supabaseAdmin
      .from('child_profiles')
      .select('id')
      .eq('id', childId)
      .maybeSingle();
    if (childError) throw childError;
    if (!child) return json({ ok: false, error: 'CHILD_NOT_FOUND' }, 404);

    // Ordem importa: calendar_days.session_id -> challenge_sessions não é ON DELETE CASCADE
    // (só child_id é), por isso calendar_days tem de sair antes de challenge_sessions.
    // challenge_answers cai em cascata ao apagar challenge_sessions (FK ON DELETE CASCADE).
    const tables = [
      'calendar_days',
      'challenge_sessions',
      'child_xp_ledger',
      'child_trophies',
      'child_achievements',
      'child_level_rewards',
      'child_fact_mastery',
      'child_fact_retest',
      'weekly_tabuada_days',
      'weekly_tabuada_weeks',
    ] as const;

    for (const table of tables) {
      const { error: deleteError } = await supabaseAdmin.from(table).delete().eq('child_id', childId);
      if (deleteError) throw deleteError;
    }

    const { error: updateError } = await supabaseAdmin
      .from('child_profiles')
      .update({
        xp_total: 0,
        level: 1,
        current_streak: 0,
        best_streak: 0,
        last_challenge_date: null,
      })
      .eq('id', childId);
    if (updateError) throw updateError;

    return json({ ok: true });

  } catch (err) {
    console.error('reset_child_progress error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
