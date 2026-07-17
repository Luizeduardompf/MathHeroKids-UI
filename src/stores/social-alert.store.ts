import { create } from 'zustand';
import type { AvatarId } from '@/constants/config';

export type SocialAlertKind = 'message' | 'friend_request' | 'ranking_overtaken' | 'ranking_overtook';

export interface SocialAlertItem {
  /** Dedupe key — e.g. `msg_${fromId}` or `req_${requestId}`. */
  id: string;
  kind: SocialAlertKind;
  /** Sender name — used for the Avatar's initials fallback. */
  avatarDisplayName: string;
  avatarId?: AvatarId;
  /** e.g. "Nova mensagem de Marta" or "Marta quer ser teu amigo!" */
  title: string;
  /** e.g. message preview — omitted for friend requests. */
  subtitle?: string;
  onPress: () => void;
}

interface SocialAlertState {
  current: SocialAlertItem | null;
  queue: SocialAlertItem[];

  show: (item: SocialAlertItem) => void;
  dismiss: () => void;
}

export const useSocialAlertStore = create<SocialAlertState>()((set, get) => ({
  current: null,
  queue: [],

  show: (item) => {
    const { current, queue } = get();

    // Same sender already showing/queued for the same kind — replace instead of stacking.
    if (current?.id === item.id) {
      set({ current: item });
      return;
    }
    if (queue.some((q) => q.id === item.id)) {
      set({ queue: queue.map((q) => (q.id === item.id ? item : q)) });
      return;
    }

    if (!current) {
      set({ current: item });
    } else {
      set({ queue: [...queue, item] });
    }
  },

  dismiss: () => {
    const { queue } = get();
    const [next, ...rest] = queue;
    set({ current: next ?? null, queue: rest });
  },
}));
