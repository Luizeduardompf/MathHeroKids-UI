import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { colors } from '@/theme';
import { useAuthStore, selectAuthStatus } from '@/stores/auth.store';
import { useProfileStore, selectHasActiveChild } from '@/stores/profile.store';

/**
 * Auth layout guard — redirects authenticated users away from auth screens.
 * Necessary because app/index.tsx is no longer mounted after the initial
 * redirect to /(auth)/welcome, so it can't react to auth state changes.
 */
function AuthGuard() {
  const router = useRouter();
  const status = useAuthStore(selectAuthStatus);
  const hasActiveChild = useProfileStore(selectHasActiveChild);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(hasActiveChild ? '/(app)/(tabs)/' : '/(profile-select)/');
    }
  }, [status, hasActiveChild, router]);

  return null;
}

export default function AuthLayout() {
  return (
    <>
      <AuthGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.primary },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
