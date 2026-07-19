import { supabase } from '@/lib/supabase';

export interface EvolutionStatus {
  state: 'open' | 'connecting' | 'close';
  qr?: { base64: string; code: string };
  error?: string;
  message?: string;
}

async function invoke(action?: 'resetInstance'): Promise<EvolutionStatus> {
  const { data, error } = await supabase.functions.invoke('evolution-dev', {
    body: action ? { action } : {},
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const body = await ctx.clone().json() as EvolutionStatus;
        return body;
      } catch { /* fall through */ }
    }
    return { state: 'close', error: 'REQUEST_FAILED' };
  }
  return data as EvolutionStatus;
}

export const evolutionService = {
  /** Estado actual da instância — cria/gera QR automaticamente se necessário (self-healing). */
  getStatus: () => invoke(),

  /** Apaga e recria a instância — novo QR. */
  resetInstance: () => invoke('resetInstance'),

  /** Envio de teste (ecrã Developer). `number` deve incluir DDI, só dígitos. */
  async sendTestMessage(number: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('test-whatsapp-message', {
      body: { number, text },
    });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        try { return await ctx.clone().json(); } catch { /* fall through */ }
      }
      return { ok: false, error: 'REQUEST_FAILED' };
    }
    return data;
  },
};
