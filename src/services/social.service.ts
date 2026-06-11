/**
 * Social service — Friends, requests, ranking, blocking.
 *
 * RLS constraints (sem EFs deployadas):
 * - friendships:    SELECT próprias (funciona)
 * - friend_requests: SELECT próprias (funciona)
 * - child_profiles: sem política cross-child — search/ranking requer EF ou política extra
 * - child_xp_ledger: só próprias crianças — ranking de amigos requer EF
 *
 * Block list: stored in AsyncStorage for MVP (Supabase blocked_users table is Phase 5+).
 *
 * Approach: implementação completa; erros de RLS retornam arrays vazios / null graciosamente.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { AvatarId } from '@/constants/config';
import type { FriendRequest } from '@/types/database.types';

const BLOCKED_KEY = (childId: string) => `social_blocked_${childId}`;

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface FriendProfile {
  id:             string;
  display_name:   string;
  username:       string;
  avatar_id:      AvatarId;
  level:          number;
  xp_total:       number;
  current_streak: number;
  social_enabled: boolean;
}

export interface PendingRequest {
  id:            string;
  from_child_id: string;
  created_at:    string;
  from_child: FriendProfile;
}

export interface SentRequest {
  id:          string;
  to_child_id: string;
  to_child:    FriendProfile;
}

export interface RankedFriend {
  child:    FriendProfile;
  xp:       number;   // weekly or monthly XP
  position: number;
  isSelf:   boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const socialService = {

  /**
   * Lista de amigos da criança, ordenada por xp_total desc.
   * Join: friendships → child_profiles (requer RLS cross-child — Phase 5).
   */
  async getFriends(childId: string): Promise<FriendProfile[]> {
    try {
      // friendships → join child_profiles via friend_id
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          friend:friend_id (
            id, display_name, username, avatar_id,
            level, xp_total, current_streak, social_enabled
          )
        `)
        .eq('child_id', childId)
        .order('created_at', { ascending: false });

      if (error) return [];

      return (data ?? [])
        .map((row: { friend: FriendProfile | FriendProfile[] | null }) => {
          const f = Array.isArray(row.friend) ? row.friend[0] : row.friend;
          return f ?? null;
        })
        .filter((f): f is FriendProfile => f !== null)
        .sort((a, b) => b.xp_total - a.xp_total);
    } catch {
      return [];
    }
  },

  /**
   * Pedidos pendentes recebidos pela criança.
   */
  async getPendingRequests(childId: string): Promise<PendingRequest[]> {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id, from_child_id, created_at,
          from_child:from_child_id (
            id, display_name, username, avatar_id,
            level, xp_total, current_streak, social_enabled
          )
        `)
        .eq('to_child_id', childId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) return [];

      return (data ?? [])
        .map((row: {
          id: string;
          from_child_id: string;
          created_at: string;
          from_child: FriendProfile | FriendProfile[] | null;
        }) => {
          const fc = Array.isArray(row.from_child) ? row.from_child[0] : row.from_child;
          if (!fc) return null;
          return { id: row.id, from_child_id: row.from_child_id, created_at: row.created_at, from_child: fc };
        })
        .filter((r): r is PendingRequest => r !== null);
    } catch {
      return [];
    }
  },

  /**
   * Pedidos enviados pela criança (para saber quais já foram enviados → botão disabled).
   */
  async getSentRequestIds(childId: string): Promise<Set<string>> {
    try {
      const { data } = await supabase
        .from('friend_requests')
        .select('to_child_id')
        .eq('from_child_id', childId)
        .in('status', ['pending', 'accepted']);

      return new Set((data ?? []).map((r: { to_child_id: string }) => r.to_child_id));
    } catch {
      return new Set();
    }
  },

  /**
   * Pedidos enviados pendentes com dados completos do destinatário.
   * Usado na tela AddFriend para mostrar estado 'sent' + botão cancelar.
   */
  async getSentRequests(childId: string): Promise<SentRequest[]> {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id, to_child_id,
          to_child:to_child_id (
            id, display_name, username, avatar_id,
            level, xp_total, current_streak, social_enabled
          )
        `)
        .eq('from_child_id', childId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) return [];

      return (data ?? [])
        .map((row: { id: string; to_child_id: string; to_child: FriendProfile | FriendProfile[] | null }) => {
          const tc = Array.isArray(row.to_child) ? row.to_child[0] : row.to_child;
          if (!tc) return null;
          return { id: row.id, to_child_id: row.to_child_id, to_child: tc };
        })
        .filter((r): r is SentRequest => r !== null);
    } catch {
      return [];
    }
  },

  /**
   * Cancela um pedido enviado pelo sender via Edge Function cancel_friend_request.
   */
  async cancelFriendRequest(requestId: string, fromChildId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('cancel_friend_request', {
      body: { request_id: requestId, from_child_id: fromChildId },
    });

    if (!error) return;

    let message = 'Não foi possível cancelar o pedido. Tente novamente.'; // i18n-ignore — TODO: throw error codes, translate in UI layer
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.clone().json() as { error?: string; message?: string };
        if (body.error === 'ALREADY_RESPONDED') message = 'Este pedido já foi respondido.';
        else if (body.message) message = body.message;
      }
    } catch { /* usar mensagem default */ }

    throw new Error(message);
  },

  /**
   * Busca exacta por username (case-insensitive).
   * Requer RLS que permita leitura cross-child (Phase 5 — por agora tenta e retorna null se falhar).
   */
  async searchByUsername(username: string): Promise<FriendProfile | null> {
    try {
      const { data, error } = await supabase
        .from('child_profiles')
        .select('id, display_name, username, avatar_id, level, xp_total, current_streak, social_enabled')
        .ilike('username', username.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) return null;
      return data as FriendProfile;
    } catch {
      return null;
    }
  },

  /**
   * Sugestões: amigos-de-amigos, excluindo já-amigos, a própria criança
   * e qualquer child com pedido pendente em qualquer sentido (bilateral).
   * Requer RLS cross-child.
   */
  async getSuggestions(childId: string): Promise<FriendProfile[]> {
    try {
      // 1. IDs dos amigos actuais
      const { data: myFriends } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('child_id', childId);

      const excludeIds = new Set((myFriends ?? []).map((r: { friend_id: string }) => r.friend_id));
      excludeIds.add(childId); // excluir a própria criança

      // 2. IDs com pedidos pendentes em qualquer sentido (enviados ou recebidos)
      const [{ data: sentPending }, { data: receivedPending }] = await Promise.all([
        supabase
          .from('friend_requests')
          .select('to_child_id')
          .eq('from_child_id', childId)
          .eq('status', 'pending'),
        supabase
          .from('friend_requests')
          .select('from_child_id')
          .eq('to_child_id', childId)
          .eq('status', 'pending'),
      ]);

      (sentPending ?? []).forEach((r: { to_child_id: string }) => excludeIds.add(r.to_child_id));
      (receivedPending ?? []).forEach((r: { from_child_id: string }) => excludeIds.add(r.from_child_id));

      const excludeArr = Array.from(excludeIds);

      if (excludeIds.size <= 1) {
        // Sem amigos — sugestões por nível próximo
        const { data: ownProfile } = await supabase
          .from('child_profiles')
          .select('level')
          .eq('id', childId)
          .single();

        const level = (ownProfile as { level: number } | null)?.level ?? 1;

        const { data: levelPeers } = await supabase
          .from('child_profiles')
          .select('id, display_name, username, avatar_id, level, xp_total, current_streak, social_enabled')
          .gte('level', level - 2)
          .lte('level', level + 2)
          .eq('is_active', true)
          .not('id', 'in', `(${excludeArr.join(',')})`)
          .limit(10);

        return (levelPeers ?? []) as FriendProfile[];
      }

      // 3. Amigos-dos-amigos, excluindo todos os IDs a ignorar
      const { data: foaRows } = await supabase
        .from('friendships')
        .select('friend_id, friend:friend_id(id, display_name, username, avatar_id, level, xp_total, current_streak, social_enabled)')
        .in('child_id', excludeArr)
        .not('friend_id', 'in', `(${excludeArr.join(',')})`)
        .limit(20);

      const seen = new Set<string>();
      const suggestions: FriendProfile[] = [];

      for (const row of (foaRows ?? []) as unknown as Array<{ friend_id: string; friend: FriendProfile | null }>) {
        if (!row.friend || seen.has(row.friend_id)) continue;
        seen.add(row.friend_id);
        suggestions.push(row.friend);
      }

      return suggestions.slice(0, 10);
    } catch {
      return [];
    }
  },

  /**
   * Envia pedido de amizade via Edge Function send_friend_request.
   *
   * A EF usa SERVICE_ROLE_KEY — único caminho válido para INSERT em friend_requests
   * (sem política INSERT no RLS). Sem fallback de insert directo.
   *
   * Parseia FunctionsHttpError.context para expor o código de erro real da EF.
   */
  async sendFriendRequest(fromChildId: string, toChildId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('send_friend_request', {
      body: { from_child_id: fromChildId, to_child_id: toChildId },
    });

    if (!error) return; // 200 / 201 — sucesso

    // Propagate error code so the UI layer can translate it
    let code = 'UNKNOWN';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.clone().json() as { error?: string };
        if (body.error) code = body.error;
      }
    } catch { /* usar código default */ }

    throw new Error(code);
  },

  /**
   * Aceita ou rejeita pedido via Edge Function respond_friend_request.
   *
   * A EF usa SERVICE_ROLE_KEY — único caminho válido para UPDATE em friend_requests.
   */
  async respondToRequest(requestId: string, accept: boolean): Promise<void> {
    const { error } = await supabase.functions.invoke('respond_friend_request', {
      body: { request_id: requestId, accept },
    });

    if (!error) return;

    let message = 'Não foi possível responder ao pedido. Tente novamente.'; // i18n-ignore
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.clone().json() as { error?: string; message?: string };
        if (body.message) message = body.message;
      }
    } catch { /* usar mensagem default */ }

    throw new Error(message);
  },

  /**
   * Ranking: amigos (semanal, mensal ou global).
   * Todos os períodos mostram apenas amigos + self.
   * - weekly/monthly: XP do período via child_xp_ledger
   * - global: xp_total acumulado (entre amigos, não todos os jogadores)
   */
  async getFriendsRanking(
    childId:     string,
    selfProfile: FriendProfile,
    period:      'weekly' | 'monthly' | 'global',
  ): Promise<RankedFriend[]> {
    try {
      const friends = await socialService.getFriends(childId);
      const allChildren = [selfProfile, ...friends];

      // ── Global: xp_total acumulado entre amigos ────────────────────────────
      if (period === 'global') {
        return allChildren
          .map((child) => ({
            child,
            xp:       child.xp_total,
            position: 0,
            isSelf:   child.id === childId,
          }))
          .sort((a, b) => b.xp - a.xp)
          .map((item, i) => ({ ...item, position: i + 1 }));
      }

      // ── Semanal / Mensal: XP do período via child_xp_ledger ───────────────
      const now        = new Date();
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodStart = period === 'weekly' ? weekStart : monthStart;

      const allIds = allChildren.map((c) => c.id);

      const { data: ledgerRows } = await supabase
        .from('child_xp_ledger')
        .select('child_id, amount')
        .in('child_id', allIds)
        .gte('created_at', periodStart.toISOString());

      const xpMap = new Map<string, number>(allIds.map((id) => [id, 0]));
      for (const row of (ledgerRows ?? []) as Array<{ child_id: string; amount: number }>) {
        xpMap.set(row.child_id, (xpMap.get(row.child_id) ?? 0) + row.amount);
      }

      return allChildren
        .map((child) => ({
          child,
          xp:     xpMap.get(child.id) ?? 0,
          position: 0,
          isSelf: child.id === childId,
        }))
        .sort((a, b) => b.xp - a.xp)
        .map((item, i) => ({ ...item, position: i + 1 }));
    } catch {
      return [];
    }
  },

  // ─── Block list (AsyncStorage for MVP) ──────────────────────────────────────

  async getBlockedIds(childId: string): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(BLOCKED_KEY(childId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  },

  async blockUser(childId: string, targetId: string): Promise<void> {
    const current = await socialService.getBlockedIds(childId);
    if (!current.includes(targetId)) {
      current.push(targetId);
      await AsyncStorage.setItem(BLOCKED_KEY(childId), JSON.stringify(current));
    }
    // Also reject any pending friend request from this user
    try {
      const { data: reqs } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('from_child_id', targetId)
        .eq('to_child_id', childId)
        .eq('status', 'pending');
      for (const req of (reqs ?? []) as Array<{ id: string }>) {
        await socialService.respondToRequest(req.id, false);
      }
    } catch { /* best effort */ }
  },

  async unblockUser(childId: string, targetId: string): Promise<void> {
    const current = await socialService.getBlockedIds(childId);
    const updated = current.filter((id) => id !== targetId);
    await AsyncStorage.setItem(BLOCKED_KEY(childId), JSON.stringify(updated));
  },

  /**
   * Returns blocked profiles (fetches child_profiles for each blocked ID).
   * Best-effort — returns empty array if RLS blocks the query.
   */
  async getBlockedProfiles(childId: string): Promise<FriendProfile[]> {
    const ids = await socialService.getBlockedIds(childId);
    if (ids.length === 0) return [];
    try {
      const { data } = await supabase
        .from('child_profiles')
        .select('id, display_name, username, avatar_id, level, xp_total, current_streak, social_enabled')
        .in('id', ids)
        .eq('is_active', true);
      return (data ?? []) as FriendProfile[];
    } catch { return []; }
  },

  // ─── Notifications ───────────────────────────────────────────────────────────

  /**
   * Returns in-app notifications:
   * - Pending requests received (type: 'request')
   * - Recently accepted requests sent by this child (type: 'accepted') — last 7 days
   */
  async getNotifications(childId: string): Promise<AppNotification[]> {
    try {
      const [pendingRes, acceptedRes] = await Promise.all([
        supabase
          .from('friend_requests')
          .select(`id, from_child_id, created_at, from_child:from_child_id(id, display_name, username, avatar_id, level, xp_total, current_streak)`)
          .eq('to_child_id', childId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('friend_requests')
          .select(`id, to_child_id, responded_at, to_child:to_child_id(id, display_name, username, avatar_id, level, xp_total, current_streak)`)
          .eq('from_child_id', childId)
          .eq('status', 'accepted')
          .gte('responded_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
          .order('responded_at', { ascending: false }),
      ]);

      const notifications: AppNotification[] = [];

      type PendingRow = { id: string; from_child_id: string; created_at: string; from_child: FriendProfile | FriendProfile[] | null };
      type AcceptedRow = { id: string; to_child_id: string; responded_at: string; to_child: FriendProfile | FriendProfile[] | null };

      for (const row of (pendingRes.data ?? []) as unknown as PendingRow[]) {
        const fc = Array.isArray(row.from_child) ? row.from_child[0] : row.from_child;
        if (!fc) continue;
        notifications.push({ id: `req_${row.id}`, type: 'friend_request', requestId: row.id, profile: fc, at: row.created_at, read: false });
      }

      for (const row of (acceptedRes.data ?? []) as unknown as AcceptedRow[]) {
        const tc = Array.isArray(row.to_child) ? row.to_child[0] : row.to_child;
        if (!tc) continue;
        notifications.push({ id: `acc_${row.id}`, type: 'request_accepted', requestId: row.id, profile: tc, at: row.responded_at ?? '', read: false });
      }

      return notifications;
    } catch {
      return [];
    }
  },
};

// ─── Notification type ────────────────────────────────────────────────────────

export interface AppNotification {
  id:        string;
  type:      'friend_request' | 'request_accepted';
  requestId: string;
  profile:   FriendProfile;
  at:        string;
  read:      boolean;
}
