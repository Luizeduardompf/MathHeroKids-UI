/**
 * Amigos — Tab principal
 *
 * Top-level toggle: Amigos (default) | Ranking
 *
 * Amigos panel:
 *   - Search bar (inline no conteúdo)
 *   - Pedidos pendentes (accept/reject)
 *   - Lista de amigos com chat + block
 *
 * Ranking panel:
 *   - Sub-toggle: Semanal | Mensal | Global
 *   - Pódio + lista
 *
 * Header: ícone de notificações + ícone person-add → friends/add (buscar/sugestões)
 */

import React, { useCallback, useState } from 'react';
// @ts-expect-error RN strict typing quirk
import { Alert } from 'react-native'; // eslint-disable-line
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { socialService, type RankedFriend, type FriendProfile, type PendingRequest } from '@/services/social.service';
import { chatService } from '@/services/chat.service';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import type { AvatarId } from '@/constants/config';

// ─── Top-level section type ───────────────────────────────────────────────────

type Section = 'friends' | 'ranking';

// ─── Avatar images (static require map — Metro exige paths estáticos) ─────────

const AVATAR_IMAGES: Record<string, number> = {
  sofia: require('../../../assets/images/avatars/avatar-sofia.png'),
  lucas: require('../../../assets/images/avatars/avatar-lucas.png'),
  luna:  require('../../../assets/images/avatars/avatar-luna.png'),
  mia:   require('../../../assets/images/avatars/avatar-mia.png'),
  pedro: require('../../../assets/images/avatars/avatar-pedro.png'),
  theo:  require('../../../assets/images/avatars/avatar-theo.png'),
};

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

export function FriendAvatar({ name, avatarId, size = 44 }: { name: string; avatarId?: AvatarId; size?: number }) {
  const src = avatarId ? AVATAR_IMAGES[avatarId] : null;
  if (src) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#F3F4F6', flexShrink: 0 }}>
        <Image source={src} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={[av.circle, {
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: colorFromName(name),
    }]}>
      <RNText style={[av.text, { fontSize: Math.round(size * 0.33) }]}>
        {initials(name)}
      </RNText>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text:   { fontFamily: fontFamily.extraBold, color: '#fff', includeFontPadding: false },
});

// ─── Top-level section toggle (Amigos | Ranking) ─────────────────────────────

function SectionToggle({ value, onChange }: {
  value: Section;
  onChange: (v: Section) => void;
}) {
  const { t } = useTranslation();
  const labels: Record<Section, string> = {
    friends: t('friends.sectionFriends'),
    ranking: t('friends.sectionRanking'),
  };
  return (
    <View style={st.wrap}>
      {(['friends', 'ranking'] as const).map((sec) => (
        <Pressable
          key={sec}
          style={[st.btn, value === sec ? st.btnActive : null]}
          onPress={() => onChange(sec)}
        >
          <RNText style={[st.label, value === sec ? st.labelActive : null]}>
            {labels[sec]}
          </RNText>
        </Pressable>
      ))}
    </View>
  );
}
const st = StyleSheet.create({
  wrap:        { flexDirection: 'row', backgroundColor: '#DDDFF0', borderRadius: 999, padding: 4 },
  btn:         { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  btnActive:   { backgroundColor: '#fff', ...shadows.sm },
  label:       { fontFamily: fontFamily.bold, fontSize: 15, color: '#6B7280' },
  labelActive: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.primary },
});

// ─── Period toggle (Semanal | Mensal | Global) ────────────────────────────────

export type RankingPeriod = 'weekly' | 'monthly' | 'global';

function PeriodToggle({ value, onChange }: {
  value: RankingPeriod;
  onChange: (v: RankingPeriod) => void;
}) {
  const { t } = useTranslation();
  const PERIOD_LABELS: Record<RankingPeriod, string> = {
    weekly:  t('friends.ranking.weekly'),
    monthly: t('friends.ranking.monthly'),
    global:  t('friends.ranking.global'),
  };
  return (
    <View style={pt.wrap}>
      {(['weekly', 'monthly', 'global'] as const).map((p) => (
        <Pressable
          key={p}
          style={[pt.btn, value === p ? pt.btnActive : null]}
          onPress={() => onChange(p)}
        >
          <RNText style={[pt.label, value === p ? pt.labelActive : null]}>
            {PERIOD_LABELS[p]}
          </RNText>
        </Pressable>
      ))}
    </View>
  );
}
const pt = StyleSheet.create({
  wrap:        { flexDirection: 'row', backgroundColor: '#DDDFF0', borderRadius: 999, padding: 4 },
  btn:         { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  btnActive:   { backgroundColor: '#fff', ...shadows.sm },
  label:       { fontFamily: fontFamily.bold, fontSize: 15, color: '#6B7280' },
  labelActive: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.primary },
});

