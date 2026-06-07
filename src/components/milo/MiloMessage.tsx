import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, space } from '@/theme';

type MiloVariant = 'blue' | 'orange' | 'green';

const variantStyles: Record<MiloVariant, { bg: string; textColor: string }> = {
  blue: { bg: colors.primary, textColor: colors.text.inverse },
  orange: { bg: colors.accent, textColor: colors.text.inverse },
  green: { bg: colors.success, textColor: colors.text.inverse },
};

interface MiloMessageProps {
  message: string;
  variant?: MiloVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * Milo the mascot speech bubble.
 * Appears on auth screens, challenge feedback, achievements, etc.
 *
 * Phase 2: replace the placeholder emoji with the actual Milo illustration asset.
 */
export function MiloMessage({ message, variant = 'blue', style }: MiloMessageProps) {
  const v = variantStyles[variant];

  return (
    <View style={[styles.container, { backgroundColor: v.bg }, style]}>
      {/* TODO Phase 2: Replace with <Image source={miloAsset} /> */}
      <View style={styles.avatar}>
        <Text style={styles.emoji}>🧙</Text>
      </View>
      <View style={styles.bubble}>
        <Text variant="caption" color={colors.text.tertiary} style={styles.label}>
          MILO DIZ
        </Text>
        <Text variant="body" color={v.textColor} style={styles.message}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  bubble: { flex: 1, gap: 2 },
  label: { opacity: 0.8, fontWeight: '700', letterSpacing: 0.5 },
  message: { fontWeight: '700' },
});
