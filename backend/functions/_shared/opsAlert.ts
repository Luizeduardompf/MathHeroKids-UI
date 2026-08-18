// Alerta por email para a operação do MathHeroKids (não é notificação de pai/criança —
// ver notification_preferences para isso). Reaproveitado por qualquer Edge Function que
// precise avisar sobre falhas de infra (WhatsApp desconectado, Railway fora do ar, envios a
// falhar de verdade). Portado de Luka/Luka/supabase/functions/_shared/opsAlert.ts.
//
// A credencial (icloud_smtp_user/icloud_smtp_password) fica no Vault DESTE projecto
// (get_icloud_smtp_credentials, migration 024) — nunca partilhada com o Vault do Luka, mesmo
// sendo a mesma conta de email por trás. Remetente e destinatário vêm de ops_alert_settings
// (tabela editável em Developer > Alertas de Sistema).

import { sendIcloudMail } from './smtpClient.ts';

const ICLOUD_SMTP_HOST = 'smtp.mail.me.com';
const ICLOUD_SMTP_PORT = 587;

export interface SendOpsAlertResult {
  ok: boolean;
  error?: string;
}

/** Devolve {ok:true} se o email foi aceito pelo relay SMTP; nunca lança — falhas vêm em {ok:false, error}. */
export async function sendOpsAlert(
  supabaseAdmin: { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  to: string,
  subject: string,
  text: string,
  from?: { email: string; name?: string },
): Promise<SendOpsAlertResult> {
  const { data, error } = await supabaseAdmin.rpc('get_icloud_smtp_credentials');
  if (error || !data) {
    console.error('get_icloud_smtp_credentials failed', error);
    return { ok: false, error: `get_icloud_smtp_credentials failed: ${JSON.stringify(error)}` };
  }
  const creds = data as { user: string | null; password: string | null };
  if (!creds.user || !creds.password) {
    console.warn('icloud_smtp_user/icloud_smtp_password not set in vault — skipping ops alert email');
    return { ok: false, error: 'icloud_smtp_user/icloud_smtp_password not set in vault' };
  }

  try {
    await sendIcloudMail({
      host: ICLOUD_SMTP_HOST,
      port: ICLOUD_SMTP_PORT,
      user: creds.user,
      password: creds.password,
      from: from?.email ?? creds.user,
      fromName: from?.name ?? 'MathHeroKids Ops',
      to,
      subject,
      text,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('icloud smtp send failed', message);
    return { ok: false, error: message };
  }
}
