import { Platform } from 'react-native';

/**
 * Math Hero Kids — Shadow Tokens
 * Cross-platform (iOS boxShadow, Android elevation).
 */

const makeShadow = (
  elevation: number,
  color = '#1A1F36',
  opacity: number,
  radius: number,
  offsetY: number,
) => ({
  ...Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: {
      elevation,
    },
    default: {},
  }),
});

export const shadows = {
  none: {},
  xs: makeShadow(1, '#1A1F36', 0.04, 2, 1),
  sm: makeShadow(2, '#1A1F36', 0.06, 4, 2),
  md: makeShadow(4, '#1A1F36', 0.08, 8, 4),
  lg: makeShadow(8, '#1A1F36', 0.10, 16, 8),
  xl: makeShadow(12, '#1A1F36', 0.12, 24, 12),
} as const;

export type Shadow = keyof typeof shadows;
