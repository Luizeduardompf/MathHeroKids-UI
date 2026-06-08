/**
 * Central icon registry.
 *
 * All emoji literals used across the app live here.
 * Import `Icons` and reference by name — never hardcode an emoji inline.
 *
 * Phase 2: avatar icons will be replaced by real <Image> assets.
 * When that happens, update AVATAR_ICONS here; no other file changes needed.
 */

import type { AvatarId } from './config';

// ─── Main icon map ────────────────────────────────────────────────────────────

export const Icons = {
  // Navigation / Tab Bar
  home: '🏠',
  calendar: '📅',
  challengeTab: '✖',   // FAB button in tab bar
  friends: '👥',
  settings: '⚙️',

  // Gamification / Progress
  trophy: '🏆',
  star: '⭐',
  xp: '⚡',
  chart: '📈',
  gift: '🎁',
  gold: '🥇',

  // Milo (mascote)
  milo: '🧙‍♂️',      // full wizard + variation selector (welcome, challenge milestones)
  miloAvatar: '🧙',  // wizard without variation selector (MiloMessage speech bubble)

  // Challenge feedback
  timerExpired: '⏰',
  wrongAnswer: '😅',

  // UI controls
  closeButton: '✕',  // in-screen dismiss / exit (challenge header)
  backspace: '⌫',    // numeric keypad delete

  // People / Social
  addFriend: '👤',
  newChild: '👶',

  // Parent area
  locked: '🔒',
  pinCode: '🔐',

  // Avatars — temporary until real assets land (Phase 2)
  avatarSofia: '👧',
  avatarGabriel: '👦',
  avatarPedro: '🧒',
  avatarAna: '👧🏽',
  avatarTheo: '👦🏻',
  avatarMia: '👧🏼',

  // Input / Password
  passwordShow: '👁',
  passwordHide: '🙈',
} as const;

export type IconKey = keyof typeof Icons;

// ─── Avatar icon lookup ───────────────────────────────────────────────────────

/**
 * Maps each AvatarId to its temporary emoji representation.
 * Replace values here when real image assets are ready (Phase 2).
 */
export const AVATAR_ICONS: Record<AvatarId, string> = {
  sofia:   Icons.avatarSofia,
  gabriel: Icons.avatarGabriel,
  pedro:   Icons.avatarPedro,
  ana:     Icons.avatarAna,
  theo:    Icons.avatarTheo,
  mia:     Icons.avatarMia,
};
