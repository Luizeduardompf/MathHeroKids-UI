import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius, space } from '@/theme';
import type { BadgeVariant } from '@/types';

const variantMap: Record<BadgeVariant, { bg: string; textColor: string }> = {
  primary: { bg: colors.primaryLight, textColor: colors.primary },
  accent: { bg: colors.accentLight, textColor: colors.accent },
  success: { bg: colors.successLight, textColor: colors.success },
  error: { bg: colors.errorLight, textColor: colors.error },
  warning: { bg: colors.warningLight, textColor: colors.warning },
  neutral: { bg: colors.background.cardAlt, textColor: colors.text.secondary },
  bronze: { bg: colors.trophy.bronzeLight, textColor: colors.trophy.bronze },
  silver: { bg: colors.trophy.silverLight, textColor: colors.trophy.silver },
  gold: { bg: colors.trophy.goldLight, textColor: colors.trophy.gold },
  diamond: { bg: colors.trophy.diamondLight, textColor: colors.trophy.diamond },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const v = variantMap[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style] as StyleProp<ViewStyle>}>
      <Text variant="label" color={v.textColor}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
});
