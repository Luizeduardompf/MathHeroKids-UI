import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { StyleProp as RNStyleProp } from 'react-native';

import { Text } from './Text';
import { colors, radius, space } from '@/theme';
import type { ButtonVariant, ButtonSize } from '@/types';

// Animated.View wrapping Pressable — mais fiável que createAnimatedComponent(Pressable)
// no Reanimated 4 + React 19 onde o onPress pode não propagar.
const AnimatedView = Animated.View;

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  label: string;
  style?: RNStyleProp<ViewStyle>;
}

const variantStyles: Record<
  ButtonVariant,
  { bg: string; textColor: string; borderColor?: string }
> = {
  primary:     { bg: colors.primary,          textColor: colors.text.inverse },
  secondary:   { bg: colors.background.card,  textColor: colors.primary, borderColor: colors.primary },
  ghost:       { bg: colors.transparent,       textColor: colors.primary },
  destructive: { bg: colors.error,             textColor: colors.text.inverse },
};

const sizeStyles: Record<ButtonSize, { height: number; paddingH: number; textVariant: 'button' | 'buttonSm' }> = {
  sm: { height: 36, paddingH: space.md,  textVariant: 'buttonSm' },
  md: { height: 52, paddingH: space.lg,  textVariant: 'button'   },
  lg: { height: 60, paddingH: space.xl,  textVariant: 'button'   },
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
    <AnimatedView
      style={[animatedStyle, fullWidth ? styles.fullWidth : null, style] as StyleProp<ViewStyle>}
    >
      {/* @ts-expect-error — accessibilityState.busy type divergence in RN 0.85 */}
      <Pressable
        disabled={isDisabled}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 15 }); }}
        onPress={onPress as PressableProps['onPress']}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        style={styles.pressable}
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
      </Pressable>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  fullWidth:  { width: '100%' },
  pressable:  { width: '100%' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
