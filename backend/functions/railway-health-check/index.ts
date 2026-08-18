/**
 * railway-health-check — Edge Function (Deno), invocada por pg_cron a cada 5 min
 * (migration 024). Camada 1 de 3 do sistema de alertas de operação (ver
 * _shared/opsAlert.ts) — verifica se a Evolution API (hospedada no Railway, projecto
 * isolado do LukaPsi) responde. Cobre o cenário do container inteiro cair — diferente da
 * queda de conexão do WhatsApp (evolution-webhook, camada 2), que só dispara se a Evolution
 * API estiver no ar para mandar o webhook. Se o servidor cair por completo, ninguém avisaria
 * sem isto.
 *
 * Aceita { simulateDown: true } no body para testar manualmente sem precisar derrubar o
 * servidor de verdade — o cron de produção sempre chama com body vazio.
 *
 * Portado de Luka/Luka/supabase/functions/railway-health-check.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let simulateDown = false;
  try {
    const body = await req.json();
    simulateDown = body?.simulateDown === true;
  } catch { /* body vazio (chamada real do cron) */ }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const config = await getEvolutionConfig(supabaseAdmin);
  if (!config) return json({ error: 'EVOLUTION_NOT_CONFIGURED' }, 503);

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

  const { data: stateRow } = await supabaseAdmin
    .from('railway_health_state')
    .select('is_up')
    .eq('id', true)
    .maybeSingle();
  const wasUp = stateRow?.is_up ?? true;

  if (wasUp !== isUp) {
    const settings = await getOpsAlertSettings(supabaseAdmin);
    if (settings?.railway_alert_enabled) {
      const from = { email: settings.from_email ?? undefined, name: settings.from_name } as { email?: string; name?: string };
      if (!isUp) {
        await sendOpsAlert(
          supabaseAdmin,
          settings.email,
          '🔴 MathHeroKids: Evolution API (Railway) não está respondendo',
          `O servidor Evolution API não respondeu ao health check às ${nowUtcLabel()}.\n\n` +
          `URL verificada: ${config.evolution_api_url}\n` +
          `Motivo: ${downReason}\n\n` +
          `Isso é diferente de "WhatsApp desconectado": aqui o servidor inteiro no Railway pode ` +
          `estar fora do ar (crash, deploy quebrado, etc). Verifique o painel do Railway ` +
          `(projecto mathhero-whatsapp).`,
          from.email ? (from as { email: string; name?: string }) : undefined,
        );
      } else {
        await sendOpsAlert(
          supabaseAdmin,
          settings.email,
          '✅ MathHeroKids: Evolution API (Railway) voltou a responder',
          `O servidor Evolution API voltou a responder normalmente às ${nowUtcLabel()}.`,
          from.email ? (from as { email: string; name?: string }) : undefined,
        );
      }
    }
  }

  await supabaseAdmin
    .from('railway_health_state')
    .update({ is_up: isUp, last_checked_at: new Date().toISOString() })
    .eq('id', true);

  return json({ ok: true, isUp, downReason: isUp ? undefined : downReason });
});
