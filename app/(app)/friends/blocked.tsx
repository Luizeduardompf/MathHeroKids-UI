/**
 * Blocked Friends screen.
 *
 * Shows all blocked users with option to unblock.
 * Block list is stored in AsyncStorage for MVP.
 * (Phase 5+ migration: move to Supabase blocked_users table)
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { socialService, type FriendProfile } from '@/services/social.service';
import { FriendAvatar } from '../(tabs)/friends';
import { colors, fontFamily, radius, shadows } from '@/theme';

// ─── Blocked row ──────────────────────────────────────────────────────────────

function BlockedRow({ profile, onUnblock }: { profile: FriendProfile; onUnblock: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={row.card}>
      <FriendAvatar name={profile.display_name} size={44} />
      <View style={row.mid}>
        <Text style={row.name}>{profile.display_name}</Text>
        <Text style={row.sub}>@{profile.username}</Text>
      </View>
      <Pressable style={row.unblockBtn} onPress={onUnblock} hitSlop={8}>
        <Text style={row.unblockText}>{t('friends.unblock')}</Text>
      </Pressable>
    </View>
  );
}
const row = StyleSheet.create({
  card:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm },
  mid:          { flex: 1 },
  name:         { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  sub:          { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  unblockBtn:   { backgroundColor: colors.primaryLight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  unblockText:  { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primary },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BlockedFriendsScreen() {
  const { t }   = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const child   = useProfileStore(selectActiveChild);

  const [blocked,  setBlocked]  = useState<FriendProfile[]>([]);
  const [loading,  setLoading]  = useState(true);

  async function load() {
    if (!child) return;
    setLoading(true);
    const profiles = await socialService.getBlockedProfiles(child.id);
    setBlocked(profiles);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { void load(); }, [child?.id])); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUnblock(targetId: string) {
    if (!child) return;
    await socialService.unblockUser(child.id, targetId);
    setBlocked((prev) => prev.filter((p) => p.id !== targetId));
  }

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
            <Text style={s.headerTitle}>{t('friends.blockedUsers')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : blocked.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="shield-checkmark-outline" size={52} color="#D1D5DB" />
          <Text style={s.emptyTitle}>{t('friends.noBlockedUsers')}</Text>
          <Text style={s.emptySub}>{t('friends.noBlockedDesc')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {blocked.map((p) => (
            <BlockedRow key={p.id} profile={p} onUnblock={() => void handleUnblock(p.id)} />
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
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle:  { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  emptySub:    { fontFamily: fontFamily.regular, fontSize: 14, color: colors.text.secondary, textAlign: 'center' },
});
