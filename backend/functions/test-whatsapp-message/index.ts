/**
 * test-whatsapp-message — Edge Function (Deno)
 *
 * Envio manual de teste a partir do ecrã Developer > Integração WhatsApp. Requer JWT de um
 * pai autenticado (a fricção real de acesso é o PIN 120380 no cliente — ver
 * app/(app)/parent-area/developers.tsx).
 *
 * Request body: { number: string, text: string }   // number: com DDI, ex "351912345678"
 * Response: { ok: boolean, messageId?: string, error?: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getEvolutionConfig, sendWhatsAppText } from '../_shared/whatsapp.ts';

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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    const body = await req.json().catch(() => ({})) as { number?: string; text?: string };
    const number = (body.number ?? '').replace(/\D/g, '');
    const text = (body.text ?? '').trim();
    if (!number || number.length < 8) return json({ ok: false, error: 'INVALID_NUMBER' }, 400);
    if (!text) return json({ ok: false, error: 'INVALID_TEXT' }, 400);

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const config = await getEvolutionConfig(supabaseAdmin);
    if (!config) return json({ ok: false, error: 'EVOLUTION_NOT_CONFIGURED' }, 503);

    const result = await sendWhatsAppText(config, number, text);
    if (!result.ok) return json({ ok: false, error: 'SEND_FAILED', detail: result.raw }, 502);

    return json({ ok: true, messageId: result.messageId });

  } catch (err) {
    console.error('test-whatsapp-message error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
