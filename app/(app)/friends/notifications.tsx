/**
 * Notifications screen — in-app notifications for friend requests and acceptances.
 *
 * Shows:
 * - Pending friend requests (with accept/reject inline)
 * - Recently accepted requests (confirmations)
 *
 * Accessible via the notification badge on any screen header.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
// @ts-expect-error RN 0.85 quirk
import { Alert } from 'react-native'; // eslint-disable-line
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { socialService, type AppNotification } from '@/services/social.service';
import { FriendAvatar } from '../(tabs)/friends';
import { colors, fontFamily, radius, shadows } from '@/theme';

// ─── Time ago helper ──────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0)  return `${days}d atrás`;
  if (hours > 0)  return `${hours}h atrás`;
  if (mins  > 1)  return `${mins}min atrás`;
  return 'agora';
}

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onAccept,
  onReject,
  loading,
}: {
  notif:    AppNotification;
  onAccept: () => void;
  onReject: () => void;
  loading:  boolean;
}) {
  const isRequest = notif.type === 'friend_request';
  return (
    <View style={nc.card}>
      <FriendAvatar name={notif.profile.display_name} size={48} />
      <View style={nc.body}>
        <Text style={nc.name}>{notif.profile.display_name}</Text>
        <Text style={nc.sub}>
          {isRequest
            ? `@${notif.profile.username} quer ser teu amigo`
            : `@${notif.profile.username} aceitou o teu pedido ✓`
          }
        </Text>
        <Text style={nc.time}>{timeAgo(notif.at)}</Text>
      </View>
      {isRequest && (
        loading ? (
          <ActivityIndicator color={colors.primary} size="small" style={{ marginLeft: 8 }} />
        ) : (
          <View style={nc.actions}>
            <Pressable style={nc.acceptBtn} onPress={onAccept} hitSlop={6}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </Pressable>
            <Pressable style={nc.rejectBtn} onPress={onReject} hitSlop={6}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </Pressable>
          </View>
        )
      )}
      {!isRequest && (
        <View style={nc.acceptedBadge}>
          <Ionicons name="people" size={16} color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const nc = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm },
  body:        { flex: 1, gap: 2 },
  name:        { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  sub:         { fontFamily: fontFamily.regular, fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
  time:        { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.tertiary },
  actions:     { flexDirection: 'row', gap: 8 },
  acceptBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  rejectBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  acceptedBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyNotifs() {
  const { t } = useTranslation();
  return (
    <View style={en_.wrap}>
      <Ionicons name="notifications-outline" size={52} color="#D1D5DB" />
      <Text style={en_.title}>{t('friends.notifications.empty')}</Text>
      <Text style={en_.sub}>Quando alguém te enviar um pedido de amizade, aparece aqui.</Text>
    </View>
  );
}
const en_ = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: 48, gap: 8 },
  title: { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  sub:   { fontFamily: fontFamily.regular, fontSize: 14, color: colors.text.secondary, textAlign: 'center', maxWidth: 280 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { t }       = useTranslation();
  void t;
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const child       = useProfileStore(selectActiveChild);

  const [respondingId, setRespondingId] = React.useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (child?.id) void queryClient.invalidateQueries({ queryKey: ['notifications', child.id] });
    }, [queryClient, child?.id]),
  );

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', child?.id],
    queryFn:  () => socialService.getNotifications(child!.id),
    enabled:  !!child?.id,
    staleTime: 15_000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      socialService.respondToRequest(requestId, accept),
    onMutate: ({ requestId }) => setRespondingId(requestId),
    onSettled: () => {
      setRespondingId(null);
      void queryClient.invalidateQueries({ queryKey: ['notifications', child?.id] });
      void queryClient.invalidateQueries({ queryKey: ['friends', child?.id] });
      void queryClient.invalidateQueries({ queryKey: ['friend_requests', child?.id] });
      void queryClient.invalidateQueries({ queryKey: ['friends_ranking', child?.id] });
    },
    onError: (e) => Alert.alert('Erro', (e as Error).message),
  });

  if (!child) return null;

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#2B52E5', '#1A3DB8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerSub}>Math Hero Kids</Text>
            <Text style={s.headerTitle}>{t('friends.viewNotifications')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyNotifs />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {notifications.map((notif) => (
            <NotifCard
              key={notif.id}
              notif={notif}
              loading={respondingId === notif.requestId}
              onAccept={() => respondMutation.mutate({ requestId: notif.requestId, accept: true })}
              onReject={() => respondMutation.mutate({ requestId: notif.requestId, accept: false })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background.primary },
  loading:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:      { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerSub:   { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' },
  content:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36, gap: 10 },
});
