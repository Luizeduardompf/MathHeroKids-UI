/**
 * Amigos — Tab principal
 *
 * A tela principal é o RANKING de amigos.
 * Header: "Math Hero Kids" + "Amigos" + botão 👥 → lista de amigos
 * Layout pixel-faithful ao design 06-friends.zip (screenshots 1 + 3)
 */

import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { socialService, type RankedFriend } from '@/services/social.service';
import { colors, fontFamily, radius, shadows } from '@/theme';

// ─── Avatar initials (exportado para reutilização) ───────────────────────────

const AVATAR_COLORS = [
  '#2B52E5','#F5722A','#22C55E','#EF4444',
  '#8B5CF6','#EC4899','#F59E0B','#14B8A6',
];

function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] ?? '#2B52E5';
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function FriendAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View style={[av.circle, {
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: colorFromName(name),
    }]}>
      <Text style={[av.text, { fontSize: size * 0.35 }]}>{initials(name)}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text:   { fontFamily: fontFamily.extraBold, color: '#fff' },
});

// ─── Period toggle ────────────────────────────────────────────────────────────

function PeriodToggle({ value, onChange }: {
  value: 'weekly' | 'monthly';
  onChange: (v: 'weekly' | 'monthly') => void;
}) {
  return (
    <View style={pt.wrap}>
      {(['weekly', 'monthly'] as const).map((p) => (
        <Pressable
          key={p}
          style={[pt.btn, value === p ? pt.btnActive : null]}
          onPress={() => onChange(p)}
        >
          <RNText style={[pt.label, value === p ? pt.labelActive : null]}>
            {p === 'weekly' ? 'Semanal' : 'Mensal'}
          </RNText>
        </Pressable>
      ))}
    </View>
  );
}
const pt = StyleSheet.create({
  wrap:       { flexDirection: 'row', backgroundColor: '#DDDFF0', borderRadius: 999, padding: 4 },
  btn:        { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  btnActive:  { backgroundColor: '#fff', ...shadows.sm },
  label:      { fontFamily: fontFamily.bold, fontSize: 15, color: '#6B7280' },
  labelActive:{ fontFamily: fontFamily.bold, fontSize: 15, color: colors.primary },
});

// ─── Podium spot ──────────────────────────────────────────────────────────────

const MEDAL_COLORS: Record<1|2|3, string> = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#CD7C2F' };

function PodiumSpot({ ranked, position }: {
  ranked: RankedFriend | undefined; position: 1|2|3;
}) {
  if (!ranked) return <View style={[pd.spot, pd[`spot${position}`]]} />;

  const SIZE = position === 1 ? 80 : 64;
  const mc   = MEDAL_COLORS[position];

  return (
    <View style={[pd.spot, pd[`spot${position}`]]}>
      {position === 1 && (
        <Ionicons name={'crown' as never} size={24} color="#F59E0B" style={{ marginBottom: 4 }} />
      )}
      <View style={[pd.ring, { width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, borderColor: mc }]}>
        <FriendAvatar name={ranked.child.display_name} size={SIZE} />
      </View>
      <View style={[pd.badge, { backgroundColor: mc }]}>
        <RNText style={pd.badgeNum}>{position}</RNText>
      </View>
      <RNText style={pd.name} numberOfLines={1}>
        {ranked.isSelf ? 'Você' : ranked.child.display_name}
      </RNText>
      <View style={pd.xpRow}>
        <Ionicons name="flash" size={12} color="#F59E0B" />
        <RNText style={pd.xp}>{ranked.xp.toLocaleString('pt-BR')}</RNText>
      </View>
    </View>
  );
}
const pd = StyleSheet.create({
  spot:    { alignItems: 'center', gap: 4, width: 100 },
  spot1:   {},
  spot2:   { marginTop: 40 },
  spot3:   { marginTop: 40 },
  ring:    { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  badge:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: -10, borderWidth: 2, borderColor: '#fff', ...shadows.sm },
  badgeNum:{ fontFamily: fontFamily.extraBold, fontSize: 12, color: '#fff' },
  name:    { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text.primary, textAlign: 'center', maxWidth: 88 },
  xpRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xp:      { fontFamily: fontFamily.bold, fontSize: 12, color: '#F59E0B' },
});

// ─── Rank row ─────────────────────────────────────────────────────────────────

function RankRow({ ranked }: { ranked: RankedFriend }) {
  const hl = ranked.isSelf;
  return (
    <View style={[rr.row, hl ? rr.rowHl : null]}>
      <RNText style={[rr.pos, hl ? rr.posHl : null] as StyleProp<TextStyle>}>#{ranked.position}</RNText>
      <FriendAvatar name={ranked.child.display_name} size={44} />
      <View style={rr.mid}>
        <RNText style={[rr.name, hl ? rr.nameHl : null]}>
          {ranked.isSelf ? 'Você' : ranked.child.display_name}
        </RNText>
        <RNText style={[rr.sub, hl ? rr.subHl : null]}>
          @{ranked.child.username} · Nível {ranked.child.level}
        </RNText>
      </View>
      <View style={rr.xpCol}>
        <Ionicons name="flash" size={13} color={hl ? '#FDE68A' : '#F59E0B'} />
        <RNText style={[rr.xp, hl ? rr.xpHl : null]}>{ranked.xp.toLocaleString('pt-BR')}</RNText>
      </View>
    </View>
  );
}
const rr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm },
  rowHl: { backgroundColor: colors.primary },
  pos:   { fontFamily: fontFamily.bold, fontSize: 14, color: colors.text.secondary, width: 28, textAlign: 'center' },
  posHl: { color: 'rgba(255,255,255,0.7)' },
  mid:   { flex: 1 },
  name:  { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  nameHl:{ color: '#fff' },
  sub:   { fontFamily: fontFamily.regular,   fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  subHl: { color: 'rgba(255,255,255,0.7)' },
  xpCol: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xp:    { fontFamily: fontFamily.bold, fontSize: 13, color: '#F59E0B' },
  xpHl:  { color: '#FDE68A' },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyRanking({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={em.wrap}>
      <Text style={em.emoji}>🏆</Text>
      <Text style={em.title}>Sem ranking ainda</Text>
      <Text style={em.sub}>Adiciona amigos e faz desafios para aparecer no ranking!</Text>
      <Pressable style={em.btn} onPress={onAdd}>
        <Ionicons name="person-add-outline" size={18} color="#fff" />
        <Text style={em.btnText}>Adicionar amigo</Text>
      </Pressable>
    </View>
  );
}
const em = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emoji:  { fontSize: 48 },
  title:  { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  sub:    { fontFamily: fontFamily.regular, fontSize: 14, color: colors.text.secondary, textAlign: 'center', maxWidth: 280 },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  btnText:{ fontFamily: fontFamily.bold, fontSize: 15, color: '#fff' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AmigosScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const child       = useProfileStore(selectActiveChild);

  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');

  // Badge: pedidos pendentes
  const { data: requests = [] } = useQuery({
    queryKey: ['friend_requests', child?.id],
    queryFn:  () => socialService.getPendingRequests(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      if (child?.id) {
        void queryClient.invalidateQueries({ queryKey: ['friends_ranking', child.id] });
        void queryClient.invalidateQueries({ queryKey: ['friend_requests', child.id] });
      }
    }, [queryClient, child?.id]),
  );

  const selfProfile = child ? {
    id: child.id, display_name: child.display_name,
    username: (child as typeof child & { username?: string }).username ?? '',
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

      {/* ── Header — pixel-faithful ao design ─────────────────────── */}
      <LinearGradient
        colors={['#2B52E5', '#1A3DB8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerSub}>Math Hero Kids</Text>
            <Text style={s.headerTitle}>Amigos</Text>
          </View>

          {/* Botão: ir para lista de amigos (com badge de pedidos pendentes) */}
          <Pressable
            style={s.iconBtn}
            onPress={() => router.push('/(app)/friends/list')}
            hitSlop={8}
          >
            <Ionicons name="people-outline" size={22} color="#fff" />
            {requests.length > 0 && (
              <View style={s.notifBadge}>
                <RNText style={s.notifBadgeText}>{requests.length}</RNText>
              </View>
            )}
          </Pressable>
        </View>
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────────────── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Period toggle */}
        <PeriodToggle value={period} onChange={setPeriod} />

        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : ranked.length === 0 ? (
          <EmptyRanking onAdd={() => router.push('/(app)/friends/add')} />
        ) : (
          <>
            {/* Pódio */}
            <View style={s.podium}>
              <PodiumSpot ranked={second} position={2} />
              <PodiumSpot ranked={first}  position={1} />
              <PodiumSpot ranked={third}  position={3} />
            </View>

            {/* Lista restante */}
            {rest.length > 0 && (
              <>
                <View style={s.divider} />
                {rest.map((r) => <RankRow key={r.child.id} ranked={r} />)}
              </>
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },

  // Header — igual ao design: gradient azul, sem border radius no rodapé
  header:    { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerSub: { fontFamily: fontFamily.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  headerTitle:{ fontFamily: fontFamily.extraBold, fontSize: 36, color: '#fff' },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  notifBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#F5722A',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#1A3DB8',
  },
  notifBadgeText: { fontFamily: fontFamily.extraBold, fontSize: 10, color: '#fff' },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },

  podium:  {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    gap: 8, paddingVertical: 24, backgroundColor: '#fff',
    borderRadius: radius['2xl'], ...shadows.md,
  },
  divider: { height: 1, backgroundColor: '#E4E5EF' },
});
