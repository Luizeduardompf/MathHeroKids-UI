import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
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
import type { IoniconsName } from './index';

const AnimatedView = Animated.View;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  label: string;
  icon?: IoniconsName;
  style?: RNStyleProp<ViewStyle>;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const variantConfig: Record<
  ButtonVariant,
  {
    bg: string;
    textColor: string;
    borderColor?: string;
    shadowColor: string;
    shadowOpacity: number;
  }
> = {
  primary: {
    bg: colors.primary,
    textColor: colors.text.inverse,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
  },
  secondary: {
    bg: colors.background.card,
    textColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
  },
  ghost: {
    bg: colors.transparent,
    textColor: colors.primary,
    shadowColor: 'transparent',
    shadowOpacity: 0,
  },
  destructive: {
    bg: colors.error,
    textColor: colors.text.inverse,
    shadowColor: colors.error,
    shadowOpacity: 0.30,
  },
};

const sizeConfig: Record<
  ButtonSize,
  { height: number; paddingH: number; textVariant: 'button' | 'buttonSm'; iconSize: number }
> = {
  sm: { height: 36, paddingH: space.md,  textVariant: 'buttonSm', iconSize: 16 },
  md: { height: 52, paddingH: space.lg,  textVariant: 'button',   iconSize: 20 },
  lg: { height: 60, paddingH: space.xl,  textVariant: 'button',   iconSize: 22 },
};

// ─── Spring config ────────────────────────────────────────────────────────────

const SPRING_IN  = { damping: 14, stiffness: 300 };
const SPRING_OUT = { damping: 12, stiffness: 200 };

// ─── Component ───────────────────────────────────────────────────────────────

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = true,
  label,
  icon,
  disabled,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const scale     = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const v = variantConfig[variant];
  const s = sizeConfig[size];
  const isDisabled = disabled ?? loading;

  const shadow = Platform.select({
    ios: {
      shadowColor: v.shadowColor,
      shadowOpacity: isDisabled ? 0 : v.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: isDisabled ? 0 : 4 },
    default: {},
  });

  return (
    <AnimatedView
      style={[
        animatedStyle,
        shadow,
        fullWidth ? styles.fullWidth : null,
        style,
      ] as StyleProp<ViewStyle>}
    >
      {/* @ts-expect-error — accessibilityState.busy type divergence in RN 0.85 */}
      <Pressable
        disabled={isDisabled}
        onPressIn={() => {
          scale.value      = withSpring(0.96, SPRING_IN);
          translateY.value = withSpring(2,    SPRING_IN);
        }}
        onPressOut={() => {
          scale.value      = withSpring(1, SPRING_OUT);
          translateY.value = withSpring(0, SPRING_OUT);
        }}
        onPress={onPress as PressableProps['onPress']}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        style={styles.pressable}
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
            <>
              {icon && (
                <Ionicons
                  name={icon}
                  size={s.iconSize}
                  color={v.textColor}
                  style={styles.icon}
                />
              )}
              <Text variant={s.textVariant} color={v.textColor}>
                {label}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  pressable: { width: '100%' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  icon: { marginRight: 2 },
});
