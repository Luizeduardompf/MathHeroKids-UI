import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
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
import type { SupportedLocale } from '@/constants/config';
import SplashScreen from '@/components/SplashScreen';

// Keep the splash screen visible while we load resources
ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore error — Expo Go sometimes throws if splash already hidden
});

function AuthListener() {
  useAuthListener();
  return null;
}

// Tempo mínimo (ms) que o splash custom fica visível após o bundle JS carregar.
// Garante que o utilizador vê a animação mesmo quando tudo carrega muito rápido.
const MIN_SPLASH_MS = 5000;

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  // Tempo mínimo de exibição do splash (independente de fontes/auth)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

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

  // Tempo mínimo do splash
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Safety timeout — never block the app for more than 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const fontsReady = fontsLoaded || !!fontError || timedOut;
  const appReady = fontsReady && (i18nReady || timedOut);

  // Só sai do splash quando TUDO estiver pronto: fontes + i18n + tempo mínimo
  const splashDone = appReady && minTimeElapsed;

  // Hide native splash apenas quando splashDone
  useEffect(() => {
    if (splashDone) {
      ExpoSplashScreen.hideAsync().catch(() => {
        // Ignore error — safe in Expo Go
      });
    }
  }, [splashDone]);

  // Mostra splash custom enquanto carrega OU enquanto tempo mínimo não passou
  if (!splashDone) {
    return <SplashScreen />;
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
