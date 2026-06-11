/**
 * PIN Service — 4-digit parent PIN.
 *
 * Storage: AsyncStorage (primary). Also attempts to sync to parent_profiles.pin
 * in Supabase — if the column doesn't exist (pre-migration), falls back gracefully.
 *
 * "Forgot PIN": sends a Supabase password-reset email for the logged-in user's
 * address. Clicking the link lets them log in again and set a new PIN from
 * edit-profile.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const PIN_KEY = (userId: string) => `parent_pin_${userId}`;

export const pinService = {
  /** Returns the stored PIN for a user, or null if none set. */
  async getPin(userId: string): Promise<string | null> {
    try {
      // 1. Try Supabase first (source of truth when synced)
      const { data } = await supabase
        .from('parent_profiles')
        .select('pin')
        .eq('id', userId)
        .single();

      if (data && typeof (data as { pin?: string | null }).pin === 'string' && (data as { pin?: string | null }).pin) {
        // Cache locally for offline use
        await AsyncStorage.setItem(PIN_KEY(userId), (data as { pin: string }).pin);
        return (data as { pin: string }).pin;
      }
    } catch {
      // Column might not exist yet — fall through to AsyncStorage
    }

    try {
      return await AsyncStorage.getItem(PIN_KEY(userId));
    } catch {
      return null;
    }
  },

  /** Sets the PIN for a user. Persists to AsyncStorage + tries Supabase. */
  async setPin(userId: string, pin: string): Promise<void> {
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN deve ter 4 dígitos.');

    // AsyncStorage — always works
    await AsyncStorage.setItem(PIN_KEY(userId), pin);

    // Supabase sync — best effort (column may not exist in early migrations)
    try {
      await supabase
        .from('parent_profiles')
        .update({ pin } as Record<string, unknown>)
        .eq('id', userId);
    } catch {
      // Ignored — AsyncStorage is the fallback
    }
  },

  /** Clears the PIN (disables PIN lock). */
  async clearPin(userId: string): Promise<void> {
    await AsyncStorage.removeItem(PIN_KEY(userId));
    try {
      await supabase
        .from('parent_profiles')
        .update({ pin: null } as Record<string, unknown>)
        .eq('id', userId);
    } catch {
      // Ignored
    }
  },

  /** Verifies user input against stored PIN. Returns true if match or no PIN set. */
  async verify(userId: string, input: string): Promise<boolean> {
    const stored = await pinService.getPin(userId);
    if (!stored) return true; // No PIN → always allowed
    return stored === input;
  },

  /**
   * "Forgot PIN" — sends a Supabase password-reset email to the logged-in user.
   * They click the link, log back in, and can change the PIN from edit-profile.
   */
  async sendForgotPinEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error('Não foi possível enviar o e-mail. Tente novamente.'); // i18n-ignore
  },
};
