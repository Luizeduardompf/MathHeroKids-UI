import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { colors, radius, space } from '@/theme';
import type { Shadow } from '@/theme/shadows';
import { shadows } from '@/theme/shadows';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  shadow?: Shadow;
  padding?: number;
  /** Show the default 1px border. Default: true */
  border?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

// ─── Spring config ────────────────────────────────────────────────────────────

const SPRING = { damping: 14, stiffness: 300 };

// ─── Component ───────────────────────────────────────────────────────────────

export function Card({
  children,
  onPress,
  shadow = 'sm',
  padding = space.md,
  border = true,
  style,
  accessibilityLabel,
}: CardProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const baseStyle: ViewStyle = {
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    padding,
    borderWidth: border ? 1 : 0,
    borderColor: colors.border.default,
    ...(shadows[shadow] as ViewStyle),
  };

  // Extra platform shadow for cards with onPress — lifted feel
  const pressedShadow = Platform.select({
    ios: {
      shadowColor: '#1A1F36',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  });

  if (onPress) {
    return (
      <Animated.View style={[animStyle, pressedShadow, style] as StyleProp<ViewStyle>}>
        <Pressable
          onPress={onPress}
          onPressIn={() => { scale.value = withSpring(0.97, SPRING); }}
          onPressOut={() => { scale.value = withSpring(1,    SPRING); }}
          style={[baseStyle] as StyleProp<ViewStyle>}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={[baseStyle, style] as StyleProp<ViewStyle>}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Reserved for future variants
  _placeholder: {},
});