// ─── Podium spot ──────────────────────────────────────────────────────────────

const MEDAL_COLORS: Record<1|2|3, string> = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#CD7C2F' };

function PodiumSpot({ ranked, position }: {
  ranked: RankedFriend | undefined; position: 1|2|3;
}) {
  const { t } = useTranslation();
  if (!ranked) return <View style={[pd.spot, pd[`spot${position}`]]} />;

  const avatarSize = position === 1 ? 'xl' as const : 'lg' as const;
  const mc = MEDAL_COLORS[position];

  return (
    <View style={[pd.spot, pd[`spot${position}`]]}>
      {position === 1 && (
        <RNText style={{ fontSize: 22, lineHeight: 28 }}>👑</RNText>
      )}
      <View style={[pd.ring, { borderColor: mc }]}>
        <Avatar
          avatarId={ranked.child.avatar_id as AvatarId}
          displayName={ranked.child.display_name}
          size={avatarSize}
        />
      </View>
      <View style={[pd.badge, { backgroundColor: mc }]}>
        <RNText style={pd.badgeNum}>{position}</RNText>
      </View>
      <RNText style={pd.name} numberOfLines={1}>
        {ranked.isSelf ? t('friends.you') : ranked.child.display_name}
      </RNText>
      <View style={pd.xpRow}>
        <Ionicons name="flash" size={12} color="#F59E0B" />
        <RNText style={pd.xp}>{ranked.xp.toLocaleString()}</RNText>
      </View>
    </View>
  );
}
const pd = StyleSheet.create({
  spot:    { alignItems: 'center', gap: 4, width: 100 },
  spot1:   {},
  spot2:   { marginTop: 40 },
  spot3:   { marginTop: 40 },
  ring:    { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderRadius: 999, padding: 3 },
  badge:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: -10, borderWidth: 2, borderColor: '#fff', ...shadows.sm },
  badgeNum:{ fontFamily: fontFamily.extraBold, fontSize: 12, color: '#fff' },
  name:    { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text.primary, textAlign: 'center', maxWidth: 88 },
  xpRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xp:      { fontFamily: fontFamily.bold, fontSize: 12, color: '#F59E0B' },
});

// ─── Rank row (ranking) ───────────────────────────────────────────────────────

