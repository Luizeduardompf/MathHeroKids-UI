/**
 * Math Hero Kids — Spacing Tokens
 * 4px base grid.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

// Named aliases for common use
export const space = {
  none: spacing[0],
  xs: spacing[1],    // 4
  sm: spacing[2],    // 8
  md: spacing[4],    // 16
  lg: spacing[6],    // 24
  xl: spacing[8],    // 32
  '2xl': spacing[12], // 48
  '3xl': spacing[16], // 64
} as const;

export type Spacing = keyof typeof spacing;
