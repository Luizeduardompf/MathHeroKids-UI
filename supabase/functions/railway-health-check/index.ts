/**
 * railway-health-check — Edge Function (Deno), invocada por pg_cron a cada 5 min
 * (migration 024). Camada 1 do sistema de alertas de operação (ver _shared/opsAlert.ts) —
 * dois checks independentes:
 *
 *   1. Evolution API (Railway, projecto isolado do LukaPsi) responde? Cobre o container
 *      inteiro cair — diferente da queda de conexão do WhatsApp (evolution-webhook,
 *      camada 2), que só dispara se a Evolution API estiver no ar para mandar o webhook.
 *   2. O nosso próprio evolution-webhook responde (sem 401/5xx) a um OPTIONS? Fecha o ponto
 *      cego descoberto em 2026-08-18: a camada 2 só alerta quando RECEBE um evento — se o
 *      endpoint em si está a rejeitar tudo (ex: verify_jwt=true por engano num deploy, que
 *      foi exactamente o que aconteceu), a camada 2 fica cega, sem avisar ninguém. OPTIONS é
 *      sem side-effects (a função responde 'ok' antes de tocar em qualquer tabela) e testa
 *      exactamente o gate de verify_jwt que partiu.
 *
 * Aceita { simulateDown: true } e/ou { simulateWebhookDown: true } no body para testar
 * manualmente sem precisar derrubar nada de verdade — o cron de produção sempre chama com
 * body vazio.
 *
 * Portado de Luka/Luka/supabase/functions/railway-health-check (check 1); check 2 é próprio
 * do MathHeroKids.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getEvolutionConfig } from '../_shared/whatsapp.ts';
import { sendOpsAlert } from '../_shared/opsAlert.ts';
import { getOpsAlertSettings } from '../_shared/opsAlertSettings.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function nowUtcLabel(): string {
  return `${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

// deno-lint-ignore no-explicit-any
async function checkTransition(
  supabaseAdmin: any,
  column: 'is_up' | 'webhook_is_up',
  isUp: boolean,
  alertKey: 'railway_alert_enabled' | 'webhook_alert_enabled',
  messages: { down: string; up: string },
) {
  const { data: stateRow } = await supabaseAdmin
    .from('railway_health_state')
    .select(column)
    .eq('id', true)
    .maybeSingle();
  const wasUp = stateRow?.[column] ?? true;

  if (wasUp !== isUp) {
    const settings = await getOpsAlertSettings(supabaseAdmin);
    if (settings?.[alertKey]) {
      const from = settings.from_email ? { email: settings.from_email, name: settings.from_name } : undefined;
      await sendOpsAlert(supabaseAdmin, settings.email, isUp ? `✅ ${messages.up}` : `🔴 ${messages.down}`,
        isUp ? `Voltou a responder normalmente às ${nowUtcLabel()}.` : `Detectado às ${nowUtcLabel()}.`,
        from);
    }
  }

  await supabaseAdmin.from('railway_health_state').update({ [column]: isUp, last_checked_at: new Date().toISOString() }).eq('id', true);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let simulateDown = false;
  let simulateWebhookDown = false;
  try {
    const body = await req.json();
    simulateDown = body?.simulateDown === true;
    simulateWebhookDown = body?.simulateWebhookDown === true;
  } catch { /* body vazio (chamada real do cron) */ }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const config = await getEvolutionConfig(supabaseAdmin);
  if (!config) return json({ error: 'EVOLUTION_NOT_CONFIGURED' }, 503);

  // ── Check 1: Evolution API no ar? ──────────────────────────────────────────
  let isUp = false;
  let downReason = '';
  if (simulateDown) {
    isUp = false;
    downReason = 'simulado manualmente (teste)';
  } else {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(config.evolution_api_url, { signal: controller.signal });
      clearTimeout(timeout);
      isUp = resp.ok;
      if (!isUp) downReason = `HTTP ${resp.status}`;
    } catch (err) {
      isUp = false;
      downReason = err instanceof Error && err.name === 'AbortError'
        ? 'timeout — sem resposta em 10s'
        : `erro de rede: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  await checkTransition(supabaseAdmin, 'is_up', isUp, 'railway_alert_enabled', {
    down: `MathHeroKids: Evolution API (Railway) não está respondendo\n\n` +
      `URL verificada: ${config.evolution_api_url}\nMotivo: ${downReason}\n\n` +
      `Isso é diferente de "WhatsApp desconectado": aqui o servidor inteiro no Railway pode ` +
      `estar fora do ar (crash, deploy quebrado, etc). Verifique o painel do Railway (projecto mathhero-whatsapp).`,
    up: `MathHeroKids: Evolution API (Railway) voltou a responder`,
  });

  // ── Check 2: o nosso próprio evolution-webhook aceita pedidos (sem 401/5xx)? ─────────
  let webhookUp = false;
  let webhookDownReason = '';
  const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;
  if (simulateWebhookDown) {
    webhookUp = false;
    webhookDownReason = 'simulado manualmente (teste)';
  } else {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(webhookUrl, { method: 'OPTIONS', signal: controller.signal });
      clearTimeout(timeout);
      webhookUp = resp.ok;
      if (!webhookUp) webhookDownReason = `HTTP ${resp.status}`;
    } catch (err) {
      webhookUp = false;
      webhookDownReason = err instanceof Error && err.name === 'AbortError'
        ? 'timeout — sem resposta em 10s'
        : `erro de rede: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  await checkTransition(supabaseAdmin, 'webhook_is_up', webhookUp, 'webhook_alert_enabled', {
    down: `MathHeroKids: evolution-webhook a rejeitar pedidos\n\n` +
      `URL verificada: ${webhookUrl}\nMotivo: ${webhookDownReason}\n\n` +
      `A causa mais provável é a função ter sido redeployada sem "--no-verify-jwt" — nesse ` +
      `caso a Evolution API nunca consegue entregar eventos (401), a camada de "WhatsApp ` +
      `desconectado" fica cega, e reconciliação de entregas falhadas pára de funcionar. ` +
      `Correr: supabase functions deploy evolution-webhook --use-api --no-verify-jwt`,
    up: `MathHeroKids: evolution-webhook voltou a aceitar pedidos`,
  });

  return json({
    ok: true,
    isUp, downReason: isUp ? undefined : downReason,
    webhookUp, webhookDownReason: webhookUp ? undefined : webhookDownReason,
  });
});
