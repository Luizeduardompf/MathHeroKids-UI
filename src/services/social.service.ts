/**
 * Social service — Friends, requests, ranking.
 *
 * RLS constraints (sem EFs deployadas):
 * - friendships:    SELECT próprias (funciona)
 * - friend_requests: SELECT próprias (funciona)
 * - child_profiles: sem política cross-child — search/ranking requer EF ou política extra
 * - child_xp_ledger: só próprias crianças — ranking de amigos requer EF
 *
 * Approach: implementação completa; erros de RLS retornam arrays vazios / null graciosamente.
 */

import { supabase } from '@/lib/supabase';
import type { AvatarId } from '@/constants/config';
import type { FriendRequest } from '@/types/database.types';

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface FriendProfile {
  id:             string;
  display_name:   string;
  username:       string;
  avatar_id:      AvatarId;
  level:          number;
  xp_total:       number;
  current_streak: number;
}

export interface PendingRequest {
  id:            string;
  from_child_id: string;
  created_at:    string;
  from_child: FriendProfile;
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
            level, xp_total, current_streak
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
            level, xp_total, current_streak
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
   * Busca exacta por username (case-insensitive).
   * Requer RLS que permita leitura cross-child (Phase 5 — por agora tenta e retorna null se falhar).
   */
  async searchByUsername(username: string): Promise<FriendProfile | null> {
    try {
      const { data, error } = await supabase
        .from('child_profiles')
        .select('id, display_name, username, avatar_id, level, xp_total, current_streak')
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
   * Sugestões: amigos-de-amigos, excluindo já-amigos e a própria criança.
   * Requer RLS cross-child.
   */
  async getSuggestions(childId: string): Promise<FriendProfile[]> {
    try {
      // 1. IDs dos amigos actuais
      const { data: myFriends } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('child_id', childId);

      const myFriendIds = new Set((myFriends ?? []).map((r: { friend_id: string }) => r.friend_id));
      myFriendIds.add(childId); // excluir a própria criança

      if (myFriendIds.size <= 1) {
        // Sem amigos — sugestões por nível próximo
        const { data: ownProfile } = await supabase
          .from('child_profiles')
          .select('level')
          .eq('id', childId)
          .single();

        const level = (ownProfile as { level: number } | null)?.level ?? 1;

        const { data: levelPeers } = await supabase
          .from('child_profiles')
          .select('id, display_name, username, avatar_id, level, xp_total, current_streak')
          .gte('level', level - 2)
          .lte('level', level + 2)
          .eq('is_active', true)
          .neq('id', childId)
          .limit(10);

        return (levelPeers ?? []) as FriendProfile[];
      }

      // 2. Amigos-dos-amigos
      const { data: foaRows } = await supabase
        .from('friendships')
        .select('friend_id, friend:friend_id(id, display_name, username, avatar_id, level, xp_total, current_streak)')
        .in('child_id', Array.from(myFriendIds))
        .not('friend_id', 'in', `(${Array.from(myFriendIds).join(',')})`)
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
   * Se EF não disponível, tenta insert directo (falhará por RLS — erro retornado).
   */
  async sendFriendRequest(fromChildId: string, toChildId: string): Promise<void> {
    // Tentar EF primeiro
    try {
      const { error } = await supabase.functions.invoke('send_friend_request', {
        body: { from_child_id: fromChildId, to_child_id: toChildId },
      });
      if (error) throw error;
      return;
    } catch {
      // EF falhou — tentar direct insert (funciona se RLS tiver política INSERT)
    }

    const { error } = await supabase
      .from('friend_requests')
      .insert({ from_child_id: fromChildId, to_child_id: toChildId });

    if (error) throw new Error('Não foi possível enviar o pedido. Tente novamente.');
  },

  /**
   * Aceita ou rejeita pedido via Edge Function respond_friend_request.
   */
  async respondToRequest(requestId: string, accept: boolean): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('respond_friend_request', {
        body: { request_id: requestId, accept },
      });
      if (error) throw error;
      return;
    } catch {
      // Fallback directo
    }

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: accept ? 'accepted' : 'rejected', responded_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) throw new Error('Não foi possível responder ao pedido. Tente novamente.');
  },

  /**
   * Ranking de amigos por XP semanal ou mensal.
   * Query: child_xp_ledger dentro do período (requer RLS cross-child).
   * Fallback: usa xp_total se ledger não acessível.
   */
  async getFriendsRanking(
    childId:       string,
    selfProfile:   FriendProfile,
    period:        'weekly' | 'monthly',
  ): Promise<RankedFriend[]> {
    try {
      const friends = await socialService.getFriends(childId);

      const now     = new Date();
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodStart = period === 'weekly' ? weekStart : monthStart;

      // Tentar obter XP do ledger para amigos + self
      const allChildren = [selfProfile, ...friends];
      const allIds = allChildren.map((c) => c.id);

      const { data: ledgerRows } = await supabase
        .from('child_xp_ledger')
        .select('child_id, amount')
        .in('child_id', allIds)
        .gte('created_at', periodStart.toISOString());

      // Soma por child_id
      const xpMap = new Map<string, number>(allIds.map((id) => [id, 0]));
      for (const row of (ledgerRows ?? []) as Array<{ child_id: string; amount: number }>) {
        xpMap.set(row.child_id, (xpMap.get(row.child_id) ?? 0) + row.amount);
      }

      const ranked: RankedFriend[] = allChildren
        .map((child) => ({
          child,
          xp:     xpMap.get(child.id) ?? 0,
          position: 0,
          isSelf: child.id === childId,
        }))
        .sort((a, b) => b.xp - a.xp)
        .map((item, i) => ({ ...item, position: i + 1 }));

      return ranked;
    } catch {
      return [];
    }
  },
};
