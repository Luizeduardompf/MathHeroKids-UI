import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';

/**
 * Initializes the Supabase auth listener on mount and keeps the store in sync.
 * Call this once in the root layout. Children read from useAuthStore directly.
 *
 * On sign-out, also clears the active child from profileStore so the persisted
 * selection is wiped for the next user who logs in on this device.
 */
export function useAuthListener(): void {
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    // Hydrate initial session from AsyncStorage
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        // Clear child selection on sign-out
        useProfileStore.getState().clearActiveChild();
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [setSession]);
}
