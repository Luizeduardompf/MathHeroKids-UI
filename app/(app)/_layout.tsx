import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';

import { useAuthStore, selectAuthStatus } from '@/stores/auth.store';
import { useProfileStore, selectHasActiveChild, selectActiveChild } from '@/stores/profile.store';
import { configureNotificationHandler, registerPushToken } from '@/services/notification.service';
import { colors } from '@/theme';

/**
 * Guard: only authenticated users with an active child can access (app) routes.
 * Redirects happen here (not in root layout) to avoid interfering with the
 * registration flow that lives inside (auth).
 */
// Routes inside (app) that are accessible without an active child.
// These are parent-level screens that don't require a selected child profile.
const PARENT_ONLY_ROUTES = ['settings'];

export default function AppLayout() {
  const status = useAuthStore(selectAuthStatus);
  const hasActiveChild = useProfileStore(selectHasActiveChild);
  const activeChild = useProfileStore(selectActiveChild);
  const router = useRouter();
  const segments = useSegments();

  // True when the current route is a parent-only screen (no activeChild required)
  const isParentOnlyRoute = PARENT_ONLY_ROUTES.some((r) => segments.includes(r));

  // Configure notification handler once on mount
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // Register push token when active child is set
  useEffect(() => {
    if (activeChild?.id) {
      void registerPushToken(activeChild.id);
    }
  }, [activeChild?.id]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/(auth)/welcome');
      return;
    }

    if (!hasActiveChild && !isParentOnlyRoute) {
      router.replace('/(profile-select)/');
    }
  }, [status, hasActiveChild, isParentOnlyRoute, router]);

  // Prevent flash of app content while redirecting
  if (status === 'loading' || status === 'unauthenticated' || (!hasActiveChild && !isParentOnlyRoute)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color={colors.text.inverse} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background.primary } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="challenge/[date]" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="trophy-room" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="trophy/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="progression" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rewards" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="friends/ranking" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="friends/add" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="friends/list" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="friends/notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="friends/blocked" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="friends/chat/[friendId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="parent-area" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
