/**
 * evolution-webhook — Edge Function (Deno), pública (verify_jwt=false)
 *
 * Recebe todos os eventos da Evolution API (connection.update, qrcode.updated,
 * messages.upsert, messages.update, ...) e grava em whatsapp_events. Em
 * connection.update com state='close', regista o evento (sem alertas por e-mail nesta
 * primeira fase — ver docs/WHATSAPP_INTEGRATION_ROADMAP.md, pendente de conta Resend).
 *
 * Reconciliação de entrega: a Evolution API responde 2xx a /message/sendText assim que
 * aceita a mensagem (status PENDING), não quando é entregue. Se chegar aqui um
 * messages.update com fromMe=true e status=ERROR, corrige retroactivamente
 * whatsapp_notification_log de 'sent' para 'failed' usando evolution_message_id.
 *
 * Protegido por EVOLUTION_WEBHOOK_SECRET (opcional) comparado ao header apikey/x-webhook-secret
 * enviado pela Evolution API — não usa JWT porque a Evolution API não tem sessão Supabase.
 *
 * Configuração na Evolution API (feito manualmente após deploy, ver Fase 3 do roadmap):
 *   URL: https://<project-ref>.supabase.co/functions/v1/evolution-webhook
 *   Eventos: todos (ou pelo menos CONNECTION_UPDATE, MESSAGES_UPDATE)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');
    if (webhookSecret) {
      const provided = req.headers.get('apikey') ?? req.headers.get('x-webhook-secret');
      if (provided !== webhookSecret) return json({ error: 'UNAUTHORIZED' }, 401);
    }

    const payload = await req.json().catch(() => null) as {
      event?: string;
      instance?: string;
      data?: Record<string, unknown>;
    } | null;
    if (!payload) return json({ ok: false, error: 'INVALID_PAYLOAD' }, 400);

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    await supabaseAdmin.from('whatsapp_events').insert({
      event: payload.event ?? 'unknown',
      instance: payload.instance ?? null,
      data: payload.data ?? {},
    });

    // Reconciliação de entrega falhada
    if (payload.event === 'messages.update') {
      const d = payload.data as { keyId?: string; key?: { id?: string }; fromMe?: boolean; status?: string; update?: { status?: string } } | undefined;
      const messageId = d?.keyId ?? d?.key?.id;
      const status = d?.status ?? d?.update?.status;
      const fromMe = d?.fromMe ?? true;
      if (fromMe && messageId && status === 'ERROR') {
        await supabaseAdmin
          .from('whatsapp_notification_log')
          .update({ status: 'failed', error_detail: 'Evolution API reportou ERROR via webhook' })
          .eq('evolution_message_id', messageId);
      }
    }

    return json({ ok: true });

  } catch (err) {
    console.error('evolution-webhook error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
