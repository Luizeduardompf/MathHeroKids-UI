import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  createAnimatedComponent,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { Text } from './Text';
import { colors, radius, space } from '@/theme';
import type { ButtonVariant, ButtonSize } from '@/types';

// Use direct createAnimatedComponent import (more robust in Reanimated 4.x)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedPressable = createAnimatedComponent(Pressable as any) as React.ComponentType<PressableProps & { style?: StyleProp<ViewStyle>; children?: React.ReactNode }>;

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
}

const variantStyles: Record<
  ButtonVariant,
  { bg: string; textColor: string; borderColor?: string }
> = {
  primary: { bg: colors.primary, textColor: colors.text.inverse },
  secondary: {
    bg: colors.background.card,
    textColor: colors.primary,
    borderColor: colors.primary,
  },
  ghost: { bg: colors.transparent, textColor: colors.primary },
  destructive: { bg: colors.error, textColor: colors.text.inverse },
};

const sizeStyles: Record<ButtonSize, { height: number; paddingH: number; textVariant: 'button' | 'buttonSm' }> = {
  sm: { height: 36, paddingH: space.md, textVariant: 'buttonSm' },
  md: { height: 52, paddingH: space.lg, textVariant: 'button' },
  lg: { height: 60, paddingH: space.xl, textVariant: 'button' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = true,
  label,
  disabled,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled ?? loading;

  return (
    // @ts-expect-error — React 19 + Reanimated 4 animated component JSX type mismatch; safe at runtime
    <AnimatedPressable
      style={[animatedStyle, fullWidth ? styles.fullWidth : null, style] as StyleProp<ViewStyle>}
      disabled={isDisabled}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      <View
        style={[
          styles.inner,
          {
            backgroundColor: v.bg,
            height: s.height,
            paddingHorizontal: s.paddingH,
            borderRadius: radius.full,
            borderWidth: v.borderColor ? 1.5 : 0,
            borderColor: v.borderColor,
            opacity: isDisabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.textColor} size="small" />
        ) : (
          <Text variant={s.textVariant} color={v.textColor}>
            {label}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
