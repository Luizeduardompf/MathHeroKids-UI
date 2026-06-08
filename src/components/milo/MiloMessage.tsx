import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icons } from '@/constants/icons';
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
 *
 * Phase 2: replace the emoji with <Image source={miloAsset} /> inside the avatar circle.
 */
export function MiloMessage({ message, variant = 'blue', style }: MiloMessageProps) {
  const v = variantStyles[variant];

  return (
    <View style={[styles.container, { backgroundColor: v.bg }, style] as StyleProp<ViewStyle>}>
      {/* TODO Phase 2: Replace with <Image source={miloAsset} style={styles.miloImage} /> */}
      <View style={styles.avatar}>
        <Text style={styles.emoji}>{Icons.miloAvatar}</Text>
      </View>
      <View style={styles.bubble}>
        <Text variant="caption" style={styles.label}>
          MILO DIZ
        </Text>
        <Text variant="bodyLarge" color={v.textColor} style={styles.message}>
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
    borderRadius: radius['3xl'],
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    minHeight: 80,
  },
  // White circle — Phase 2 will contain the real Milo illustration
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: { fontSize: 36 },
  bubble: { flex: 1, gap: 3 },
  label: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 11,
    textTransform: 'uppercase',
  } as import('react-native').TextStyle,
  message: { fontWeight: '800' },
});
