import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { queryClient } from '@/lib/query-client';
import { initI18n, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { useAuthListener } from '@/hooks/use-auth';
import { colors } from '@/theme';
import type { SupportedLocale } from '@/constants/config';

// Keep the splash screen visible while we load resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore error — Expo Go sometimes throws if splash already hidden
});

function AuthListener() {
  useAuthListener();
  return null;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    ...Ionicons.font, // loads Ionicons.ttf — prevents fallback glyph rendering
  });

  // Initialize i18n — read saved locale from AsyncStorage first (no device auto-detect)
  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((saved) => initI18n((saved as SupportedLocale) ?? undefined))
      .catch(() => initI18n())
      .finally(() => setI18nReady(true));
  }, []);

  // Safety timeout — never block the app for more than 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const fontsReady = fontsLoaded || !!fontError || timedOut;
  const appReady = fontsReady && (i18nReady || timedOut);

  // Hide splash screen once everything is ready (or timed out)
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore error — safe in Expo Go
      });
    }
  }, [appReady]);

  if (!appReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color={colors.text.inverse} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthListener />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(profile-select)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
