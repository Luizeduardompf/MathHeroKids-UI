/**
 * evolution-webhook — Edge Function (Deno), pública (verify_jwt=false)
 *
 * Recebe todos os eventos da Evolution API (connection.update, qrcode.updated,
 * messages.upsert, messages.update, ...) e grava em whatsapp_events. Em connection.update,
 * detecta queda real (state=close) vs. reconexão normal (blips "connecting"→"open" em 1-2s,
 * que fazem parte do funcionamento normal do Baileys) e dispara alerta por email (camada 2
 * de 3 do sistema de ops alerts, ver _shared/opsAlert.ts) quando a conexão cai ou volta —
 * portado de Luka/Luka/supabase/functions/evolution-webhook.
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
import { sendOpsAlert } from '../_shared/opsAlert.ts';
import { getOpsAlertSettings } from '../_shared/opsAlertSettings.ts';

function nowUtcLabel(): string {
  return `${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

// deno-lint-ignore no-explicit-any
async function handleConnectionUpdate(supabaseAdmin: any, instance: string, state: string, statusReason: unknown) {
  // Estado anterior (evento connection.update mais recente antes deste, já persistido acima).
  const { data: rows } = await supabaseAdmin
    .from('whatsapp_events')
    .select('data')
    .eq('event', 'connection.update')
    .eq('instance', instance)
    .order('created_at', { ascending: false })
    .limit(2);
  const previousState = (rows as Array<{ data: { state?: string } }> | null)?.[1]?.data?.state;

  const isDown = state === 'close' && previousState !== 'close';
  const isRecovery = state === 'open' && previousState === 'close';
  if (!isDown && !isRecovery) return;

  const settings = await getOpsAlertSettings(supabaseAdmin);
  if (!settings?.whatsapp_alert_enabled) return;
  const from = settings.from_email ? { email: settings.from_email, name: settings.from_name } : undefined;

  if (isDown) {
    await sendOpsAlert(
      supabaseAdmin,
      settings.email,
      '⚠️ MathHeroKids: WhatsApp desconectado',
      `A instância "${instance}" do WhatsApp (Evolution API) caiu às ${nowUtcLabel()}.\n\n` +
      `Motivo reportado pela Evolution API (statusReason): ${JSON.stringify(statusReason) ?? 'não informado'}\n\n` +
      `Reconecte escaneando o QR code em Developer → Integração WhatsApp no app.`,
      from,
    );
  } else {
    await sendOpsAlert(
      supabaseAdmin,
      settings.email,
      '✅ MathHeroKids: WhatsApp reconectado',
      `A instância "${instance}" do WhatsApp (Evolution API) voltou a conectar normalmente às ${nowUtcLabel()}.`,
      from,
    );
  }
}

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

    if (payload.event === 'connection.update' && typeof payload.data?.state === 'string') {
      await handleConnectionUpdate(supabaseAdmin, payload.instance ?? 'unknown', payload.data.state, (payload.data as { statusReason?: unknown }).statusReason);
    }

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
