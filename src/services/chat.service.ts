/**
 * chat.service.ts
 *
 * Friend chat via Supabase Realtime.
 *
 * Architecture:
 *  - Messages stored in `messages` table (from_id, to_id, content, read, created_at)
 *  - Realtime subscription via Supabase postgres_changes on INSERT
 *  - Pagination: load last 50 messages, scroll-to-load-more
 *  - Unread count: query messages where to_id = childId AND read = false
 *
 * RLS: parent of sender can INSERT; parent of either party can SELECT / mark read.
 */

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id:         string;
  from_id:    string;
  to_id:      string;
  content:    string;
  read:       boolean;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Supabase OR filter string for a conversation between two children. */
function conversationOrFilter(myId: string, friendId: string): string {
  return `and(from_id.eq.${myId},to_id.eq.${friendId}),and(from_id.eq.${friendId},to_id.eq.${myId})`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const chatService = {

  /**
   * Load conversation between two children, newest-first (paginated).
   * Returns messages in chronological order (oldest → newest) after fetching.
   *
   * @param myId     - active child's UUID
   * @param friendId - friend's UUID
   * @param limit    - messages to fetch (default 50)
   * @param before   - ISO string cursor for pagination (load older messages)
   */
  async getConversation(
    myId: string,
    friendId: string,
    limit = 50,
    before?: string,
  ): Promise<ChatMessage[]> {
    try {
      const conversationFilter = conversationOrFilter(myId, friendId);

      // Cast to any to use .or() — supabase-js types infer PostgrestQueryBuilder
      // before it narrows to PostgrestFilterBuilder in this project's TS config.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sel: any = supabase
        .from('messages')
        .select('id, from_id, to_id, content, read, created_at');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const filtered = sel.or(conversationFilter);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const ordered = filtered.order('created_at', { ascending: false }).limit(limit);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const baseQuery = before ? ordered.lt('created_at', before) : ordered;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data, error } = await baseQuery;
      if (error) throw error;

      // Reverse to get chronological order
      return ((data ?? []) as ChatMessage[]).reverse();
    } catch (err) {
      console.error('[chat] getConversation error:', err);
      return [];
    }
  },

  /**
   * Send a message from myId to friendId.
   * Returns the inserted message, or throws on error.
   */
  async sendMessage(fromId: string, toId: string, content: string): Promise<ChatMessage> {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 500) {
      throw new Error('Mensagem inválida (1–500 caracteres).');
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ from_id: fromId, to_id: toId, content: trimmed })
      .select('id, from_id, to_id, content, read, created_at')
      .single();

    if (error) throw error;
    return data as ChatMessage;
  },

  /**
   * Mark all unread messages from friendId → myId as read.
   * Called when the chat screen is opened / focused.
   */
  async markConversationRead(myId: string, friendId: string): Promise<void> {
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('to_id', myId)
        .eq('from_id', friendId)
        .eq('read', false);
    } catch (err) {
      console.error('[chat] markConversationRead error:', err);
    }
  },

  /**
   * Returns the total unread message count for a child
   * (across all conversations).
   */
  async getUnreadCount(childId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('to_id', childId)
        .eq('read', false);

      if (error) throw error;
      return count ?? 0;
    } catch {
      return 0;
    }
  },

  /**
   * Returns per-friend unread counts as a map: friendId → unreadCount.
   * Used for badge rendering on the friends list.
   */
  async getUnreadCountByFriend(myId: string): Promise<Map<string, number>> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('from_id')
        .eq('to_id', myId)
        .eq('read', false);

      if (error) throw error;

      const map = new Map<string, number>();
      for (const row of (data ?? []) as Array<{ from_id: string }>) {
        map.set(row.from_id, (map.get(row.from_id) ?? 0) + 1);
      }
      return map;
    } catch {
      return new Map();
    }
  },

  /**
   * Subscribe to new messages in a conversation (Realtime).
   *
   * @param myId     - active child's UUID
   * @param friendId - friend's UUID
   * @param onMessage - callback with the new message
   * @returns unsubscribe function — call on screen unmount
   */
  subscribeToConversation(
    myId: string,
    friendId: string,
    onMessage: (msg: ChatMessage) => void,
  ): () => void {
    const channelName = `chat_${[myId, friendId].sort().join('_')}`;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Filter: messages TO me FROM friend, or FROM me TO friend.
          // Supabase realtime filter supports one eq at a time; we filter client-side.
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          // Client-side filter for this conversation
          const isThisConversation =
            (msg.from_id === myId && msg.to_id === friendId) ||
            (msg.from_id === friendId && msg.to_id === myId);

          if (isThisConversation) {
            onMessage(msg);
            // Auto-mark read if we're the recipient and screen is open
            if (msg.to_id === myId) {
              chatService.markConversationRead(myId, friendId).catch(() => {});
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Subscribe to ANY new message for a child (for global unread badge).
   * Use in the friends tab or app root.
   */
  subscribeToUnread(
    myId: string,
    onNewMessage: (msg: ChatMessage) => void,
  ): () => void {
    const channelName = `unread_${myId}`;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `to_id=eq.${myId}`,
        },
        (payload) => {
          onNewMessage(payload.new as ChatMessage);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
