import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

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
  const setActiveChild = useProfileStore((s) => s.setActiveChild);
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();

  // True when the current route is a parent-only screen (no activeChild required)
  const isParentOnlyRoute = PARENT_ONLY_ROUTES.some((r) => segments.includes(r));

  // Configure notification handler once on mount
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // Resincroniza o activeChild persistido localmente com o servidor: apanha alterações
  // feitas noutro dispositivo enquanto este esteve fechado (ex.: pai activou a tabuada
  // semanal premiada no telemóvel dele). A subscrição realtime abaixo cobre o resto —
  // alterações que cheguem enquanto ambas as apps estão abertas.
  useEffect(() => {
    const childId = activeChild?.id;
    if (!childId) return;

    childService.getChild(childId)
      .then((fresh) => {
        if (fresh) setActiveChild(fresh);
      })
      .catch(() => {
        // Sem rede / falha transitória — mantém o que já está persistido localmente
      });
  }, [activeChild?.id, setActiveChild]);

  useEffect(() => {
    const childId = activeChild?.id;
    if (!childId) return;

    const unsubscribe = childService.subscribeToProfileChanges(childId, (fresh) => {
      setActiveChild(fresh);
    });

    return unsubscribe;
  }, [activeChild?.id, setActiveChild]);

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

  // Ranking overtake — deteta em tempo real quando o próprio filho ou um amigo cruza a
  // posição do outro (comparação por par contra o próprio, não o ranking inteiro — XP só
  // cresce, então "ultrapassar" só pode acontecer no lado que acabou de mudar).
  const { data: friendsForRanking = [] } = useQuery({
    queryKey: ['friends', activeChild?.id],
    queryFn: () => socialService.getFriends(activeChild!.id),
    enabled: !!activeChild?.id,
    staleTime: 30_000,
  });
  const friendIdsKey = friendsForRanking.map((f) => f.id).sort().join(',');
  const xpMapRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const childId = activeChild?.id;
    if (!childId) return;

    xpMapRef.current = {
      [childId]: activeChild.xp_total,
      ...Object.fromEntries(friendsForRanking.map((f) => [f.id, f.xp_total])),
    };

    const unsubRanking = socialService.subscribeToRankingChanges(
      [childId, ...friendsForRanking.map((f) => f.id)],
      (row) => {
        const xpMap = xpMapRef.current;
        const prevSelfXp = xpMap[childId];
        const prevRowXp = xpMap[row.id];

        if (prevRowXp === undefined || prevSelfXp === undefined) {
          xpMap[row.id] = row.xp_total;
          return;
        }

        if (row.id === childId) {
          // O próprio filho ganhou XP — verifica se ultrapassou algum amigo.
          friendsForRanking.forEach((friend) => {
            const friendXp = xpMap[friend.id];
            if (friendXp === undefined) return;
            const wasAbove = friendXp > prevSelfXp;
            const isAbove = friendXp > row.xp_total;
            if (wasAbove && !isAbove) {
              playSound('milestone');
              useSocialAlertStore.getState().show({
                id: `rank_over_${friend.id}`,
                kind: 'ranking_overtook',
                avatarDisplayName: friend.display_name,
                avatarId: friend.avatar_id,
                title: t('friends.alert.rankingOvertook', { name: friend.display_name }),
                onPress: () => router.push('/friends/ranking'),
              });
            }
          });
        } else {
          // Um amigo ganhou XP — verifica se ultrapassou o próprio filho.
          const friend = friendsForRanking.find((f) => f.id === row.id);
          if (friend) {
            const wasAbove = prevRowXp > prevSelfXp;
            const isAbove = row.xp_total > prevSelfXp;
            if (!wasAbove && isAbove) {
              playSound('friendRequest');
              useSocialAlertStore.getState().show({
                id: `rank_overtaken_${friend.id}`,
                kind: 'ranking_overtaken',
                avatarDisplayName: friend.display_name,
                avatarId: friend.avatar_id,
                title: t('friends.alert.rankingOvertaken', { name: friend.display_name }),
                onPress: () => router.push('/friends/ranking'),
              });
            }
          }
        }

        xpMap[row.id] = row.xp_total;
      },
    );

    return () => {
      unsubRanking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id, activeChild?.xp_total, friendIdsKey, router, t]);

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
        <Stack.Screen name="tabuada-semanal/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tabuada-semanal/play/[block]" options={{ animation: 'fade', gestureEnabled: false }} />
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
