// Lê ops_alert_settings (tabela singleton, editável em Developer > Alertas de Sistema) —
// email de destino, remetente (from_email/from_name) e quais das 3 camadas de alerta estão
// ligadas. Portado de Luka/Luka/supabase/functions/_shared/opsAlertSettings.ts.

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface OpsAlertSettings {
  email: string;
  from_email: string | null;
  from_name: string;
  whatsapp_alert_enabled: boolean;
  railway_alert_enabled: boolean;
  send_failure_alert_enabled: boolean;
}

export async function getOpsAlertSettings(supabaseAdmin: SupabaseLike): Promise<OpsAlertSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('ops_alert_settings')
    .select('email, from_email, from_name, whatsapp_alert_enabled, railway_alert_enabled, send_failure_alert_enabled')
    .eq('id', true)
    .maybeSingle();
  if (error) {
    console.error('get ops_alert_settings failed', error);
    return null;
  }
  return data as OpsAlertSettings | null;
}
