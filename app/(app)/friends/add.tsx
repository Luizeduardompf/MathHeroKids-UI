/**
 * Add Friend screen
 *
 * Layout (pixel-faithful ao design 06-friends.zip screenshot 2):
 * - Header azul gradient: ← back + {t('friends.add.title')}
 * - Campo de busca por username (executa ao submit/enter)
 * - Resultado: avatar + nome + @username + streak + botão Adicionar
 * - Sugestões (quando campo vazio): amigos-de-amigos
 *
 * Estados do FriendCard (bilaterais):
 * - 'idle'        → botão Adicionar
 * - 'sending'     → spinner
 * - 'sent'        → badge "Enviado" + botão Cancelar
 * - 'cancelling'  → spinner no cancelar
 * - 'received'    → botões Aceitar / Rejeitar
 * - 'responding'  → spinner no aceitar/rejeitar
 * - 'already_friend' → badge "Amigo"
 */

import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { socialService, type FriendProfile, type SentRequest, type PendingRequest } from '@/services/social.service';
import { colors, fontFamily, radius, shadows } from '@/theme';
import { FriendAvatar } from './../../(app)/(tabs)/friends';

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestState =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'cancelling'
  | 'received'
  | 'responding'
  | 'already_friend';

interface CardInfo {
  state:      RequestState;
  requestId?: string;
}

// ─── Friend result card ───────────────────────────────────────────────────────

