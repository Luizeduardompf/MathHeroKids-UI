import { supabase } from '@/lib/supabase';
import type { AuthError } from '@/lib/supabase';

// ─── Result type ──────────────────────────────────────────────────────────────

export type ServiceResult<T = undefined> =
  | { data: T; error: null }
  | { data: null; error: string };

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapAuthError(error: AuthError | Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'errors.auth.invalidCredentials';
  }
  if (
    msg.includes('email already') ||
    msg.includes('user already') ||
    msg.includes('already registered')
  ) {
    return 'errors.auth.emailInUse';
  }
  if (msg.includes('weak password') || msg.includes('password should')) {
    return 'errors.auth.weakPassword';
  }
  if (msg.includes('user not found') || msg.includes('email not found')) {
    return 'errors.auth.userNotFound';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'errors.network';
  }
  return 'errors.generic';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Register a new parent account.
   * Name is stored in user_metadata and picked up by the DB trigger
   * that creates the parent_profiles row.
   */
  async signUp(params: {
    name: string;
    email: string;
    password: string;
  }): Promise<ServiceResult> {
    try {
      const { error } = await supabase.auth.signUp({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        options: {
          data: { name: params.name.trim() },
        },
      });
      if (error) return { data: null, error: mapAuthError(error) };
      return { data: undefined, error: null };
    } catch (e) {
      return { data: null, error: mapAuthError(e as Error) };
    }
  },

  /**
   * Sign in an existing parent with email + password.
   */
  async signIn(params: {
    email: string;
    password: string;
  }): Promise<ServiceResult> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: params.email.trim().toLowerCase(),
        password: params.password,
      });
      if (error) return { data: null, error: mapAuthError(error) };
      return { data: undefined, error: null };
    } catch (e) {
      return { data: null, error: mapAuthError(e as Error) };
    }
  },

  /**
   * Sign out the current parent session.
   * profileStore.clearActiveChild() must be called separately (see use-auth.ts).
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /**
   * Send a password reset email to the given address.
   */
  async resetPassword(email: string): Promise<ServiceResult> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
      );
      if (error) return { data: null, error: mapAuthError(error) };
      return { data: undefined, error: null };
    } catch (e) {
      return { data: null, error: mapAuthError(e as Error) };
    }
  },
};
