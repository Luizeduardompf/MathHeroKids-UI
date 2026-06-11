/**
 * Chat screen — /friends/chat/[friendId]
 *
 * Real-time 1-1 chat between two children via Supabase Realtime.
 *
 * Layout:
 *  - Header azul gradient: ← back + avatar + friend name
 *  - ScrollView com mensagens em ordem cronológica
 *  - InputBar: TextInput + send button, keyboard-aware
 *
 * Realtime: subscribes on mount, unsubscribes on unmount.
 * Marks messages as read on open + quando nova mensagem chega.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { chatService, type ChatMessage } from '@/services/chat.service';
import { socialService, type FriendProfile } from '@/services/social.service';
import { colors, fontFamily, radius, shadows } from '@/theme';

// ─── Bubble ──────────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[bubble.wrapper, isMine ? bubble.wrapperMine : bubble.wrapperTheirs]}>
      <View style={[bubble.box, isMine ? bubble.boxMine : bubble.boxTheirs]}>
        <Text style={[bubble.text, isMine ? bubble.textMine : bubble.textTheirs]}>
          {msg.content}
        </Text>
      </View>
      <Text style={[bubble.time, isMine ? bubble.timeMine : bubble.timeTheirs]}>{time}</Text>
    </View>
  );
}

const bubble = StyleSheet.create({
  wrapper:       { marginVertical: 3, paddingHorizontal: 14 },
  wrapperMine:   { alignItems: 'flex-end' },
  wrapperTheirs: { alignItems: 'flex-start' },
  box:           { maxWidth: '75%', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14 },
  boxMine:       { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  boxTheirs:     { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  text:          { fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 21 },
  textMine:      { color: '#fff' },
  textTheirs:    { color: colors.text.primary },
  time:          { fontFamily: fontFamily.regular, fontSize: 11, marginTop: 3, color: colors.text.tertiary },
  timeMine:      { textAlign: 'right' },
  timeTheirs:    { textAlign: 'left' },
});

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  return (
    <View style={sep.wrapper}>
      <View style={sep.line} />
      <Text style={sep.label}>{date}</Text>
      <View style={sep.line} />
    </View>
  );
}
const sep = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 14 },
  line:    { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  label:   { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.tertiary, marginHorizontal: 10 },
});

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: `hsl(${hue},60%,60%)`,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: fontFamily.extraBold, fontSize: size * 0.38, color: '#fff' }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── List item types ──────────────────────────────────────────────────────────

type ListItem =
  | { type: 'message'; data: ChatMessage }
  | { type: 'separator'; date: string };

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const activeChild = useProfileStore(selectActiveChild);
  const myId = activeChild?.id ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);

  // ── Friend profile ─────────────────────────────────────────────────────────
  const { data: friends = [] } = useQuery({
    queryKey: ['friends', myId],
    queryFn: () => socialService.getFriends(myId),
    enabled: !!myId,
    staleTime: 30_000,
  });
  const friend = (friends as FriendProfile[]).find((f) => f.id === friendId);
  const friendName = friend?.display_name ?? '…';

  // ── Initial load ───────────────────────────────────────────────────────────
  const loadInitial = useCallback(async () => {
    if (!myId || !friendId) return;
    setLoading(true);
    const msgs = await chatService.getConversation(myId, friendId, 50);
    setMessages(msgs);
    setLoading(false);
    await chatService.markConversationRead(myId, friendId);
    qc.invalidateQueries({ queryKey: ['unread', myId] });
    qc.invalidateQueries({ queryKey: ['unread_by_friend', myId] });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [myId, friendId, qc]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!myId || !friendId) return;
    const unsub = chatService.subscribeToConversation(myId, friendId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      qc.invalidateQueries({ queryKey: ['unread', myId] });
      qc.invalidateQueries({ queryKey: ['unread_by_friend', myId] });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return unsub;
  }, [myId, friendId, qc]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !myId || !friendId) return;
    setInputText('');
    setSending(true);
    try {
      const newMsg = await chatService.sendMessage(myId, friendId, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, myId, friendId]);

  // ── Build list with date separators ───────────────────────────────────────
  const listItems: ListItem[] = React.useMemo(() => {
    const items: ListItem[] = [];
    let lastDate = '';
    for (const msg of messages) {
      const day = new Date(msg.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
      if (day !== lastDate) {
        items.push({ type: 'separator', date: day });
        lastDate = day;
      }
      items.push({ type: 'message', data: msg });
    }
    return items;
  }, [messages]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <LinearGradient
        colors={['#2B52E5', '#1A3DB8']}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Avatar name={friendName} size={38} />
        <View style={s.headerText}>
          <Text style={s.headerName}>{friendName}</Text>
          <Text style={s.headerSub}>Amigo</Text>
        </View>
      </LinearGradient>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {listItems.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>💬</Text>
              <Text style={s.emptyTitle}>Começa a conversa!</Text>
              <Text style={s.emptySub}>Manda uma mensagem para {friendName}</Text>
            </View>
          ) : (
            listItems.map((item, i) =>
              item.type === 'separator' ? (
                <DateSeparator key={`sep_${i}`} date={item.date} />
              ) : (
                <MessageBubble
                  key={item.data.id}
                  msg={item.data}
                  isMine={item.data.from_id === myId}
                />
              ),
            )
          )}
        </ScrollView>
      )}

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={s.input}
          placeholder={`Mensagem para ${friendName}…`}
          placeholderTextColor={colors.text.tertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          style={[s.sendBtn, (!inputText.trim() || sending) && s.sendBtnDisabled]}
          hitSlop={6}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  backBtn:   { marginRight: 2 },
  headerText:{ flex: 1 },
  headerName:{ fontFamily: fontFamily.extraBold, fontSize: 18, color: '#fff' },
  headerSub: { fontFamily: fontFamily.regular,   fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji:{ fontSize: 48, marginBottom: 4 },
  emptyTitle:{ fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary },
  emptySub:  { fontFamily: fontFamily.regular,   fontSize: 14, color: colors.text.secondary, textAlign: 'center' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text.primary,
    maxHeight: 120,
    minHeight: 42,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});
