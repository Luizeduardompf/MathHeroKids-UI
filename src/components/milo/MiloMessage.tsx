import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { colors, radius, shadows, space } from '@/theme';

type MiloVariant = 'blue' | 'orange' | 'green';

const variantGradients: Record<MiloVariant, [string, string]> = {
  blue:   [colors.primary, colors.primaryDark],
  orange: [colors.accent,  colors.accentDark],
  green:  ['#22C55E',      '#15803D'],
};

interface MiloMessageProps {
  message: string;
  variant?: MiloVariant;
  style?: StyleProp<ViewStyle>;
}

export function MiloMessage({ message, variant = 'blue', style }: MiloMessageProps) {
  const { t } = useTranslation();
  const gradient = variantGradients[variant];

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style] as StyleProp<ViewStyle>}
    >
      {/* Decorative circles — match v0 design */}
      <View style={styles.decoTopRight} pointerEvents="none" />
      <View style={styles.decoBottomLeft} pointerEvents="none" />

      {/* Avatar */}
      <View style={styles.avatarRing}>
        <View style={styles.avatar}>
          <Image
            source={require('../../../assets/images/milo-mascot.png')}
            style={styles.miloImage}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Speech bubble */}
      <View style={styles.bubbleWrapper}>
        <Text variant="caption" style={styles.label}>{t('challenge.miloDizLabel')}</Text>
        <View style={styles.bubble}>
          <Text variant="body" style={styles.message} numberOfLines={3}>
            {message}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius['2xl'],
    padding: space.md,
    gap: space.md,
    overflow: 'hidden',
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    } as object),
  },
  decoTopRight: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  decoBottomLeft: {
    position: 'absolute',
    bottom: -32,
    left: 48,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarRing: {
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
    ...({
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    } as object),
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miloImage: { width: 64, height: 64 },
  bubbleWrapper: { flex: 1, gap: 4 },
  label: {
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 10,
    textTransform: 'uppercase',
  } as import('react-native').TextStyle,
  bubble: {
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    borderBottomLeftRadius: 4,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    } as object),
  },
  message: {
    fontWeight: '800',
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  } as import('react-native').TextStyle,
});
