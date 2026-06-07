import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query client with production-grade defaults.
 *
 * staleTime: 60s — most game data doesn't need real-time precision.
 * gcTime:   5m  — keep unused queries in memory for fast navigation.
 * retry: 2      — transient network issues recover automatically.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false, // mobile app — refetch on focus is handled per-screen
    },
    mutations: {
      retry: 0, // mutations should not auto-retry (idempotency must be explicit)
    },
  },
});

// ─── Query key factory ────────────────────────────────────────────────────────
// Centralizes all query keys; prevents typos; enables precise invalidation.

export const queryKeys = {
  auth: {
    session: () => ['auth', 'session'] as const,
  },
  parent: {
    profile: (parentId: string) => ['parent', parentId, 'profile'] as const,
  },
  child: {
    all: (parentId: string) => ['child', parentId] as const,
    profile: (childId: string) => ['child', childId, 'profile'] as const,
    calendar: (childId: string, month: string) => ['child', childId, 'calendar', month] as const,
    trophies: (childId: string) => ['child', childId, 'trophies'] as const,
    achievements: (childId: string) => ['child', childId, 'achievements'] as const,
    rewards: (childId: string) => ['child', childId, 'rewards'] as const,
    xpLedger: (childId: string) => ['child', childId, 'xp-ledger'] as const,
  },
  friends: {
    list: (childId: string) => ['friends', childId, 'list'] as const,
    requests: (childId: string) => ['friends', childId, 'requests'] as const,
    suggestions: (childId: string) => ['friends', childId, 'suggestions'] as const,
    rankingWeekly: (childId: string) => ['friends', childId, 'ranking', 'weekly'] as const,
    rankingMonthly: (childId: string) => ['friends', childId, 'ranking', 'monthly'] as const,
  },
  challenge: {
    session: (childId: string, date: string) => ['challenge', childId, date] as const,
  },
} as const;
