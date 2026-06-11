/**
 * Add Friend screen
 *
 * Layout (pixel-faithful ao design 06-friends.zip screenshot 2):
 * - Header azul gradient: ← back + {t('friends.add.title')}
 * - Campo de busca por username (executa ao submit/enter)
 * - Resultado: avatar + nome + @username + streak + botão Adicionar
 * - Sugestões (quando campo vazio): amigos-de-amigos
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
import { socialService, type FriendProfile } from '@/services/social.service';
import { colors, fontFamily, radius, shadows } from '@/theme';
import { FriendAvatar } from './../../(app)/(tabs)/friends';

// ─── Friend result card ───────────────────────────────────────────────────────

type RequestState = 'idle' | 'sending' | 'sent' | 'already_friend';

function FriendCard({
  profile,
  state,
  onAdd,
}: {
  profile:  FriendProfile;
  state:    RequestState;
  onAdd:    () => void;
}) {
  const { t } = useTranslation();
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
          <Text style={fc.level}>Nível {profile.level}</Text>
        </View>
      </View>
      {state === 'already_friend' ? (
        <View style={fc.friendedBadge}>
          <Ionicons name="checkmark" size={14} color="#22C55E" />
          <Text style={fc.friendedText}>{t('friends.add.alreadyFriend')}</Text>
        </View>
      ) : state === 'sent' ? (
        <View style={fc.sentBadge}>
          <Text style={fc.sentText}>{t('friends.add.sent')}</Text>
        </View>
      ) : (
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
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, ...shadows.sm },
  addBtnText:   { fontFamily: fontFamily.bold, fontSize: 14, color: '#fff' },
  friendedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  friendedText: { fontFamily: fontFamily.bold, fontSize: 13, color: '#22C55E' },
  sentBadge:    { backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  sentText:     { fontFamily: fontFamily.bold, fontSize: 13, color: '#6B7280' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddFriendScreen() {
  const { t } = useTranslation();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const child       = useProfileStore(selectActiveChild);

  const [query,         setQuery]         = useState('');
  const [searchResult,  setSearchResult]  = useState<FriendProfile | null | 'not_found'>(null);
  const [searching,     setSearching]     = useState(false);
  const [sentIds,       setSentIds]       = useState<Set<string>>(new Set());

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', child?.id],
    queryFn:  () => socialService.getFriends(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  const friendIds = new Set(friends.map((f) => f.id));

  const { data: suggestions = [], isLoading: loadingSugg } = useQuery({
    queryKey: ['suggestions', child?.id],
    queryFn:  () => socialService.getSuggestions(child!.id),
    enabled:  !!child?.id,
    staleTime: 60_000,
  });

  const sendMutation = useMutation({
    mutationFn: (toId: string) => socialService.sendFriendRequest(child!.id, toId),
    onSuccess: (_data, toId) => {
      setSentIds((prev) => new Set(prev).add(toId));
      void queryClient.invalidateQueries({ queryKey: ['friends', child?.id] });
    },
    onError: (e) => Alert.alert('Erro', (e as Error).message),
  });

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

  function getCardState(profileId: string): RequestState {
    if (friendIds.has(profileId))   return 'already_friend';
    if (sentIds.has(profileId))     return 'sent';
    if (sendMutation.isPending && sendMutation.variables === profileId) return 'sending';
    return 'idle';
  }

  if (!child) return null;

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
          <Text style={s.headerTitle}>{t('friends.add.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search field */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Digite o nome de usuário"
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
            <FriendCard
              profile={searchResult}
              state={getCardState(searchResult.id)}
              onAdd={() => sendMutation.mutate(searchResult.id)}
            />
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
                <Text style={s.emptyText}>Sem sugestões por agora.</Text>
                <Text style={s.emptySub}>Busca por username acima!</Text>
              </View>
            ) : (
              suggestions.map((p) => (
                <FriendCard
                  key={p.id}
                  profile={p}
                  state={getCardState(p.id)}
                  onAdd={() => sendMutation.mutate(p.id)}
                />
              ))
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
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff', flex: 1, textAlign: 'center' },

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
