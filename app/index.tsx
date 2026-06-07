import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuthStore, selectAuthStatus } from '@/stores/auth.store';
import { useProfileStore, selectHasActiveChild } from '@/stores/profile.store';
import { colors } from '@/theme';

/**
 * Root index — determines where the user should land on app start.
 *
 * Decision tree:
 *   loading            → spinner (Supabase session is being hydrated from storage)
 *   unauthenticated    → /(auth)/welcome
 *   authenticated
 *     + no active child → /(profile-select)/
 *     + active child    → /(app)/(tabs)/
 */
export default function Index() {
  const status = useAuthStore(selectAuthStatus);
  const hasActiveChild = useProfileStore(selectHasActiveChild);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color={colors.text.inverse} size="large" />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!hasActiveChild) {
    return <Redirect href="/(profile-select)/" />;
  }

  return <Redirect href="/(app)/(tabs)/" />;
}
