/**
 * Friends Ranking screen
 *
 * Layout (pixel-faithful ao design 06-friends.zip screenshot 3):
 * - Header azul gradient: ← back + {t('friends.ranking.title')}
 * - Toggle: Semanal | Mensal
 * - Pódio: 2º (esquerda, menor) | 1º (centro, crown, maior) | 3º (direita)
 * - Lista abaixo: posição + avatar + nome + XP
 * - "Você" highlight em azul
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { socialService, type RankedFriend } from '@/services/social.service';
import { colors, fontFamily, radius, shadows } from '@/theme';
import { FriendAvatar } from './../../(app)/(tabs)/friends';

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumSpot({
  ranked, position,
}: {
  ranked:   RankedFriend | undefined;
  position: 1 | 2 | 3;
}) {
  const { t } = useTranslation();
  if (!ranked) return <View style={[pd.spot, pd[`spot${position}`]]} />;

  const SIZE  = position === 1 ? 80 : 64;
  const isTop = position === 1;

  const medalColors: Record<1|2|3, string> = {
    1: '#F59E0B',
    2: '#9CA3AF',
    3: '#CD7C2F',
  };

  return (
    <View style={[pd.spot, pd[`spot${position}`]]}>
      {isTop && (
        <View style={pd.crownWrap}>
          <Ionicons name={'crown' as never} size={22} color="#F59E0B" />
        </View>
      )}
      <View style={[
        pd.avatarRing,
        { width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2 },
        { borderColor: isTop ? '#F59E0B' : medalColors[position] },
      ]}>
        <FriendAvatar name={ranked.child.display_name} avatarId={ranked.child.avatar_id} size={SIZE} />
      </View>
      <View style={[pd.posBadge, { backgroundColor: medalColors[position] }]}>
        <Text style={pd.posNum}>{position}</Text>
      </View>
      <Text style={pd.podName} numberOfLines={1}>{ranked.isSelf ? t('common.self') : ranked.child.display_name}</Text>
      <View style={pd.xpRow}>
        <Ionicons name="flash" size={12} color="#F59E0B" />
        <Text style={pd.xpText}>{ranked.xp.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const pd = StyleSheet.create({
  spot:  { alignItems: 'center', gap: 4, width: 96 },
  spot1: { marginBottom: 0 },
  spot2: { marginTop: 32 },
  spot3: { marginTop: 32 },
  crownWrap: { marginBottom: 4 },
  avatarRing: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderRadius: 44,
  },
  posBadge: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -10,
    borderWidth: 2, borderColor: '#fff',
    ...shadows.sm,
  },
  posNum:  { fontFamily: fontFamily.extraBold, fontSize: 12, color: '#fff' },
  podName: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text.primary, textAlign: 'center', maxWidth: 80 },
  xpRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xpText:  { fontFamily: fontFamily.bold, fontSize: 12, color: '#F59E0B' },
});

// ─── Ranking row ──────────────────────────────────────────────────────────────

function RankRow({ ranked }: { ranked: RankedFriend }) {
  const { t } = useTranslation();
  const highlight = ranked.isSelf;

  return (
    <View style={[rr.row, highlight ? rr.rowHighlight : null]}>
      <RNText style={[rr.pos, highlight ? rr.posHighlight : null]}>#{ranked.position}</RNText>
      <FriendAvatar name={ranked.child.display_name} avatarId={ranked.child.avatar_id} size={44} />
      <View style={rr.mid}>
        <RNText style={[rr.name, highlight ? rr.nameHighlight : null]}>
          {ranked.isSelf ? t('common.self') : ranked.child.display_name}
        </RNText>
        <RNText style={[rr.sub, highlight ? rr.subHighlight : null]}>
          @{ranked.child.username} · {t('common.level', { level: ranked.child.level })}
        </RNText>
      </View>
      <View style={rr.xpCol}>
        <Ionicons name="flash" size={13} color={highlight ? '#fff' : '#F59E0B'} />
        <RNText style={[rr.xp, highlight ? rr.xpHighlight : null]}>{ranked.xp.toLocaleString()}</RNText>
      </View>
    </View>
  );
}

const rr = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm },
  rowHighlight:  { backgroundColor: colors.primary },
  pos:           { fontFamily: fontFamily.bold, fontSize: 14, color: colors.text.secondary, width: 28, textAlign: 'center' },
  posHighlight:  { color: 'rgba(255,255,255,0.8)' },
  mid:           { flex: 1 },
  name:          { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  nameHighlight: { color: '#fff' },
  sub:           { fontFamily: fontFamily.regular,   fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  subHighlight:  { color: 'rgba(255,255,255,0.75)' },
  xpCol:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xp:            { fontFamily: fontFamily.bold, fontSize: 13, color: '#F59E0B' },
  xpHighlight:   { color: '#FDE68A' },
});

// ─── Period toggle ────────────────────────────────────────────────────────────

function PeriodToggle({
  value, onChange,
}: {
  value: 'weekly' | 'monthly';
  onChange: (v: 'weekly' | 'monthly') => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={pt.wrap}>
      {(['weekly', 'monthly'] as const).map((p) => (
        <Pressable
          key={p}
          style={[pt.btn, value === p && pt.btnActive]}
          onPress={() => onChange(p)}
        >
          <RNText style={[pt.label, value === p ? pt.labelActive : null]}>
            {p === 'weekly' ? t('friends.ranking.weekly') : t('friends.ranking.monthly')}
          </RNText>
        </Pressable>
      ))}
    </View>
  );
}

const pt = StyleSheet.create({
  wrap:       { flexDirection: 'row', backgroundColor: '#E4E5EF', borderRadius: 999, padding: 4 },
  btn:        { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  btnActive:  { backgroundColor: '#fff', ...shadows.sm },
  label:      { fontFamily: fontFamily.bold, fontSize: 15, color: '#6B7280' },
  labelActive:{ fontFamily: fontFamily.bold, fontSize: 15, color: colors.primary },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyRanking() {
  const { t } = useTranslation();
  return (
    <View style={emp.wrap}>
      <Text style={emp.emoji}>🏆</Text>
      <Text style={emp.title}>{t('friends.ranking.empty')}</Text>
      <Text style={emp.sub}>{t('friends.ranking.emptyDesc')}</Text>
    </View>
  );
}
const emp = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emoji: { fontSize: 48 },
  title: { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  sub:   { fontFamily: fontFamily.regular, fontSize: 14, color: colors.text.secondary, textAlign: 'center', maxWidth: 260 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RankingScreen() {
  const { t } = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const child   = useProfileStore(selectActiveChild);

  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');

  const selfProfile = child ? {
    id: child.id, display_name: child.display_name, username: child.username ?? '',
    avatar_id: child.avatar_id, level: child.level,
    xp_total: child.xp_total, current_streak: child.current_streak,
  } : null;

  const { data: ranked = [], isLoading } = useQuery({
    queryKey: ['friends_ranking', child?.id, period],
    queryFn:  () => socialService.getFriendsRanking(child!.id, selfProfile!, period),
    enabled:  !!child?.id && !!selfProfile,
    staleTime: 60_000,
  });

  if (!child) return null;

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const first  = top3.find((r) => r.position === 1);
  const second = top3.find((r) => r.position === 2);
  const third  = top3.find((r) => r.position === 3);

  return (
    <View style={s.root}>
      {/* ── Header ─────────────────────────────────────────────────── */}
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
            <Text style={s.headerTitle}>{t('friends.ranking.title')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────────────── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Period toggle */}
        <PeriodToggle value={period} onChange={setPeriod} />

        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : ranked.length === 0 ? (
          <EmptyRanking />
        ) : (
          <>
            {/* Podium */}
            <View style={s.podium}>
              <PodiumSpot ranked={second} position={2} />
              <PodiumSpot ranked={first}  position={1} />
              <PodiumSpot ranked={third}  position={3} />
            </View>

            {/* Divider */}
            {rest.length > 0 && <View style={s.divider} />}

            {/* Remaining list */}
            {rest.map((r) => <RankRow key={r.child.id} ranked={r} />)}
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },

  header:     { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerSub:   { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },

  podium: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    gap: 8, paddingVertical: 16, backgroundColor: '#fff',
    borderRadius: radius['2xl'], ...shadows.md,
  },
  divider: { height: 1, backgroundColor: '#E4E5EF', marginVertical: 4 },
});
