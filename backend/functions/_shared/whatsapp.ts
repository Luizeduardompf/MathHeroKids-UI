// Helpers partilhados por evolution-dev, send-whatsapp-notifications e test-whatsapp-message.
// Import via 'npm:@supabase/supabase-js@2' SupabaseClient — tipagem solta (any) porque o
// projeto ainda não gera tipos supabase para as EFs (só para o client em src/types).
// deno-lint-ignore-file no-explicit-any

export interface EvolutionConfig {
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance_name: string;
}

export async function getEvolutionConfig(supabaseAdmin: any): Promise<EvolutionConfig | null> {
  const { data, error } = await supabaseAdmin.rpc('get_evolution_config');
  if (error || !data) return null;
  const config = data as EvolutionConfig;
  if (!config.evolution_api_url || !config.evolution_api_key) return null;
  if (!config.evolution_instance_name) config.evolution_instance_name = 'mathhero-main';
  return config;
}

/**
 * Constrói o número no formato esperado pela Evolution API (DDI + número, sem '+').
 * Se o telefone já vier com '+', usa-o directamente (nunca faz prepend do DDI de novo —
 * evita duplicação tipo "351351912345678").
 */
export function buildWhatsAppNumber(phone: string, ddi: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\D/g, '');
  const ddiDigits = (ddi || '351').replace(/\D/g, '');
  const phoneDigits = trimmed.replace(/\D/g, '');
  return `${ddiDigits}${phoneDigits}`;
}

export async function sendWhatsAppText(config: EvolutionConfig, number: string, text: string) {
  const res = await fetch(`${config.evolution_api_url}/message/sendText/${config.evolution_instance_name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.evolution_api_key },
    body: JSON.stringify({ number, text, linkPreview: false }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, messageId: data?.key?.id as string | undefined, raw: data };
}

/** Data/hora local num timezone fixo (a app é single-tenant PT por agora — ver roadmap). */
export function getLocalNow(timeZone: string) {
  const now = new Date();
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false });
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });

  const isoDate = dateFmt.format(now); // yyyy-mm-dd
  const hour = parseInt(hourFmt.format(now).replace(/\D/g, ''), 10) % 24;
  const weekdayShort = weekdayFmt.format(now); // 'Sun'..'Sat'
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return { isoDate, hour, weekday: weekdayMap[weekdayShort] ?? 0 };
}

/** true se a coluna `time` (HH:MM:SS) tem a mesma hora que `hour` (cron corre 1x/hora). */
export function timeMatchesHour(timeCol: string | null, hour: number): boolean {
  if (!timeCol) return false;
  const h = parseInt(timeCol.split(':')[0], 10);
  return h === hour;
}
