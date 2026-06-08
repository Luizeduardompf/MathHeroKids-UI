/**
 * Challenge tab — redirects immediately to today's challenge screen.
 * The actual gameplay lives in app/(app)/challenge/[date].tsx.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ChallengTab() {
  const router = useRouter();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]!;
    // Replace so the tab doesn't appear in the back stack
    router.replace(`/(app)/challenge/${today}`);
  }, [router]);

  return null;
}
