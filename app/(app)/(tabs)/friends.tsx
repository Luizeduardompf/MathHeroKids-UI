/**
 * Friends screen — Tab principal de Amigos
 *
 * Layout (pixel-faithful ao design 06-friends.zip):
 * - Header azul gradient: "Math Hero Kids" + "Amigos" + botões ranking + person+
 * - Search bar inline (filtra lista de amigos)
 * - Secção "Pedidos pendentes" com badge de count + accept/reject
 * - Lista de amigos ordenada por XP
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
// @ts-expect-error RN 0.85 quirk — Alert present at runtime
import { Alert } from 'react-native'; // eslint-disable-line
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { socialService, type FriendProfile, type PendingRequest } from '@/services/social.service';
import { colors, fontFamily, radius, shadows } from '@/theme';

// ─── Avatar initials ──────────────────────────────────────────────────────────

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
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFromName(name) }]}>
      <Text style={[av.text, { fontSize: size * 0.35 }]}>{initials(name)}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text:   { fontFamily: fontFamily.extraBold, color: '#fff' },
});

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({
  request, onAccept, onReject, loading,
}: {
  request: PendingRequest; onAccept: () => void; onReject: () => void; loading: boolean;
}) {
  return (
    <View style={rc.card}>
      <FriendAvatar name={request.from_child.display_name} size={48} />
      <View style={rc.mid}>
        <Text style={rc.name}>{request.from_child.display_name}</Text>
        <Text style={rc.sub}>Nível {request.from_child.level}</Text>
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

function FriendRow({ friend, rank }: { friend: FriendProfile; rank: number }) {
  return (
    <View style={fr.row}>
      <Text style={fr.rank}>#{rank}</Text>
      <FriendAvatar name={friend.display_name} size={44} />
      <View style={fr.mid}>
        <Text style={fr.name}>{friend.display_name}</Text>
        <Text style={fr.sub}>@{friend.username} · Nível {friend.level}</Text>
      </View>
      <View style={fr.xpCol}>
        <Ionicons name="flash" size={13} color="#F59E0B" />
        <Text style={fr.xp}>{friend.xp_total.toLocaleString('pt-BR')}</Text>
      </View>
    </View>
  );
}
const fr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm },
  rank:  { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text.secondary, width: 24, textAlign: 'center' },
  mid:   { flex: 1 },
  name:  { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  sub:   { fontFamily: fontFamily.regular,   fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  xpCol: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xp:    { fontFamily: fontFamily.bold, fontSize: 13, color: '#F59E0B' },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyFriends({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={es.wrap}>
      <Text style={es.emoji}>👥</Text>
      <Text style={es.title}>Nenhum amigo ainda</Text>
      <Text style={es.sub}>Adiciona amigos para ver o ranking!</Text>
      <Pressable style={es.btn} onPress={onAdd}>
        <Ionicons name="person-add" size={18} color="#fff" />
        <Text style={es.btnText}>Adicionar amigo</Text>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AmigosScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const child       = useProfileStore(selectActiveChild);

  const [search, setSearch]             = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (child?.id) {
        void queryClient.invalidateQueries({ queryKey: ['friends',         child.id] });
        void queryClient.invalidateQueries({ queryKey: ['friend_requests', child.id] });
      }
    }, [queryClient, child?.id]),
  );

  const { data: friends  = [], isLoading: lf } = useQuery({
    queryKey: ['friends',         child?.id],
    queryFn:  () => socialService.getFriends(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  const { data: requests = [], isLoading: lr } = useQuery({
    queryKey: ['friend_requests', child?.id],
    queryFn:  () => socialService.getPendingRequests(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      socialService.respondToRequest(requestId, accept),
    onMutate:   ({ requestId }) => setRespondingId(requestId),
    onSettled:  () => {
      setRespondingId(null);
      void queryClient.invalidateQueries({ queryKey: ['friends',         child?.id] });
      void queryClient.invalidateQueries({ queryKey: ['friend_requests', child?.id] });
    },
    onError: (e) => Alert.alert('Erro', (e as Error).message),
  });

  if (!child) return null;

  const filtered = search.trim()
    ? friends.filter((f) =>
        f.display_name.toLowerCase().includes(search.toLowerCase()) ||
        f.username.toLowerCase().includes(search.toLowerCase()),
      )
    : friends;

  return (
    <View style={s.root}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#2B52E5', '#1A3DB8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerSub}>Math Hero Kids</Text>
            <Text style={s.headerTitle}>Amigos</Text>
          </View>
          <View style={s.headerBtns}>
            <Pressable style={s.iconBtn} onPress={() => router.push('/(app)/friends/ranking')} hitSlop={8}>
              <Ionicons name="podium" size={20} color="#fff" />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={() => router.push('/(app)/friends/add')} hitSlop={8}>
              <Ionicons name="person-add-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nome de usuário"
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
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────────────── */}
      {lf || lr ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* Pedidos pendentes */}
          {requests.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Pedidos pendentes</Text>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{requests.length}</Text>
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

          {/* Friends list */}
          <View style={s.section}>
            {filtered.length === 0 && !search ? (
              <EmptyFriends onAdd={() => router.push('/(app)/friends/add')} />
            ) : filtered.length === 0 ? (
              <View style={s.noResults}>
                <Text style={s.noResultsText}>Nenhum amigo encontrado</Text>
              </View>
            ) : (
              <>
                <Text style={s.sectionTitle}>
                  {search ? `Resultados (${filtered.length})` : `${friends.length} amigo${friends.length !== 1 ? 's' : ''}`}
                </Text>
                {filtered.map((f, i) => <FriendRow key={f.id} friend={f} rank={i + 1} />)}
              </>
            )}
          </View>

          {/* Ranking shortcut */}
          {friends.length > 0 && (
            <Pressable style={s.rankingBtn} onPress={() => router.push('/(app)/friends/ranking')}>
              <Ionicons name="podium" size={20} color={colors.primary} />
              <Text style={s.rankingBtnText}>Ver ranking de amigos</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          )}

        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },

  header:     { paddingHorizontal: 20, paddingBottom: 20 },
  headerTop:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerSub:  { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  headerTitle:{ fontFamily: fontFamily.extraBold, fontSize: 32, color: '#fff' },
  headerBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  iconBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: colors.text.primary, padding: 0 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, gap: 8 },

  section:      { gap: 10 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  badge:        { backgroundColor: '#F5722A', borderRadius: 999, minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  badgeText:    { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#fff' },
  noResults:    { alignItems: 'center', paddingVertical: 20 },
  noResultsText:{ fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.text.secondary },

  rankingBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.xl, padding: 16, ...shadows.sm, marginTop: 8 },
  rankingBtnText:{ flex: 1, fontFamily: fontFamily.bold, fontSize: 15, color: colors.primary },
});