function FriendCard({
  profile,
  info,
  onAdd,
  onCancel,
  onAccept,
  onReject,
}: {
  profile:   FriendProfile;
  info:      CardInfo;
  onAdd:     () => void;
  onCancel:  () => void;
  onAccept:  () => void;
  onReject:  () => void;
}) {
  const { t } = useTranslation();
  const { state } = info;

  return (
    <View style={fc.card}>
      <FriendAvatar name={profile.display_name} size={52} />
      <View style={fc.mid}>
        <Text style={fc.name}>{profile.display_name}</Text>
        <Text style={fc.username}>@{profile.username}</Text>
        <View style={fc.meta}>
          <Ionicons name="flame" size={13} color="#F5722A" />
          <Text style={fc.streak}>{profile.current_streak}</Text>
          <Text style={fc.dot}>·</Text>
          <Text style={fc.level}>{t('common.level', { level: profile.level })}</Text>
        </View>
      </View>

      {/* ── Action area ── */}
      {state === 'already_friend' ? (
        <View style={fc.friendedBadge}>
          <Ionicons name="checkmark" size={14} color="#22C55E" />
          <Text style={fc.friendedText}>{t('friends.add.alreadyFriend')}</Text>
        </View>

      ) : state === 'received' ? (
        // Pedido recebido — Accept / Reject
        <View style={fc.actionRow}>
          <Pressable
            style={({ pressed }) => [fc.acceptBtn, pressed && { opacity: 0.78 }]}
            onPress={onAccept}
          >
            <Ionicons name="checkmark" size={15} color="#fff" />
            <Text style={fc.acceptText}>{t('friends.accept')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [fc.rejectBtn, pressed && { opacity: 0.78 }]}
            onPress={onReject}
          >
            <Ionicons name="close" size={15} color="#EF4444" />
          </Pressable>
        </View>

      ) : state === 'responding' ? (
        <ActivityIndicator color={colors.primary} size="small" style={{ marginRight: 8 }} />

      ) : state === 'sent' ? (
        // Pedido enviado — badge + Cancelar
        <View style={fc.sentGroup}>
          <View style={fc.sentBadge}>
            <Text style={fc.sentText}>{t('friends.add.sent')}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [fc.cancelBtn, pressed && { opacity: 0.78 }]}
            onPress={onCancel}
          >
            <Text style={fc.cancelText}>{t('friends.add.cancelRequest')}</Text>
          </Pressable>
        </View>

      ) : state === 'cancelling' ? (
        <ActivityIndicator color="#6B7280" size="small" style={{ marginRight: 8 }} />

      ) : (
        // idle / sending
        <Pressable
          style={({ pressed }) => [fc.addBtn, pressed && { opacity: 0.78 }]}
          onPress={onAdd}
          disabled={state === 'sending'}
        >
          {state === 'sending' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={fc.addBtnText}>{t('friends.add.addButton')}</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const fc = StyleSheet.create({
  card:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.xl, padding: 14, ...shadows.sm },
  mid:          { flex: 1 },
  name:         { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  username:     { fontFamily: fontFamily.regular,   fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  meta:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  streak:       { fontFamily: fontFamily.bold, fontSize: 12, color: '#F5722A' },
  dot:          { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.secondary },
  level:        { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.secondary },

  // Add
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, ...shadows.sm },
  addBtnText:   { fontFamily: fontFamily.bold, fontSize: 14, color: '#fff' },

  // Already friend
  friendedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  friendedText: { fontFamily: fontFamily.bold, fontSize: 13, color: '#22C55E' },

  // Sent + cancel
  sentGroup:    { alignItems: 'flex-end', gap: 6 },
  sentBadge:    { backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sentText:     { fontFamily: fontFamily.bold, fontSize: 12, color: '#6B7280' },
  cancelBtn:    { paddingHorizontal: 8, paddingVertical: 2 },
  cancelText:   { fontFamily: fontFamily.semiBold, fontSize: 11, color: '#EF4444' },

  // Received — Accept / Reject
  actionRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  acceptText:   { fontFamily: fontFamily.bold, fontSize: 13, color: '#fff' },
  rejectBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddFriendScreen() {
  const { t } = useTranslation();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const child       = useProfileStore(selectActiveChild);

  const [query,        setQuery]        = useState('');
  const [searchResult, setSearchResult] = useState<FriendProfile | null | 'not_found'>(null);
  const [searching,    setSearching]    = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', child?.id],
    queryFn:  () => socialService.getFriends(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  const { data: sentRequests = [] } = useQuery({
    queryKey: ['sentRequests', child?.id],
    queryFn:  () => socialService.getSentRequests(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pendingRequests', child?.id],
    queryFn:  () => socialService.getPendingRequests(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  const { data: suggestions = [], isLoading: loadingSugg } = useQuery({
    queryKey: ['suggestions', child?.id],
    queryFn:  () => socialService.getSuggestions(child!.id),
    enabled:  !!child?.id,
    staleTime: 60_000,
  });

  // ── Derived maps ─────────────────────────────────────────────────────────────

  const friendIds  = new Set(friends.map((f) => f.id));
  // sent: childId → requestId
  const sentMap    = new Map(sentRequests.map((r: SentRequest) => [r.to_child_id, r.id]));
  // received: fromChildId → requestId
  const receivedMap = new Map(pendingRequests.map((r: PendingRequest) => [r.from_child_id, r.id]));

  // ── Mutations ────────────────────────────────────────────────────────────────

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['friends',        child?.id] });
    void queryClient.invalidateQueries({ queryKey: ['sentRequests',   child?.id] });
    void queryClient.invalidateQueries({ queryKey: ['pendingRequests',child?.id] });
    void queryClient.invalidateQueries({ queryKey: ['suggestions',    child?.id] });
  };

  const sendMutation = useMutation({
    mutationFn: (toId: string) => socialService.sendFriendRequest(child!.id, toId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), (e as Error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => socialService.cancelFriendRequest(requestId, child!.id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), (e as Error).message),
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      socialService.respondToRequest(requestId, accept),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), (e as Error).message),
  });

  // ── Card state resolver ───────────────────────────────────────────────────────

  function getCardInfo(profileId: string): CardInfo {
    if (friendIds.has(profileId))    return { state: 'already_friend' };

    const receivedReqId = receivedMap.get(profileId);
    if (receivedReqId) {
      const isResponding = respondMutation.isPending &&
        (respondMutation.variables as { requestId: string } | undefined)?.requestId === receivedReqId;
      return { state: isResponding ? 'responding' : 'received', requestId: receivedReqId };
    }

    const sentReqId = sentMap.get(profileId);
    if (sentReqId) {
      const isCancelling = cancelMutation.isPending && cancelMutation.variables === sentReqId;
      return { state: isCancelling ? 'cancelling' : 'sent', requestId: sentReqId };
    }

    if (sendMutation.isPending && sendMutation.variables === profileId) return { state: 'sending' };
    return { state: 'idle' };
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!query.trim() || !child) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const result = await socialService.searchByUsername(query.trim());
      if (!result || result.id === child.id) {
        setSearchResult('not_found');
      } else {
        setSearchResult(result);
      }
    } finally {
      setSearching(false);
    }
  }

  if (!child) return null;

  // ── Render ────────────────────────────────────────────────────────────────────

  function renderCard(p: FriendProfile) {
    const info = getCardInfo(p.id);
    return (
      <FriendCard
        key={p.id}
        profile={p}
        info={info}
        onAdd={() => sendMutation.mutate(p.id)}
        onCancel={() => { if (info.requestId) cancelMutation.mutate(info.requestId); }}
        onAccept={() => { if (info.requestId) respondMutation.mutate({ requestId: info.requestId, accept: true }); }}
        onReject={() => { if (info.requestId) respondMutation.mutate({ requestId: info.requestId, accept: false }); }}
      />
    );
  }

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
            <Text style={s.headerTitle}>{t('friends.add.title')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Search field */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder={t('friends.add.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={(t) => { setQuery(t); if (!t.trim()) setSearchResult(null); }}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searching ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : query.length > 0 ? (
            <Pressable onPress={handleSearch} hitSlop={8}>
              <View style={s.searchGoBtn}>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </View>
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────────────── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Search result */}
        {searchResult === 'not_found' && (
          <View style={s.notFound}>
            <Ionicons name="person-outline" size={40} color="#D1D5DB" />
            <Text style={s.notFoundText}>{t('friends.add.notFound')}</Text>
            <Text style={s.notFoundSub}>{t('friends.add.notFoundDesc')}</Text>
          </View>
        )}

        {searchResult && searchResult !== 'not_found' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('friends.add.result')}</Text>
            {renderCard(searchResult)}
          </View>
        )}

        {/* Sent requests — always visible when present and no search active */}
        {!query.trim() && sentRequests.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('friends.add.sentRequestsTitle')}</Text>
            {sentRequests.map((r: SentRequest) => renderCard(r.to_child))}
          </View>
        )}

        {/* Suggestions (only when no search active) */}
        {!query.trim() && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('friends.add.suggestions')}</Text>
            {loadingSugg ? (
              <ActivityIndicator color={colors.primary} size="small" style={{ marginTop: 16 }} />
            ) : suggestions.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyText}>{t('friends.add.noSuggestions')}</Text>
                <Text style={s.emptySub}>{t('friends.add.noSuggestionsDesc')}</Text>
              </View>
            ) : (
              suggestions.map((p) => renderCard(p))
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },

  header:     { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerSub:   { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 14 },
  searchInput: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: colors.text.primary, padding: 0 },
  searchGoBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, gap: 20 },

  section:      { gap: 12 },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },

  notFound:    { alignItems: 'center', paddingVertical: 32, gap: 8 },
  notFoundText:{ fontFamily: fontFamily.bold, fontSize: 16, color: colors.text.primary },
  notFoundSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.text.secondary },

  emptyWrap:{ alignItems: 'center', paddingVertical: 20, gap: 4 },
  emptyText:{ fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.text.secondary },
  emptySub: { fontFamily: fontFamily.regular,  fontSize: 13, color: colors.text.secondary },
});
