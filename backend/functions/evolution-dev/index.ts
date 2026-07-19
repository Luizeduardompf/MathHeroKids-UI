/**
 * evolution-dev — Edge Function (Deno)
 *
 * Proxy seguro para a Evolution API (WhatsApp self-hosted no Railway). O cliente nunca
 * fala directamente com a Evolution API nem vê a api_key — tudo passa por aqui, autenticado
 * com o JWT do pai. Instância única partilhada por toda a app: 'mathhero-main'.
 *
 * Padrão replicado do LukaPsi (Luka/Luka/supabase/functions/evolution-dev), com uma
 * diferença de segurança: get_evolution_config() já nasce restrita a service_role (ver
 * migration 018), não houve fase de leak aqui.
 *
 * Request body:
 * { action?: 'status' | 'resetInstance' }   // default: 'status'
 *
 * Response (status):
 * { state: 'open' | 'connecting' | 'close', qr?: { base64: string, code: string } }
 *
 * Response (resetInstance):
 * { state: 'connecting', qr: { base64: string, code: string } }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getEvolutionConfig, type EvolutionConfig } from '../_shared/whatsapp.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function evoFetch(config: EvolutionConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${config.evolution_api_url}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: config.evolution_api_key, ...(init?.headers ?? {}) },
  });
  return res;
}

async function createAndConnectInstance(config: EvolutionConfig) {
  await evoFetch(config, '/instance/create', {
    method: 'POST',
    body: JSON.stringify({ instanceName: config.evolution_instance_name, integration: 'WHATSAPP-BAILEYS' }),
  });
  const connectRes = await evoFetch(config, `/instance/connect/${config.evolution_instance_name}`);
  const connectData = await connectRes.json();
  return { state: 'connecting' as const, qr: { base64: connectData.base64, code: connectData.code } };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'UNAUTHORIZED' }, 401);

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const config = await getEvolutionConfig(supabaseAdmin);
    if (!config) {
      return json({ error: 'EVOLUTION_NOT_CONFIGURED', message: 'Segredos da Evolution API não encontrados no Vault.' }, 503);
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = (body as { action?: string }).action ?? 'status';

    // ── resetInstance ────────────────────────────────────────────────────
    if (action === 'resetInstance') {
      await evoFetch(config, `/instance/delete/${config.evolution_instance_name}`, { method: 'DELETE' });
      await new Promise((r) => setTimeout(r, 800));
      const result = await createAndConnectInstance(config);
      return json(result);
    }

    // ── status (default) ─────────────────────────────────────────────────
    const stateRes = await evoFetch(config, `/instance/connectionState/${config.evolution_instance_name}`);
    if (!stateRes.ok) {
      // Instância ainda não existe — cria e devolve QR (self-healing).
      const result = await createAndConnectInstance(config);
      return json(result);
    }
    const stateData = await stateRes.json();
    const state = stateData?.instance?.state ?? stateData?.state ?? 'close';

    if (state !== 'open') {
      const connectRes = await evoFetch(config, `/instance/connect/${config.evolution_instance_name}`);
      const connectData = await connectRes.json();
      return json({ state: 'connecting', qr: { base64: connectData.base64, code: connectData.code } });
    }

    return json({ state: 'open' });

  } catch (err) {
    console.error('evolution-dev error:', err);
    return json({ error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
