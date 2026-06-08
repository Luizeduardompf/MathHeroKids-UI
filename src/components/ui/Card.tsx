import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, radius, shadows, space } from '@/theme';
import type { Shadow } from '@/theme/shadows';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  shadow?: Shadow;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({
  children,
  onPress,
  shadow = 'sm',
  padding = space.md,
  style,
  accessibilityLabel,
}: CardProps) {
  const baseStyle: ViewStyle = {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    padding,
    ...(shadows[shadow] as ViewStyle),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => [baseStyle, pressed ? styles.pressed : null, style] as StyleProp<ViewStyle>}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style] as StyleProp<ViewStyle>}>{children}</View>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },
});
