import { theme } from '@/theme';
import type { Theme } from '@/theme';

/**
 * Returns the app theme. No-op hook for now (no dynamic theming in MVP).
 * Centralizes the theme access pattern so dark mode can be added later
 * by updating only this hook.
 */
export function useTheme(): Theme {
  return theme;
}
