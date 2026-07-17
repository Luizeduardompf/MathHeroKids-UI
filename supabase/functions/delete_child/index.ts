/**
 * delete_child — Edge Function (Deno)
 *
 * Elimina definitivamente um child_profile e todos os dados relacionados
 * (challenge_sessions, challenge_answers, child_xp_ledger, calendar_days,
 * child_trophies, child_achievements, child_level_rewards, friendships,
 * friend_requests, messages, child_fact_mastery) via ON DELETE CASCADE
 * nas foreign keys — ver backend/migrations/001_initial_schema.sql.
 *
 * Irreversível. Requer que o pedido venha de um parent autenticado que seja
 * dono do child_profile (evita apagar filho de outra conta só por saber o id).
 *
 * Request body:
 * { child_id: string }
 *
 * Response:
 * { ok: boolean, error?: string, message?: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      .select('id, parent_id')
      .eq('id', childId)
      .single();

    if (childError || !child) return json({ ok: false, error: 'CHILD_NOT_FOUND' }, 404);
    if ((child as { parent_id: string }).parent_id !== user.id) {
      return json({ ok: false, error: 'FORBIDDEN' }, 403);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('child_profiles')
      .delete()
      .eq('id', childId);

    if (deleteError) throw deleteError;

    return json({ ok: true });

  } catch (err) {
    console.error('delete_child error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
