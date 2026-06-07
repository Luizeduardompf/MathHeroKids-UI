import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  scrollViewProps?: ScrollViewProps;
  edges?: Edge[];
}

/**
 * Base screen wrapper.
 * Uses SafeAreaView for inset handling and a plain View for styling,
 * since react-native-safe-area-context v5 moved style to NativeSafeAreaViewProps
 * which may not be in the type surface depending on resolution.
 */
export function Screen({
  children,
  scrollable = false,
  padded = true,
  backgroundColor = colors.background.primary,
  style,
  scrollViewProps,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  const paddingStyle = padded ? styles.padded : undefined;

  const inner = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, paddingStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, paddingStyle, style]}>{children}</View>
  );

  return (
    // SafeAreaView without style prop — use wrapping View for background
    <View style={[styles.safe, { backgroundColor }]}>
      <SafeAreaView edges={edges}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: space.md },
  scrollContent: { flexGrow: 1 },
});
