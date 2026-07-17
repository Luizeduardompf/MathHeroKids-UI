import { useQuery } from '@tanstack/react-query';

import { chatService } from '@/services/chat.service';

/**
 * Total unread message count for a child, across all conversations.
 * Query key `['unread', childId]` matches the invalidations already
 * fired by the chat screen on read/receive — no extra wiring needed there.
 */
export function useUnreadMessagesCount(childId: string | undefined) {
  return useQuery({
    queryKey: ['unread', childId],
    queryFn: () => chatService.getUnreadCount(childId!),
    enabled: !!childId,
    staleTime: 10_000,
  });
}
