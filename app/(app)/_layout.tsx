import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuthStore, selectAuthStatus } from '@/stores/auth.store';
import { useProfileStore, selectHasActiveChild, selectActiveChild } from '@/stores/profile.store';
import { useSocialAlertStore } from '@/stores/social-alert.store';
import { configureNotificationHandler, registerPushToken } from '@/services/notification.service';
import { childService } from '@/services/child.service';
import { chatService } from '@/services/chat.service';
import { socialService, type FriendProfile } from '@/services/social.service';
import { queryClient } from '@/lib/query-client';
import { TopAlert } from '@/components/social/TopAlert';
import { colors } from '@/theme';
import { playSound } from '@/services/sound.service';

// Throttle: update last_seen_at at most once per 30 minutes per child
const LAST_SEEN_THROTTLE_MS = 30 * 60 * 1000;
const lastSeenUpdated: Record<string, number> = {};

/**
 * Guard: only authenticated users with an active child can access (app) routes.
 * Redirects happen here (not in root layout) to avoid interfering with the
 * registration flow that lives inside (auth).
 */
// Routes inside (app) that are accessible without an active child.
// These are parent-level screens that don't require a selected child profile.
const PARENT_ONLY_ROUTES = ['settings', 'parent-area'];

export default function AppLayout() {
  const status = useAuthStore(selectAuthStatus);
  const hasActiveChild = useProfileStore(selectHasActiveChild);
  const activeChild = useProfileStore(selectActiveChild);
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();

  // True when the current route is a parent-only screen (no activeChild required)
  const isParentOnlyRoute = PARENT_ONLY_ROUTES.some((r) => segments.includes(r));

  // Configure notification handler once on mount
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // Register push token + update last_seen_at when active child is set
  useEffect(() => {
    if (!activeChild?.id) return;
    void registerPushToken(activeChild.id);
    // Throttled last_seen_at update (max once per 30 min per child)
    const now = Date.now();
    const last = lastSeenUpdated[activeChild.id] ?? 0;
    if (now - last > LAST_SEEN_THROTTLE_MS) {
      lastSeenUpdated[activeChild.id] = now;
      void childService.updateLastSeen(activeChild.id);
    }
  }, [activeChild?.id]);

  // Global "nova mensagem" / "novo pedido de amizade" alert — top toast, any screen.
  useEffect(() => {
    const childId = activeChild?.id;
    if (!childId) return;

    const unsubMessages = chatService.subscribeToUnread(childId, (msg) => {
      void queryClient
        .ensureQueryData<FriendProfile[]>({
          queryKey: ['friends', childId],
          queryFn: () => socialService.getFriends(childId),
          staleTime: 30_000,
        })
        .then((friends) => {
          const sender = friends.find((f) => f.id === msg.from_id);
          const senderName = sender?.display_name ?? t('friends.chat.friendLabel');
          const preview = msg.content.length > 40 ? `${msg.content.slice(0, 40)}…` : msg.content;

          playSound('messageReceived');

          useSocialAlertStore.getState().show({
            id: `msg_${msg.from_id}`,
            kind: 'message',
            avatarDisplayName: senderName,
            avatarId: sender?.avatar_id,
            title: t('friends.alert.newMessage', { name: senderName }),
            subtitle: preview,
            onPress: () =>
              router.push({ pathname: '/friends/chat/[friendId]', params: { friendId: msg.from_id } }),
          });
        })
        .catch(() => {});

      void queryClient.invalidateQueries({ queryKey: ['unread', childId] });
      void queryClient.invalidateQueries({ queryKey: ['unread_by_friend', childId] });
    });

    const unsubRequests = socialService.subscribeToFriendRequests(childId, (row) => {
      playSound('friendRequest');

      socialService.getPendingRequests(childId)
        .then((pending) => {
          const match = pending.find((r) => r.id === row.id);
          const senderName = match?.from_child.display_name ?? t('friends.chat.friendLabel');

          useSocialAlertStore.getState().show({
            id: `req_${row.id}`,
            kind: 'friend_request',
            avatarDisplayName: senderName,
            avatarId: match?.from_child.avatar_id,
            title: t('friends.alert.newFriendRequest', { name: senderName }),
            onPress: () => router.push('/friends/notifications'),
          });
        })
        .catch(() => {});

      void queryClient.invalidateQueries({ queryKey: ['friend_requests', childId] });
    });

    return () => {
      unsubMessages();
      unsubRequests();
    };
  }, [activeChild?.id, router, t]);

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
    <View style={{ flex: 1 }}>
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
      <TopAlert />
    </View>
  );
}
