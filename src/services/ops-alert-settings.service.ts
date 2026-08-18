import { supabase } from '@/lib/supabase';

export interface OpsAlertSettingsValues {
  email: string;
  from_email: string | null;
  from_name: string;
  whatsapp_alert_enabled: boolean;
  railway_alert_enabled: boolean;
  send_failure_alert_enabled: boolean;
  webhook_alert_enabled: boolean;
}

export type OpsAlertSettingsUpdate = Partial<OpsAlertSettingsValues>;

export const opsAlertSettingsService = {
  /** Leitura directa (RLS permite a qualquer autenticado) — tela Developer > Alertas de Sistema. */
  async getOpsAlertSettings(): Promise<OpsAlertSettingsValues> {
    const { data, error } = await supabase
      .from('ops_alert_settings')
      .select('email, from_email, from_name, whatsapp_alert_enabled, railway_alert_enabled, send_failure_alert_enabled, webhook_alert_enabled')
      .eq('id', true)
      .single();

    if (error) throw new Error(error.message);
    return data as OpsAlertSettingsValues;
  },

  /** Único caminho de escrita — via Edge Function update_ops_alert_settings (RLS bloqueia escrita directa). */
  async updateOpsAlertSettings(update: OpsAlertSettingsUpdate): Promise<void> {
    const { error } = await supabase.functions.invoke('update_ops_alert_settings', {
      body: update,
    });

    if (!error) return;

    let message = 'Não foi possível guardar. Tenta novamente.'; // i18n-ignore — traduzido na UI layer
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.clone().json() as { error?: string; message?: string };
        if (body.error === 'INVALID_EMAIL' || body.error === 'INVALID_FROM_EMAIL') message = 'Email inválido.';
        else if (body.message) message = body.message;
      }
    } catch { /* usar mensagem default */ }

    throw new Error(message);
  },
};
