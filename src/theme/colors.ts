/**
 * Math Hero Kids — Color Tokens
 * Extracted from design screenshots. All values are final.
 */

export const palette = {
  // Brand Blue
  blue50: '#EEF1FF',
  blue100: '#DCE2FF',
  blue200: '#BAC4FF',
  blue300: '#8A99FF',
  blue400: '#5B6EFF',
  blue500: '#2B52E5', // Primary — headers, buttons, active states
  blue600: '#1A3DB8',
  blue700: '#122D8C',
  blue800: '#0B1F60',
  blue900: '#060F30',

  // Accent Orange
  orange50: '#FFF3EC',
  orange100: '#FFE0CA',
  orange200: '#FFC299',
  orange300: '#FFA068',
  orange400: '#FF8040',
  orange500: '#F5722A', // Accent — Challenge FAB, streaks, milestones
  orange600: '#D45A18',
  orange700: '#A8430D',
  orange800: '#7A2E06',
  orange900: '#4D1A02',

  // Success Green
  green50: '#DCFCE7',
  green100: '#BBF7D0',
  green200: '#86EFAC',
  green300: '#4ADE80',
  green400: '#22C55E', // Correct answer, completed state
  green500: '#16A34A',
  green600: '#15803D',

  // Error Red
  red50: '#FEE2E2',
  red100: '#FECACA',
  red200: '#FCA5A5',
  red300: '#F87171',
  red400: '#EF4444', // Wrong answer, failed state
  red500: '#DC2626',

  // Warning Yellow
  yellow50: '#FEF3C7',
  yellow100: '#FDE68A',
  yellow200: '#FCD34D',
  yellow300: '#FBBF24',
  yellow400: '#F59E0B', // Gold trophy tier
  yellow500: '#D97706',

  // Neutrals
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  black: '#000000',
} as const;

export const colors = {
  // ─── Primary ────────────────────────────────────────────
  primary: palette.blue500,
  primaryDark: palette.blue600,
  primaryLight: palette.blue50,

  // ─── Accent ─────────────────────────────────────────────
  accent: palette.orange500,
  accentDark: palette.orange600,
  accentLight: palette.orange50,

  // ─── Semantic ───────────────────────────────────────────
  success: palette.green400,
  successLight: palette.green50,
  error: palette.red400,
  errorLight: palette.red50,
  warning: palette.yellow400,
  warningLight: palette.yellow50,

  // ─── Text ───────────────────────────────────────────────
  text: {
    primary: '#1A1F36',   // Dark navy — main text
    secondary: palette.gray500,
    tertiary: palette.gray400,
    inverse: palette.white,
    accent: palette.blue500,
    success: palette.green500,
    error: palette.red400,
    warning: palette.yellow500,
  },

  // ─── Background ─────────────────────────────────────────
  background: {
    primary: '#EEF1FF',   // App background — light lavender-blue
    card: palette.white,
    cardAlt: '#F8F9FF',
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
  },

  // ─── Border ─────────────────────────────────────────────
  border: {
    default: palette.gray200,
    focus: palette.blue500,
    error: palette.red400,
  },

  // ─── Trophy Tiers ───────────────────────────────────────
  trophy: {
    bronze: '#CD7F32',
    bronzeLight: '#F5E6D3',
    silver: '#9EA3AF',
    silverLight: '#ECEEF2',
    gold: palette.yellow400,
    goldLight: palette.yellow50,
    diamond: '#7DD3FC',
    diamondLight: '#E0F2FE',
  },

  // ─── Avatar Initial Colors ───────────────────────────────
  // Used as background for text-based avatars
  avatar: [
    '#EF4444', // red
    '#F97316', // orange
    '#EAB308', // yellow
    '#22C55E', // green
    '#06B6D4', // cyan
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
  ] as const,

  // ─── Tab Bar ────────────────────────────────────────────
  tabBar: {
    background: palette.white,
    active: palette.blue500,
    inactive: palette.gray400,
    border: palette.gray200,
  },

  // ─── Transparent ────────────────────────────────────────
  transparent: 'transparent',
} as const;

export type Colors = typeof colors;
