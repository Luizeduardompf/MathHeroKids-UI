import { create } from 'zustand';
import type { RankedFriend } from '@/services/social.service';

/**
 * Última ordem do ranking mostrada ao utilizador, por ecrã (chave `${childId}:${period}`).
 * Só em memória (não persiste) — usada por useRankingReposition para mostrar a ordem antiga
 * antes de animar para a nova sempre que o ranking muda entre visitas.
 */
interface RankingSnapshotState {
  lastShown: Record<string, RankedFriend[]>;
  setLastShown: (key: string, data: RankedFriend[]) => void;
}

export const useRankingSnapshotStore = create<RankingSnapshotState>()((set) => ({
  lastShown: {},

  setLastShown: (key, data) =>
    set((state) => ({ lastShown: { ...state.lastShown, [key]: data } })),
}));
