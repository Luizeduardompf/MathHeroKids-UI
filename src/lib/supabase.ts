import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from '@/constants/env';

/**
 * Supabase client — singleton, safe to import anywhere.
 *
 * Auth sessions are persisted to AsyncStorage so they survive app restarts.
 * The storage key uses a stable namespace to avoid collisions.
 */
export const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Re-export common types from supabase-js for convenience
export type { Session, User, AuthError } from '@supabase/supabase-js';
