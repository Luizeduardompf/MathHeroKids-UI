import { supabase } from '@/lib/supabase';
import type { AvatarId } from '@/constants/config';

export interface AdminChildSummary {
  id: string;
  display_name: string;
  username: string;
  avatar_id: AvatarId;
  xp_total: number;
  level: number;
}

export interface AdminParentGroup {
  parent_id: string;
  parent_name: string;
  children: AdminChildSummary[];
}

async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      const body = await ctx.clone().json() as { message?: string };
      if (body.message) return body.message;
    }
  } catch { /* usar mensagem default */ }
  return fallback;
}

export const adminService = {
  /**
   * Lista todos os pares pai-criança do sistema (todas as contas) — tela Developers >
   * Resetar progresso. Ver backend/functions/list_all_children.
   */
  async listAllChildren(): Promise<AdminParentGroup[]> {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; parents?: AdminParentGroup[] }>(
      'list_all_children',
    );

    if (error) {
      throw new Error(await extractFunctionError(error, 'Não foi possível carregar a lista.')); // i18n-ignore — traduzido na UI layer
    }
    return data?.parents ?? [];
  },

  /**
   * Apaga todo o progresso de jogo (XP, desafios, troféus, mastery, Tabuada Semanal, etc.)
   * de uma criança — irreversível. Ver backend/functions/reset_child_progress.
   */
  async resetChildProgress(childId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('reset_child_progress', {
      body: { child_id: childId },
    });

    if (error) {
      throw new Error(await extractFunctionError(error, 'Não foi possível resetar o progresso.')); // i18n-ignore — traduzido na UI layer
    }
  },
};
