/**
 * notification.service.ts
 *
 * Expo Push Notifications — registration + token storage.
 *
 * Architecture:
 *  - Registers the device with Expo's push service on first launch
 *  - Stores the token in Supabase (child_profiles.expo_push_token)
 *  - Server (Edge Functions) uses the token to send pushes via Expo Push API
 *
 * NOTE: expo-notifications is a native module — only works in EAS builds and
 * development builds (npx expo run:ios / run:android). In Expo Go, push token
 * registration is silently skipped. Local notifications DO work in Expo Go.
 *
 * Setup (run once from Mac Terminal):
 *   npm install expo-notifications expo-device
 *   npx eas build:configure
 *
 * iOS: requires EAS build + Apple Developer account for APNs.
 * Android: works with EAS build using Expo's FCM project.
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// ─── Dynamic import guard ─────────────────────────────────────────────────────
// expo-notifications is a native module. Not installed until EAS build setup.
// All code gracefully degrades if the module is missing.
// Run: npm install expo-notifications expo-device  (from Mac Terminal, not sandbox)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Device: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Device = require('expo-device');
} catch {
  // Module not installed — push notifications disabled in this build
}

// ─── Notification handler (foreground) ───────────────────────────────────────

/**
 * Call once at app startup (e.g., in root _layout.tsx).
 * Sets how foreground notifications are displayed.
 */
export function configureNotificationHandler() {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Token registration ───────────────────────────────────────────────────────

/**
 * Requests notification permissions and registers the Expo push token.
 * Saves the token to Supabase (child_profiles.expo_push_token).
 *
 * @param childId - The active child's UUID
 * @returns The Expo push token, or null if unavailable/denied
 */
export async function registerPushToken(childId: string): Promise<string | null> {
  if (!Notifications || !Device) {
    console.log('[notifications] expo-notifications not available — skipping token registration');
    return null;
  }

  // Physical device required for real push tokens
  if (!Device.isDevice) {
    console.log('[notifications] Push tokens only available on physical devices');
    return null;
  }

  try {
    // Check / request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] Permission denied');
      return null;
    }

    // Android: notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Math Hero Kids',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2B52E5',
        sound: 'default',
      });
    }

    // Get Expo push token (projectId from app.json / eas.json)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });
    const token = tokenData.data;

    // Save token to Supabase
    await supabase
      .from('child_profiles')
      .update({ expo_push_token: token })
      .eq('id', childId);

    console.log('[notifications] Token registered:', token);
    return token;
  } catch (err) {
    console.error('[notifications] registerPushToken error:', err);
    return null;
  }
}

/**
 * Removes the push token from Supabase when the child logs out or switches profile.
 * Prevents stale tokens from sending pushes to the wrong child session.
 */
export async function unregisterPushToken(childId: string): Promise<void> {
  try {
    await supabase
      .from('child_profiles')
      .update({ expo_push_token: null })
      .eq('id', childId);
  } catch (err) {
    console.error('[notifications] unregisterPushToken error:', err);
  }
}

// ─── Local notifications (work in Expo Go + simulator) ───────────────────────

/**
 * Schedules a local notification (no server needed).
 * Useful for daily challenge reminders.
 */
export async function scheduleLocalReminder(
  title: string,
  body: string,
  hour: number,
  minute: number,
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    // Cancel existing reminders first (avoid duplicates)
    await cancelDailyReminder();

    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch (err) {
    console.error('[notifications] scheduleLocalReminder error:', err);
    return null;
  }
}

const DAILY_REMINDER_ID_KEY = 'daily_reminder_id';

export async function cancelDailyReminder(): Promise<void> {
  if (!Notifications) return;
  try {
    // Cancel all scheduled notifications (simpler than tracking IDs)
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch { /* best effort */ }
}

/**
 * Clears the app badge count.
 */
export async function clearBadge(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch { /* best effort */ }
}

// ─── Notification tap handler ─────────────────────────────────────────────────

export type NotificationData =
  | { type: 'friend_request'; requestId: string; fromChildId: string }
  | { type: 'request_accepted'; requestId: string; friendId: string }
  | { type: 'new_message'; fromChildId: string; conversationId: string };

/**
 * Returns the data payload from a notification response.
 * Use in the notification tap listener (root _layout.tsx).
 * response type is `any` because expo-notifications may not be installed yet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNotificationData(response: any): NotificationData | null {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined;
  if (!data?.type) return null;
  return data as NotificationData;
}
