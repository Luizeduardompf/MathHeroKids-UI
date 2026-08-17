import { useQuery } from '@tanstack/react-query';

import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import type { ChildProfile } from '@/types';

/**
 * Loads a single child by id, backed by the same `['children', parentId]`
 * cache used across parent-area screens (list is small — one query covers all
 * children/child sub-screens without a dedicated single-row fetch).
 */
export function useChild(childId: string | undefined): {
  child: ChildProfile | null;
  isLoading: boolean;
  isError: boolean;
} {
  const parentId = useAuthStore(selectParentId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['children', parentId],
    queryFn: () => childService.listChildren(parentId!),
    enabled: !!parentId,
  });

  const child = data?.find((c) => c.id === childId) ?? null;
  return { child, isLoading, isError };
}
