import { create } from 'zustand';
import type { Session, User } from '@/lib/supabase';
import type { ParentProfile } from '@/types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  parentProfile: ParentProfile | null;

  // Actions
  setSession: (session: Session | null) => void;
  setParentProfile: (profile: ParentProfile | null) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  session: null,
  user: null,
  parentProfile: null,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    }),

  setParentProfile: (parentProfile) => set({ parentProfile }),

  signOut: () =>
    set({
      status: 'unauthenticated',
      session: null,
      user: null,
      parentProfile: null,
    }),
}));

// Selectors — prefer these over destructuring in components
export const selectAuthStatus = (s: AuthState) => s.status;
export const selectIsAuthenticated = (s: AuthState) => s.status === 'authenticated';
export const selectParentId = (s: AuthState) => s.user?.id ?? null;
