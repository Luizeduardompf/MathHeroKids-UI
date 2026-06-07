import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChildProfile } from '@/types';

interface ProfileState {
  activeChild: ChildProfile | null;

  // Actions
  setActiveChild: (child: ChildProfile) => void;
  clearActiveChild: () => void;
  /** Optimistic update — called after challenge completion before server confirms */
  updateChildXp: (xpTotal: number, level: number) => void;
  /** Optimistic update — called after streak change */
  updateChildStreak: (currentStreak: number, bestStreak: number) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      activeChild: null,

      setActiveChild: (child) => set({ activeChild: child }),

      clearActiveChild: () => set({ activeChild: null }),

      updateChildXp: (xpTotal, level) =>
        set((state) =>
          state.activeChild
            ? { activeChild: { ...state.activeChild, xp_total: xpTotal, level } }
            : {},
        ),

      updateChildStreak: (currentStreak, bestStreak) =>
        set((state) =>
          state.activeChild
            ? {
                activeChild: {
                  ...state.activeChild,
                  current_streak: currentStreak,
                  best_streak: bestStreak,
                },
              }
            : {},
        ),
    }),
    {
      name: 'math-hero-profile-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// Selectors — prefer these over destructuring in components
export const selectActiveChild = (s: ProfileState) => s.activeChild;
export const selectActiveChildId = (s: ProfileState) => s.activeChild?.id ?? null;
export const selectHasActiveChild = (s: ProfileState) => s.activeChild !== null;
