import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius, space } from '@/theme';
import type { BadgeVariant } from '@/types';
import type { IoniconsName } from './index';

// ─── Variant config ───────────────────────────────────────────────────────────

const variantConfig: Record<
  BadgeVariant,
  { bg: string; textColor: string; borderColor: string }
> = {
  primary:   { bg: colors.primaryLight,          textColor: colors.primary,        borderColor: `${colors.primary}30`        },
  accent:    { bg: colors.accentLight,            textColor: colors.accent,         borderColor: `${colors.accent}30`         },
  success:   { bg: colors.successLight,           textColor: colors.success,        borderColor: `${colors.success}40`        },
  error:     { bg: colors.errorLight,             textColor: colors.error,          borderColor: `${colors.error}30`          },
  warning:   { bg: colors.warningLight,           textColor: colors.warning,        borderColor: `${colors.warning}40`        },
  neutral:   { bg: colors.background.cardAlt,     textColor: colors.text.secondary, borderColor: colors.border.default        },
  bronze:    { bg: colors.trophy.bronzeLight,     textColor: colors.trophy.bronze,  borderColor: `${colors.trophy.bronze}40`  },
  silver:    { bg: colors.trophy.silverLight,     textColor: colors.trophy.silver,  borderColor: `${colors.trophy.silver}50`  },
  gold:      { bg: colors.trophy.goldLight,       textColor: colors.trophy.gold,    borderColor: `${colors.trophy.gold}50`    },
  diamond:   { bg: colors.trophy.diamondLight,    textColor: colors.trophy.diamond, borderColor: `${colors.trophy.diamond}50` },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: IoniconsName;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Badge({ label, variant = 'neutral', icon, style }: BadgeProps) {
  const v = variantConfig[variant];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.bg,
          borderColor: v.borderColor,
        },
        style,
      ] as StyleProp<ViewStyle>}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={11}
          color={v.textColor}
          style={styles.icon}
        />
      )}
      <Text variant="label" color={v.textColor}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 3,
  },
  icon: { marginTop: 0.5 },
});
