import { Redirect } from 'expo-router';

import { useAuthStore, selectAuthStatus } from '@/stores/auth.store';
import { useProfileStore, selectHasActiveChild } from '@/stores/profile.store';
import SplashScreen from '@/components/SplashScreen';

/**
 * Root index — determines where the user should land on app start.
 *
 * Decision tree:
 *   loading            → animated splash screen (Supabase session hydrating)
 *   unauthenticated    → /(auth)/welcome
 *   authenticated
 *     + no active child → /(profile-select)/
 *     + active child    → /(app)/(tabs)/
 */
export default function Index() {
  const status = useAuthStore(selectAuthStatus);
  const hasActiveChild = useProfileStore(selectHasActiveChild);

  if (status === 'loading') {
    return <SplashScreen />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!hasActiveChild) {
    return <Redirect href="/(profile-select)/" />;
  }

  return <Redirect href="/(app)/(tabs)/" />;
}
