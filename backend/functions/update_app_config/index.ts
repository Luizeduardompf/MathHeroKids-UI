/**
 * update_app_config — Edge Function (Deno)
 *
 * Único caminho de escrita em app_config (RLS bloqueia writes de authenticated —
 * ver migration 017). Usado pela tela "Developers" na área dos pais para editar os
 * settings globais do sistema de reteste (retest_correct_threshold, retest_percentage).
 * Requer parent autenticado — a tela já double-gate (PIN + senha fixa) antes de chegar aqui.
 *
 * Request body:
 * { key: 'retest_correct_threshold' | 'retest_percentage', value: number }
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

const ALLOWED_KEYS = ['retest_correct_threshold', 'retest_percentage'] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

function validateValue(key: AllowedKey, value: number): string | null {
  if (!Number.isFinite(value)) return 'INVALID_VALUE';
  if (key === 'retest_correct_threshold') {
    return Number.isInteger(value) && value >= 1 && value <= 50 ? null : 'INVALID_VALUE';
  }
  // retest_percentage
  return value > 0 && value <= 1 ? null : 'INVALID_VALUE';
}

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

    const body = await req.json() as { key?: string; value?: number };
    const { key, value } = body;

    if (!key || !ALLOWED_KEYS.includes(key as AllowedKey) || value == null) {
      return json({ ok: false, error: 'MISSING_FIELDS' }, 400);
    }

    const validationError = validateValue(key as AllowedKey, value);
    if (validationError) return json({ ok: false, error: validationError }, 400);

    const { error: upsertError } = await supabaseAdmin
      .from('app_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (upsertError) throw upsertError;

    return json({ ok: true });

  } catch (err) {
    console.error('update_app_config error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
