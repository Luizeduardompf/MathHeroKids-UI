export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radius';
export * from './shadows';

import { colors } from './colors';
import { fontFamily, textVariants } from './typography';
import { space } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';

export const theme = {
  colors,
  fontFamily,
  textVariants,
  space,
  radius,
  shadows,
} as const;

export type Theme = typeof theme;
