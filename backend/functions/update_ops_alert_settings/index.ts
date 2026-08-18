/**
 * update_ops_alert_settings — Edge Function (Deno)
 *
 * Único caminho de escrita em ops_alert_settings (RLS só permite select a authenticated —
 * ver migration 024). Usado pela tela "Developers" na área dos pais para editar o email de
 * destino e ligar/desligar cada uma das 3 camadas de alerta. Requer parent autenticado — a
 * tela já double-gate (PIN + senha fixa) antes de chegar aqui. Mesmo padrão de
 * update_app_config.
 *
 * Request body (todos os campos opcionais, só os enviados são actualizados):
 * {
 *   email?: string;
 *   from_email?: string | null;
 *   from_name?: string;
 *   whatsapp_alert_enabled?: boolean;
 *   railway_alert_enabled?: boolean;
 *   send_failure_alert_enabled?: boolean;
 *   webhook_alert_enabled?: boolean;
 * }
 *
 * Response: { ok: boolean, error?: string, message?: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  email?: string;
  from_email?: string | null;
  from_name?: string;
  whatsapp_alert_enabled?: boolean;
  railway_alert_enabled?: boolean;
  send_failure_alert_enabled?: boolean;
  webhook_alert_enabled?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const body = await req.json() as Body;
    const update: Record<string, unknown> = {};

    if (body.email !== undefined) {
      if (!EMAIL_RE.test(body.email)) return json({ ok: false, error: 'INVALID_EMAIL' }, 400);
      update.email = body.email;
    }
    if (body.from_email !== undefined) {
      if (body.from_email !== null && !EMAIL_RE.test(body.from_email)) return json({ ok: false, error: 'INVALID_FROM_EMAIL' }, 400);
      update.from_email = body.from_email;
    }
    if (body.from_name !== undefined) {
      if (typeof body.from_name !== 'string' || !body.from_name.trim()) return json({ ok: false, error: 'INVALID_FROM_NAME' }, 400);
      update.from_name = body.from_name.trim();
    }
    for (const key of ['whatsapp_alert_enabled', 'railway_alert_enabled', 'send_failure_alert_enabled', 'webhook_alert_enabled'] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') return json({ ok: false, error: `INVALID_${key.toUpperCase()}` }, 400);
        update[key] = body[key];
      }
    }

    if (Object.keys(update).length === 0) return json({ ok: false, error: 'MISSING_FIELDS' }, 400);
    update.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('ops_alert_settings')
      .update(update)
      .eq('id', true);

    if (updateError) throw updateError;

    return json({ ok: true });

  } catch (err) {
    console.error('update_ops_alert_settings error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
