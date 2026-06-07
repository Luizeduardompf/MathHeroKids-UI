/**
 * Math Hero Kids — Border Radius Tokens
 */
export const radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export type Radius = keyof typeof radius;
