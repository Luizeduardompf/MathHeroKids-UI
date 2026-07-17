import { useEffect, useState } from 'react';
import { useRankingSnapshotStore } from '@/stores/ranking-snapshot.store';
import type { RankedFriend } from '@/services/social.service';

const REPOSITION_DELAY_MS = 400;

function sameOrder(a: RankedFriend[], b: RankedFriend[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.child.id === b[i]?.child.id);
}

/**
 * Mostra primeiro a ordem do ranking como estava na última visita a este ecrã e, se a
 * ordem mudou entretanto, anima o reposicionamento para a ordem atual (o consumidor deve
 * envolver cada item numa Animated.View com `layout={LinearTransition...}` — a mudança de
 * ordem no array devolvido é o que dispara essa animação).
 */
export function useRankingReposition(scopeKey: string, ranked: RankedFriend[]): RankedFriend[] {
  const [displayed, setDisplayed] = useState<RankedFriend[]>(ranked);

  useEffect(() => {
    if (ranked.length === 0) return undefined;

    const prev = useRankingSnapshotStore.getState().lastShown[scopeKey];

    if (prev && !sameOrder(prev, ranked)) {
      setDisplayed(prev);
      const timer = setTimeout(() => {
        setDisplayed(ranked);
        useRankingSnapshotStore.getState().setLastShown(scopeKey, ranked);
      }, REPOSITION_DELAY_MS);
      return () => clearTimeout(timer);
    }

    setDisplayed(ranked);
    useRankingSnapshotStore.getState().setLastShown(scopeKey, ranked);
    return undefined;
  }, [scopeKey, ranked]);

  return displayed;
}