function RankRow({ ranked }: { ranked: RankedFriend }) {
  const { t } = useTranslation();
  const hl = ranked.isSelf;
  return (
    <View style={[rr.row, hl ? rr.rowHl : null]}>
      <RNText style={[rr.pos, hl ? rr.posHl : null] as StyleProp<TextStyle>}>#{ranked.position}</RNText>
      <Avatar
        avatarId={ranked.child.avatar_id as AvatarId}
        displayName={ranked.child.display_name}
        size="md"
      />
      <View style={rr.mid}>
        <RNText style={[rr.name, hl ? rr.nameHl : null]}>
          {ranked.isSelf ? t('common.self') : ranked.child.display_name}
        </RNText>
        <RNText style={[rr.sub, hl ? rr.subHl : null]}>
          @{ranked.child.username} · {t('common.level', { level: ranked.child.level })}
        </RNText>
      </View>
      <View style={rr.xpCol}>
        <Ionicons name="flash" size={13} color={hl ? '#FDE68A' : '#F59E0B'} />
        <RNText style={[rr.xp, hl ? rr.xpHl : null]}>{ranked.xp.toLocaleString()}</RNText>
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

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({ request, onAccept, onReject, loading }: {
  request: PendingRequest; onAccept: () => void; onReject: () => void; loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={rc.card}>
      <FriendAvatar name={request.from_child.display_name} avatarId={request.from_child.avatar_id} size={48} />
      <View style={rc.mid}>
        <Text style={rc.name}>{request.from_child.display_name}</Text>
        <Text style={rc.sub}>{t('common.level', { level: request.from_child.level })}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" style={{ marginHorizontal: 12 }} />
      ) : (
        <View style={rc.actions}>
          <Pressable style={rc.acceptBtn} onPress={onAccept} hitSlop={6}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </Pressable>
          <Pressable style={rc.rejectBtn} onPress={onReject} hitSlop={6}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
const rc = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm },
  mid:       { flex: 1 },
  name:      { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  sub:       { fontFamily: fontFamily.regular,   fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  actions:   { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
});

// ─── Friend row ───────────────────────────────────────────────────────────────

function FriendRow({ friend, rank, onBlock, onChat, unreadCount }: {
  friend: FriendProfile;
  rank: number;
  onBlock: () => void;
  onChat: () => void;
  unreadCount: number;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <View style={fr.row}>
      <Text style={fr.rank}>#{rank}</Text>
      <FriendAvatar name={friend.display_name} avatarId={friend.avatar_id} size={44} />
      <View style={fr.mid}>
        <Text style={fr.name}>{friend.display_name}</Text>
        <Text style={fr.sub}>@{friend.username} · {t('common.level', { level: friend.level })}</Text>
      </View>
      <Pressable onPress={onChat} hitSlop={8} style={fr.chatBtn}>
        <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        {unreadCount > 0 && (
          <View style={fr.badge}>
            <Text style={fr.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Pressable>
      <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={8} style={fr.menuBtn}>
        <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
      </Pressable>
      {menuOpen && (
        <Pressable
          style={fr.blockBtn}
          onPress={() => { setMenuOpen(false); onBlock(); }}
          hitSlop={4}
        >
          <Ionicons name="ban-outline" size={14} color={colors.error} />
          <Text style={fr.blockText}>{t('friends.block')}</Text>
        </Pressable>
      )}
    </View>
  );
}
const fr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm, position: 'relative' },
  rank:      { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text.secondary, width: 24, textAlign: 'center' },
  mid:       { flex: 1 },
  name:      { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  sub:       { fontFamily: fontFamily.regular,   fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  chatBtn:   { padding: 4, position: 'relative' },
  badge:     { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: fontFamily.bold, fontSize: 9, color: '#fff' },
  menuBtn:   { padding: 4 },
  blockBtn:  { position: 'absolute', right: 12, top: 48, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 8, padding: 10, zIndex: 10, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  blockText: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.error },
});

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyFriends({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={es.wrap}>
      <Text style={es.emoji}>👥</Text>
      <Text style={es.title}>{t('friends.noFriends')}</Text>
      <Text style={es.sub}>{t('friends.noFriendsDesc')}</Text>
      <Pressable style={es.btn} onPress={onAdd}>
        <Ionicons name="person-add-outline" size={18} color="#fff" />
        <Text style={es.btnText}>{t('friends.addFriendBtn')}</Text>
      </Pressable>
    </View>
  );
}
const es = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emoji:   { fontSize: 48 },
  title:   { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  sub:     { fontFamily: fontFamily.regular, fontSize: 14, color: colors.text.secondary, textAlign: 'center' },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  btnText: { fontFamily: fontFamily.bold, fontSize: 15, color: '#fff' },
});

function EmptyRanking({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={em.wrap}>
      <Text style={em.emoji}>🏆</Text>
      <Text style={em.title}>{t('friends.emptyRanking')}</Text>
      <Text style={em.sub}>{t('friends.emptyRankingDesc')}</Text>
      <Pressable style={em.btn} onPress={onAdd}>
        <Ionicons name="person-add-outline" size={18} color="#fff" />
        <Text style={em.btnText}>{t('friends.addFriendBtn')}</Text>
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
  const { t }       = useTranslation();
  const router      = useRouter();
  const queryClient = useQueryClient();
  const child       = useProfileStore(selectActiveChild);

  const [section, setSection]           = useState<Section>('friends');
  const [period, setPeriod]             = useState<RankingPeriod>('weekly');
  const [search, setSearch]             = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // ── Queries comuns ──────────────────────────────────────────────────────────

  const { data: requests = [] } = useQuery({
    queryKey: ['friend_requests', child?.id],
    queryFn:  () => socialService.getPendingRequests(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      if (child?.id) {
        void queryClient.invalidateQueries({ queryKey: ['friends',         child.id] });
        void queryClient.invalidateQueries({ queryKey: ['friends_ranking', child.id] });
        void queryClient.invalidateQueries({ queryKey: ['friend_requests', child.id] });
      }
    }, [queryClient, child?.id]),
  );

  // ── Queries — painel Amigos ─────────────────────────────────────────────────

  const { data: friends = [], isLoading: lf } = useQuery({
    queryKey: ['friends', child?.id],
    queryFn:  () => socialService.getFriends(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  const { data: unreadMap = new Map<string, number>() } = useQuery({
    queryKey: ['unread_by_friend', child?.id],
    queryFn:  () => chatService.getUnreadCountByFriend(child!.id),
    enabled:  !!child?.id,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      socialService.respondToRequest(requestId, accept),
    onMutate:  ({ requestId }) => setRespondingId(requestId),
    onSettled: () => {
      setRespondingId(null);
      void queryClient.invalidateQueries({ queryKey: ['friends',         child?.id] });
      void queryClient.invalidateQueries({ queryKey: ['friend_requests', child?.id] });
      void queryClient.invalidateQueries({ queryKey: ['friends_ranking', child?.id] });
    },
    onError: (e) => Alert.alert(t('common.error'), (e as Error).message),
  });

  // ── Queries — painel Ranking ────────────────────────────────────────────────

  const selfProfile = child ? {
    id: child.id, display_name: child.display_name,
    username: (child as typeof child & { username?: string }).username ?? '',
    avatar_id: child.avatar_id, level: child.level,
    xp_total: child.xp_total, current_streak: child.current_streak,
  } : null;

  const { data: ranked = [], isLoading: lr } = useQuery({
    queryKey: ['friends_ranking', child?.id, period],
    queryFn:  () => socialService.getFriendsRanking(child!.id, selfProfile!, period),
    enabled:  !!child?.id && !!selfProfile,
    staleTime: 60_000,
  });

  if (!child) return null;

  // ── Social bloqueado ────────────────────────────────────────────────────────
  if (child.social_enabled === false) {
    return (
      <View style={s.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={s.header}>
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="caption" style={s.appName}>{t('friends.mathHeroKids')}</Text>
                <Text variant="h1" color={colors.text.inverse}>{t('friends.title')}</Text>
              </View>
            </View>
          </LinearGradient>
        </SafeAreaView>
        <View style={sl.wrap}>
          <MiloMessage message={t('friends.socialDisabledMilo')} variant="orange" />
          <View style={sl.card}>
            <View style={sl.iconWrap}>
              <Ionicons name="lock-closed" size={40} color={colors.primary} />
            </View>
            <Text variant="h3" align="center" style={sl.title}>{t('friends.socialDisabledTitle')}</Text>
            <Text variant="body" align="center" color={colors.text.secondary} style={sl.body}>
              {t('friends.socialDisabledBody')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Derivados ───────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? friends.filter((f) =>
        f.display_name.toLowerCase().includes(search.toLowerCase()) ||
        f.username.toLowerCase().includes(search.toLowerCase()),
      )
    : friends;

  const top3   = ranked.slice(0, 3);
  const rest   = ranked.slice(3);
  const first  = top3.find((r) => r.position === 1);
  const second = top3.find((r) => r.position === 2);
  const third  = top3.find((r) => r.position === 3);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={s.header}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="caption" style={s.appName}>{t('friends.mathHeroKids')}</Text>
              <Text variant="h1" color={colors.text.inverse}>{t('friends.title')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'flex-end' }}>
              <Pressable
                style={s.iconBtn}
                onPress={() => router.push('/(app)/friends/notifications')}
                hitSlop={8}
              >
                <Ionicons name="notifications-outline" size={22} color="#fff" />
                {requests.length > 0 && (
                  <View style={s.notifBadge}>
                    <RNText style={s.notifBadgeText}>{requests.length}</RNText>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={s.iconBtn}
                onPress={() => router.push('/(app)/friends/add')}
                hitSlop={8}
              >
                <Ionicons name="person-add-outline" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* ── Content ────────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Top-level toggle */}
        <SectionToggle value={section} onChange={(v) => { setSection(v); setSearch(''); }} />

        {/* ── Painel: Amigos ─────────────────────────────────────── */}
        {section === 'friends' && (
          <>
            {/* Search bar */}
            <View style={s.searchBar}>
              <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder={t('friends.searchPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            {lf ? (
              <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Pedidos pendentes */}
                {requests.length > 0 && (
                  <View style={s.section}>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>{t('friends.pendingRequests')}</Text>
                      <View style={s.pendingBadge}>
                        <Text style={s.pendingBadgeText}>{requests.length}</Text>
                      </View>
                    </View>
                    {requests.map((req) => (
                      <RequestCard
                        key={req.id}
                        request={req}
                        loading={respondingId === req.id}
                        onAccept={() => respondMutation.mutate({ requestId: req.id, accept: true })}
                        onReject={() => respondMutation.mutate({ requestId: req.id, accept: false })}
                      />
                    ))}
                  </View>
                )}

                {/* Lista de amigos */}
                <View style={s.section}>
                  {filtered.length === 0 && !search ? (
                    <EmptyFriends onAdd={() => router.push('/(app)/friends/add')} />
                  ) : filtered.length === 0 ? (
                    <View style={s.noResults}>
                      <Text style={s.noResultsText}>{t('friends.noResults')}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={s.sectionTitle}>
                        {search
                          ? t('friends.results', { count: filtered.length })
                          : `${friends.length} amigo${friends.length !== 1 ? 's' : ''}`}
                      </Text>
                      {filtered.map((f, i) => (
                        <FriendRow
                          key={f.id}
                          friend={f}
                          rank={i + 1}
                          unreadCount={(unreadMap as Map<string, number>).get(f.id) ?? 0}
                          onChat={() => {
                            if (f.social_enabled === false) {
                              Alert.alert(
                                t('friends.chatBlockedTitle'),
                                t('friends.chatBlockedBody', { name: f.display_name }),
                              );
                              return;
                            }
                            router.push(`/(app)/friends/chat/${f.id}` as never);
                          }}
                          onBlock={() => {
                            Alert.alert(
                              t('friends.blockTitle'),
                              t('friends.blockConfirm', { name: f.display_name }),
                              [
                                { text: t('common.cancel') ?? 'Cancelar', style: 'cancel' },
                                { text: t('friends.block'), style: 'destructive', onPress: async () => {
                                    if (!child) return;
                                    await socialService.blockUser(child.id, f.id);
                                    void queryClient.invalidateQueries({ queryKey: ['friends', child.id] });
                                  },
                                },
                              ],
                            );
                          }}
                        />
                      ))}
                    </>
                  )}
                </View>

                {/* Footer links */}
                <View style={s.footerLinks}>
                  <Pressable style={s.footerLink} onPress={() => router.push('/(app)/friends/notifications')}>
                    <Ionicons name="notifications-outline" size={16} color={colors.primary} />
                    <Text style={s.footerLinkText}>{t('friends.viewNotifications')}</Text>
                  </Pressable>
                  <Pressable style={s.footerLink} onPress={() => router.push('/(app)/friends/blocked')}>
                    <Ionicons name="ban-outline" size={16} color={colors.text.secondary} />
                    <Text style={[s.footerLinkText, { color: colors.text.secondary }]}>{t('friends.blockedUsers')}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}

        {/* ── Painel: Ranking ────────────────────────────────────── */}
        {section === 'ranking' && (
          <>
            <PeriodToggle value={period} onChange={setPeriod} />

            {lr ? (
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
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// ─── Social disabled styles ───────────────────────────────────────────────────

const sl = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: space.lg,
    gap: space.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 24,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...({
      shadowColor: colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    } as object),
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  title: { marginBottom: 4 },
  body:  { lineHeight: 22, maxWidth: 280 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },

  // Header — idêntico ao settings
  header:   { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.lg },
  appName:  { color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 } as import('react-native').TextStyle,
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
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

  // Scroll / content
  scroll:   { flex: 1 },
  content:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },

  // Search bar
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, ...shadows.sm },
  searchInput: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: colors.text.primary, padding: 0 },

  // Friends list sections
  section:         { gap: 10 },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  sectionTitle:    { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  pendingBadge:    { backgroundColor: '#F5722A', borderRadius: 999, minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  pendingBadgeText:{ fontFamily: fontFamily.extraBold, fontSize: 13, color: '#fff' },
  noResults:       { alignItems: 'center', paddingVertical: 20 },
  noResultsText:   { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.text.secondary },

  // Footer links
  footerLinks:    { gap: 8, marginTop: 4 },
  footerLink:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, justifyContent: 'center' },
  footerLinkText: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primary },

  // Ranking
  podium: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    gap: 8, paddingVertical: 24, backgroundColor: '#fff',
    borderRadius: radius['2xl'], ...shadows.md,
  },
  divider: { height: 1, backgroundColor: '#E4E5EF' },
});
