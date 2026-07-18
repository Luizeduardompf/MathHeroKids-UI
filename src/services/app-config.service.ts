import { supabase } from '@/lib/supabase';

export interface AppConfigValues {
  retest_correct_threshold: number;
  retest_percentage: number;
}

const DEFAULTS: AppConfigValues = {
  retest_correct_threshold: 5,
  retest_percentage: 0.25,
};

export const appConfigService = {
  /** Settings globais editáveis na tela Developers — leitura directa (RLS permite a qualquer autenticado). */
  async getAppConfig(): Promise<AppConfigValues> {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['retest_correct_threshold', 'retest_percentage']);

    if (error) throw new Error(error.message);

    const values: AppConfigValues = { ...DEFAULTS };
    (data ?? []).forEach((row: { key: string; value: unknown }) => {
      if (row.key === 'retest_correct_threshold' || row.key === 'retest_percentage') {
        values[row.key] = Number(row.value);
      }
    });
    return values;
  },

  /** Único caminho de escrita — via Edge Function update_app_config (RLS bloqueia escrita directa). */
  async updateAppConfig(key: keyof AppConfigValues, value: number): Promise<void> {
    const { error } = await supabase.functions.invoke('update_app_config', {
      body: { key, value },
    });

    if (!error) return;

    let message = 'Não foi possível guardar. Tenta novamente.'; // i18n-ignore — traduzido na UI layer
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.clone().json() as { error?: string; message?: string };
        if (body.error === 'INVALID_VALUE') message = 'Valor fora do intervalo permitido.';
        else if (body.message) message = body.message;
      }
    } catch { /* usar mensagem default */ }

    throw new Error(message);
  },
};
