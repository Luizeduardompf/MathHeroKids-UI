/**
 * Challenge gameplay screen — pixel-faithful to design exports.
 *
 * Route: /challenge/YYYY-MM-DD
 * Param: date — ISO date string of the challenge
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
// @ts-expect-error TS6/RN0.85 quirk — Image, Alert present at runtime
import { Alert, Image } from 'react-native'; // eslint-disable-line
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated Easing named-export quirk
import { Easing } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withDelay named-export quirk
import { withDelay } from 'react-native-reanimated'; // eslint-disable-line
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';

import { ConfirmDialog, Text } from '@/components/ui';
import { colors, fontFamily, radius, space, shadows } from '@/theme';
import { CorrectOverlay } from '@/components/challenge/CorrectOverlay';
import { CompletedScreen } from '@/components/challenge/CompletedScreen';
import { CelebrationTransition } from '@/components/challenge/CelebrationTransition';
import { LevelUpModal } from '@/components/challenge/LevelUpModal';
import { TrophyEarnedModal } from '@/components/challenge/TrophyEarnedModal';
import type { Achievement, LevelReward, Trophy } from '@/types/database.types';
import {
  TimeExpiredScreen,
  WrongAnswerScreen,
  BlockEndScreen,
} from '@/components/challenge/StatusScreens';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import {
  useChallengeStore,
  selectCurrentQuestion,
  selectProgressFraction,
  selectAllAnswers,
  selectSessionXp,
  selectUniqueCorrectCount,
} from '@/stores/challenge.store';
import { challengeService } from '@/services/challenge.service';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { MODULE_ID, CHALLENGE } from '@/constants/config';

// ─── Milo celebrate asset ─────────────────────────────────────────────────────
const MILO_CELEBRATE = require('../../../assets/images/milo-celebrate.png') as number;

// ─── UUID helper ──────────────────────────────────────────────────────────────

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Confetti animado (MilestoneScreen) ───────────────────────────────────────

const CONFETTI_COLORS = ['#2B52E5', '#F5722A', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'];
const CONFETTI_COUNT = 40;

type MPiece = { x: number; startY: number; color: string; size: number; aspect: number; delay: number; dur: number };

function buildMilestoneConfetti(n: number): MPiece[] {
  let s = 77;
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => ({
    x:      r() * 94,
    startY: -(10 + r() * 80),
    color:  CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    size:   6 + r() * 9,
    aspect: r() > 0.5 ? 1 : 2.5,
    delay:  r() * 350,
    dur:    1600 + r() * 900,
  }));
}

const MILESTONE_CONFETTI = buildMilestoneConfetti(CONFETTI_COUNT);

function MilestoneConfettoPiece({ piece }: { piece: MPiece }) {
  const y       = useSharedValue(0);
  const rot     = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const run = () => {
      y.value     = withTiming(900, { duration: piece.dur, easing: Easing.linear });
      rot.value   = withTiming(720, { duration: piece.dur, easing: Easing.linear });
      const fadeStart = Math.round(piece.dur * 0.65);
      const fadeDur   = piece.dur - fadeStart;
      opacity.value   = withDelay(fadeStart, withTiming(0, { duration: fadeDur, easing: Easing.linear }));
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (piece.delay > 0) {
      timer = setTimeout(run, piece.delay);
    } else {
      run();
    }
    return () => { if (timer !== undefined) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: y.value },
      { rotate: `${rot.value}deg` as unknown as number },
    ],
  }));

  const isRound = piece.aspect <= 1.4;

  return (
    <Animated.View
      style={[
        {
          position:        'absolute',
          left:            `${piece.x}%` as unknown as number,
          top:             piece.startY,
          width:           piece.size,
          height:          piece.size * piece.aspect,
          borderRadius:    isRound ? piece.size / 2 : 3,
          backgroundColor: piece.color,
        },
        anim,
      ] as StyleProp<ViewStyle>}
    />
  );
}

function Confetti() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {MILESTONE_CONFETTI.map((p, i) => (
        <MilestoneConfettoPiece key={i} piece={p} />
      ))}
    </View>
  );
}

// ─── Milestone / Completed full-screen component ──────────────────────────────

type MilestoneVariant = 'q5' | 'q10' | 'q15' | 'completed';

// MILESTONE_CFG now only holds visual/numeric data — text comes from i18n
const MILESTONE_CFG: Record<MilestoneVariant, {
  bg: string;
  badgeBg: string;
  badgeIcon: 'star' | 'trophy';
  titleKey: string;
  subtitleKey: string;
  questions: number;
  pct: number;
  xp: number;
}> = {
  q5: {
    bg: '#2B52E5', badgeBg: '#2B52E5', badgeIcon: 'star',
    titleKey: 'challenge.milestone.q5.title',
    subtitleKey: 'challenge.milestone.q5.subtitle',
    questions: 5, pct: 25, xp: 50,
  },
  q10: {
    bg: '#F5722A', badgeBg: '#F5722A', badgeIcon: 'star',
    titleKey: 'challenge.milestone.q10.title',
    subtitleKey: 'challenge.milestone.q10.subtitle',
    questions: 10, pct: 50, xp: 100,
  },
  q15: {
    bg: '#16A34A', badgeBg: '#16A34A', badgeIcon: 'star',
    titleKey: 'challenge.milestone.q15.title',
    subtitleKey: 'challenge.milestone.q15.subtitle',
    questions: 15, pct: 75, xp: 150,
  },
  completed: {
    bg: '#F59E0B', badgeBg: '#D97706', badgeIcon: 'trophy',
    titleKey: 'challenge.completed.title',
    subtitleKey: 'challenge.completed.subtitle',
    questions: 20, pct: 100, xp: 300,
  },
};

function MilestoneScreen({
  variant,
  xpOverride,
  questionsCorrect,
  onContinue,
  isLoading,
}: {
  variant: MilestoneVariant;  // eslint-disable-line
  xpOverride?: number;
  questionsCorrect?: number;
  onContinue: () => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const cfg = MILESTONE_CFG[variant];
  const xp = xpOverride ?? cfg.xp;
  const qs = questionsCorrect ?? cfg.questions;
  const pct = Math.round((qs / (useChallengeStore.getState().totalQuestions || CHALLENGE.TOTAL_QUESTIONS)) * 100);

  return (
    <View style={[msStyles.root, { backgroundColor: cfg.bg }]}>
      {/* Confetti */}
      <Confetti />

      {/* XP badge — top right */}
      <View style={msStyles.xpBadge}>
        <Ionicons name="flash" size={14} color="#78350F" style={{ marginRight: 3 }} />
        <Text style={msStyles.xpBadgeText}>+{xp} XP</Text>
      </View>

      {/* Decorative stars */}
      <View style={msStyles.starTopLeft}>
        <Ionicons name="star" size={32} color="rgba(255,255,255,0.85)" />
      </View>

      {/* Sparkle — top right area */}
      <View style={msStyles.sparkleTopRight}>
        <Ionicons name="sparkles" size={36} color="rgba(255,255,255,0.75)" />
      </View>

      {/* Content */}
      <View style={msStyles.content}>
        {/* Milo circle with badge */}
        <View style={msStyles.miloOuter}>
          <View style={msStyles.miloRing}>
            <View style={msStyles.miloCircle}>
              <Image source={MILO_CELEBRATE} style={msStyles.miloImg} resizeMode="contain" />
            </View>
          </View>
          {/* Star or trophy badge */}
          <View style={[msStyles.miloBadge, { backgroundColor: cfg.badgeBg }]}>
            <Ionicons
              name={cfg.badgeIcon === 'star' ? 'star' : 'trophy'}
              size={22}
              color="#fff"
            />
          </View>
        </View>

        {/* Title */}
        <Text style={msStyles.title}>{t(cfg.titleKey)}</Text>
        <Text style={msStyles.subtitle}>{t(cfg.subtitleKey)}</Text>

        {/* Progress */}
        <View style={msStyles.progressSection}>
          <View style={msStyles.progressRow}>
            <Text style={msStyles.progressCount}>
              {t('challenge.completed.questionsLabel', { done: qs, total: useChallengeStore.getState().totalQuestions || CHALLENGE.TOTAL_QUESTIONS })}
            </Text>
            <Text style={msStyles.progressPct}>{pct}%</Text>
          </View>
          <View style={msStyles.progressTrack}>
            <View style={[msStyles.progressFill, { width: `${pct}%` as `${number}%` }]} />
          </View>
        </View>

        {/* Button */}
        {isLoading ? (
          <ActivityIndicator color="#fff" size="large" style={{ marginTop: 24 }} />
        ) : (
          <Pressable style={msStyles.continueBtn} onPress={onContinue}>
            <Text style={[msStyles.continueBtnText, { color: cfg.bg }]}>{t('common.continue')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const msStyles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  // ── Decorations ─────────────────────────────────────────────────────────────
  xpBadge: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  xpBadgeText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    color: '#78350F',
    letterSpacing: 0.2,
  },
  starTopLeft: {
    position: 'absolute',
    top: 80,
    left: 28,
    zIndex: 5,
  },
  sparkleTopRight: {
    position: 'absolute',
    top: 110,
    right: 32,
    zIndex: 5,
  },
  // ── Content ─────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 4,
  },
  // ── Milo ────────────────────────────────────────────────────────────────────
  miloOuter: {
    position: 'relative',
    marginBottom: 24,
  },
  miloRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.20)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miloCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miloImg: {
    width: 175,
    height: 175,
  },
  miloBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // ── Text ────────────────────────────────────────────────────────────────────
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 40,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 46,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.90)',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  // ── Progress ─────────────────────────────────────────────────────────────────
  progressSection: {
    width: '100%',
    marginTop: 24,
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressCount: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.90)',
  },
  progressPct: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.90)',
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#fff',
    borderRadius: 999,
  },
  // ── Button ──────────────────────────────────────────────────────────────────
  continueBtn: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 999,
    height: 56,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  continueBtnText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
  },
});

// ─── Milo Box ─────────────────────────────────────────────────────────────────

function MiloBox({ message, bg }: { message: string; bg: string }) {
  const { t } = useTranslation();
  return (
    <View style={[miloBoxStyles.box, { backgroundColor: bg }]}>
      <View style={miloBoxStyles.avatarWrap}>
        <Image source={MILO_CELEBRATE} style={miloBoxStyles.avatar} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={miloBoxStyles.label}>{t('challenge.miloDizLabel')}</Text>
        <Text style={miloBoxStyles.message}>{message}</Text>
      </View>
    </View>
  );
}

const miloBoxStyles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    alignItems: 'center',
    width: '100%',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 40, height: 40 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  message: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
});

// ─── Timer hook ───────────────────────────────────────────────────────────────

function useTimer(seconds: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  // Tracks whether onExpire was already fired for the current run
  const firedRef = useRef(false);

  const reset = useCallback(() => setRemaining(seconds), [seconds]);

  useEffect(() => {
    if (!active || seconds === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    firedRef.current = false;
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      // Pure updater — no side effects inside
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, seconds]);

  // Fire onExpire outside of the state updater to avoid the
  // "Cannot update a component while rendering" React warning.
  useEffect(() => {
    if (remaining === 0 && active && !firedRef.current) {
      firedRef.current = true;
      onExpireRef.current();
    }
  }, [remaining, active]);

  return { remaining, reset };
}

// ─── Numeric Keypad ───────────────────────────────────────────────────────────

function NumericKeypad({
  onDigit,
  onDelete,
  onSubmit,
  hasInput = false,
  disabled = false,
}: {
  onDigit: (d: number) => void;
  onDelete: () => void;
  onSubmit?: () => void;
  hasInput?: boolean;
  disabled?: boolean;
}) {
  const { t }   = useTranslation();
  const topKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  return (
    <View style={kpStyles.keypad}>
      {topKeys.map((k) => (
        <Pressable
          key={k}
          style={({ pressed }) =>
            [kpStyles.key, pressed && !disabled ? kpStyles.keyPressed : null, disabled ? kpStyles.keyDisabled : null] as StyleProp<ViewStyle>
          }
          onPress={() => { if (!disabled) onDigit(k); }}
          accessibilityLabel={String(k)}
        >
          <Text style={kpStyles.keyText}>{k}</Text>
        </Pressable>
      ))}
      {/* Row 4: ⌫ | 0 | ✓ */}
      <Pressable
        style={({ pressed }) =>
          [kpStyles.key, kpStyles.keyMuted, pressed && !disabled ? kpStyles.keyPressed : null, disabled ? kpStyles.keyDisabled : null] as StyleProp<ViewStyle>
        }
        onPress={() => { if (!disabled) onDelete(); }}
        accessibilityLabel={t('common.delete')}
      >
        <Ionicons name="backspace-outline" size={26} color="#6B7280" />
      </Pressable>
      <Pressable
        style={({ pressed }) =>
          [kpStyles.key, pressed && !disabled ? kpStyles.keyPressed : null, disabled ? kpStyles.keyDisabled : null] as StyleProp<ViewStyle>
        }
        onPress={() => { if (!disabled) onDigit(0); }}
        accessibilityLabel="0"
      >
        <Text style={kpStyles.keyText}>0</Text>
      </Pressable>
      {/* Confirm button — always visible, dimmed until there's input */}
      <Pressable
        style={({ pressed }) =>
          [
            kpStyles.key,
            kpStyles.keyConfirm,
            !hasInput ? kpStyles.keyConfirmDisabled : null,
            pressed && hasInput ? kpStyles.keyPressed : null,
          ] as StyleProp<ViewStyle>
        }
        onPress={() => { if (hasInput && onSubmit) onSubmit(); }}
        accessibilityLabel={t('common.confirm')}
        accessibilityState={{ disabled: !hasInput }}
      >
        <Ionicons name="checkmark" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Keypad styles — port do zip numeric-keypad.tsx ──────────────────────────
// grid grid-cols-3 gap-2.5
const kpStyles = StyleSheet.create({
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,                   // gap-2.5
    paddingHorizontal: 0,
    paddingBottom: 4,
  },
  // h-[clamp(3.25rem,9vh,4.5rem)] rounded-2xl shadow-sm → ~72px on iPhone 15
  key: {
    width: '30%',
    height: 72,
    backgroundColor: '#FFFFFF', // bg-card
    borderRadius: 16,           // rounded-2xl
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  // bg-muted text-ink-muted (backspace)
  keyMuted: {
    backgroundColor: '#EDEEF5',
  },
  // bg-brand-green text-white (confirm)
  keyConfirm: {
    backgroundColor: '#22C55E',
  },
  keyConfirmDisabled: { opacity: 0.5 },
  keyPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  keyDisabled: { opacity: 0.35 },
  // text-3xl font-black text-ink
  keyText: {
    fontFamily: fontFamily.bold,  // 700 — mais legível que ExtraBold no iOS
    fontSize: 28,
    lineHeight: 34,               // linha explícita evita clipping
    color: '#1A1F36',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChallengeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { date, retroactive } = useLocalSearchParams<{ date: string; retroactive?: string }>();
  const isRetroactive = retroactive === '1';
  const child = useProfileStore(selectActiveChild);
  const network = useNetworkStatus();

  const phase = useChallengeStore((s) => s.phase);
  const sessionId = useChallengeStore((s) => s.sessionId);
  const challengeDate = useChallengeStore((s) => s.challengeDate);
  const moduleId = useChallengeStore((s) => s.moduleId);
  const currentQuestionIndex = useChallengeStore((s) => s.currentQuestionIndex);
  const totalQuestions = useChallengeStore((s) => s.totalQuestions);
  const lastCorrectAnswer = useChallengeStore((s) => s.lastCorrectAnswer);
  const lastUserAnswer = useChallengeStore((s) => s.lastUserAnswer);
  const lastAnsweredQuestion = useChallengeStore((s) => s.lastAnsweredQuestion);

  const storeActions = useChallengeStore(
    useShallow((s) => ({
      setPhase: s.setPhase,
      startSession: s.startSession,
      submitAnswer: s.submitAnswer,
      retryBlock: s.retryBlock,
      advanceAfterWrong: s.advanceAfterWrong,
      dismissMilestone: s.dismissMilestone,
      markQuestionStart: s.markQuestionStart,
      reset: s.reset,
    })),
  );

  const question = useChallengeStore(selectCurrentQuestion);
  const progress = useChallengeStore(selectProgressFraction);
  const allAnswers = useChallengeStore(selectAllAnswers);
  const sessionXp = useChallengeStore(selectSessionXp);
  const uniqueCorrect = useChallengeStore(selectUniqueCorrectCount);

  const [inputDigits, setInputDigits] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Phase 3 — celebrações pós-challenge
  const [levelUpData, setLevelUpData] = useState<{
    newLevel: number;
    xpEarned: number;
    reward?: LevelReward | null;
  } | null>(null);
  const [earnedItems, setEarnedItems] = useState<
    Array<{ type: 'trophy'; data: Trophy } | { type: 'achievement'; data: Achievement }>
  >([]);
  const pendingNavRef = useRef<(() => void) | null>(null);

  // Animations
  const progressWidth = useSharedValue(0);
  const questionScale = useSharedValue(1);

  useEffect(() => {
    progressWidth.value = withTiming(progress, { duration: 350 });
  }, [progress, progressWidth]);

  const animatedProgress = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as `${number}%`,
  }));
  const animatedQuestion = useAnimatedStyle(() => ({
    transform: [{ scale: questionScale.value }],
  }));

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!child || !date || phase !== 'idle') return;
    async function init() {
      if (!child || !date) return;
      storeActions.setPhase('loading');

      // Phase 2.5+: challenge é online-only. Verificar conexão antes de tentar.
      if (!network.isConnected) {
        storeActions.setPhase('error');
        return;
      }

      const sid = randomUUID();

      try {
        // Questões geradas adaptativamente pelo servidor
        const result = await challengeService.startChallenge({
          childId: child.id,
          challengeDate: date,
          moduleId: MODULE_ID.MULTIPLICATION,
          sessionId: sid,
          timerSeconds: child.timer_seconds,
        });

        // Mapear ChallengeQuestion[] → Question[] (formato do store)
        const questions = result.questions.map((q) => ({
          index: q.position - 1,
          operand_a: q.operand_a,
          operand_b: q.operand_b,
          correct_answer: q.operand_a * q.operand_b,
          fact_id: q.fact_id,
        }));

        storeActions.startSession({
          sessionId: result.sessionId,
          childId: child.id,
          challengeDate: date,
          moduleId: MODULE_ID.MULTIPLICATION,
          questions,
          timerSeconds: child.timer_seconds,
          totalQuestions: questions.length,
        });
      } catch (e) {
        console.error('[Challenge] start_challenge falhou:', e);
        storeActions.setPhase('error');
      }
    }
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, date, phase, network.isConnected]);

  // ─── Timer ───────────────────────────────────────────────────────────────

  const handleTimerExpire = useCallback(() => {
    if (useChallengeStore.getState().phase !== 'playing') return;
    useChallengeStore.getState().submitAnswer(null);
    setInputDigits([]);
  }, []);

  const { remaining, reset: resetTimer } = useTimer(
    child?.timer_seconds ?? 15,
    phase === 'playing',
    handleTimerExpire,
  );

  useEffect(() => {
    if (phase === 'playing') {
      resetTimer();
      storeActions.markQuestionStart();
      setInputDigits([]);
      questionScale.value = withSpring(0.94, { damping: 8 });
      setTimeout(() => { questionScale.value = withSpring(1, { damping: 14 }); }, 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, phase]);

  // Auto-advance correct overlay after 3000ms (temporariamente aumentado para screenshot)
  useEffect(() => {
    if (phase !== 'correct') return;
    const timer = setTimeout(() => {
      if (useChallengeStore.getState().phase === 'correct') {
        useChallengeStore.getState().setPhase('playing');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase]);

  // ─── Input ───────────────────────────────────────────────────────────────

  const handleDigit = useCallback((d: number) => {
    if (useChallengeStore.getState().phase !== 'playing') return;
    setInputDigits((prev) => prev.length >= 3 ? prev : [...prev, d]);
  }, []);

  const handleDelete = useCallback(() => setInputDigits((p) => p.slice(0, -1)), []);

  const handleSubmit = useCallback(() => {
    const s = useChallengeStore.getState();
    if (s.phase !== 'playing') return;
    setInputDigits((prev) => {
      if (prev.length === 0) return prev;
      s.submitAnswer(parseInt(prev.join(''), 10));
      return [];
    });
  }, []);

  useEffect(() => {
    if (inputDigits.length === 3) handleSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputDigits]);

  // ─── Complete ────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async () => {
    if (!child || !sessionId) return;
    setIsSubmitting(true);
    storeActions.setPhase('submitting');

    // Guardar completion local — garante que o calendário mostra o estado correcto
    const isPerfectLocal = uniqueCorrect === useChallengeStore.getState().totalQuestions;
    await challengeService.storeLocalCompletion(child.id, challengeDate!, isPerfectLocal, isRetroactive);

    try {
      const result = await challengeService.completeChallenge({
        sessionId: sessionId!,
        answers: allAnswers,
      });
      useProfileStore.getState().updateChildXp(
        result.session.xp_awarded,
        result.new_level ?? child.level,
      );
      storeActions.reset();

      // ── Phase 3: mostrar celebrações antes de navegar ──────────────────
      const navigate = () => router.replace('/(app)/(tabs)/');

      const items: Array<{ type: 'trophy'; data: Trophy } | { type: 'achievement'; data: Achievement }> = [
        ...(result.trophies_earned ?? []).map(t => ({ type: 'trophy' as const, data: t })),
        ...(result.achievements_earned ?? []).map(a => ({ type: 'achievement' as const, data: a })),
      ];

      if (result.level_up && result.new_level) {
        // Level up → depois trophies/achievements → depois navega
        pendingNavRef.current = items.length > 0
          ? () => { setEarnedItems(items); pendingNavRef.current = navigate; }
          : navigate;
        setLevelUpData({
          newLevel: result.new_level,
          xpEarned: result.session.xp_awarded,
          reward: result.unlocked_reward as LevelReward | null | undefined,
        });
      } else if (items.length > 0) {
        // Sem level up mas há trophies/achievements
        pendingNavRef.current = navigate;
        setEarnedItems(items);
      } else {
        navigate();
      }
    } catch (e) {
      storeActions.setPhase('error');
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [child, sessionId, challengeDate, moduleId, allAnswers, uniqueCorrect, router, t, storeActions]);

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (phase === 'idle' || phase === 'loading') {
    return (
      <View style={[gs.container, gs.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Offline / Error ─────────────────────────────────────────────────────

  if (phase === 'error') {
    const isOffline = !network.isConnected;
    return (
      <View style={[gs.container, gs.centered]}>
        <View style={{ alignItems: 'center', gap: 16, paddingHorizontal: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={isOffline ? 'wifi-outline' : 'cloud-offline-outline'} size={36} color={colors.error} />
          </View>
          <Text style={{ fontFamily: fontFamily.extraBold, fontSize: 20, color: colors.text.primary, textAlign: 'center' }}>
            {isOffline ? t('challenge.offlineTitle') : t('common.error')}
          </Text>
          <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 }}>
            {isOffline ? t('challenge.offlineMsg') : t('challenge.errorSubmitMsg')}
          </Text>
          {!isOffline && (
            <Pressable
              style={{ marginTop: 8, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 32, paddingVertical: 14 }}
              onPress={() => { storeActions.reset(); }}
            >
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 16, color: '#fff' }}>{t('challenge.errorRetry')}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => { storeActions.reset(); router.back(); }} hitSlop={8}>
            <Text style={{ fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.text.secondary }}>{t('challenge.exitLeave')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Correct overlay — CorrectOverlay com confetti animado ─────────────────

  if (phase === 'correct') {
    return <CorrectOverlay xpGain={CHALLENGE.XP_PER_CORRECT_ANSWER} />;
  }

  // ─── Milestone — full screen colored with Milo ────────────────────────────

  if (phase === 'milestone') {
    const mk: MilestoneVariant =
      currentQuestionIndex <= 5 ? 'q5' :
      currentQuestionIndex <= 10 ? 'q10' : 'q15';
    return (
      <MilestoneScreen
        variant={mk}
        xpOverride={sessionXp}
        questionsCorrect={currentQuestionIndex}
        onContinue={() => storeActions.dismissMilestone()}
      />
    );
  }

  // ─── Celebration transition (após Continuar na tela de sucesso) ──────────

  if (showCelebration) {
    return (
      <CelebrationTransition
        onComplete={() => {
          setShowCelebration(false);
          void handleComplete();
        }}
      />
    );
  }

  // ─── Completed ────────────────────────────────────────────────────────────

  if (phase === 'completed' || phase === 'submitting') {
    const totalXp = sessionXp + CHALLENGE.XP_COMPLETION_BONUS +
      (uniqueCorrect === totalQuestions ? CHALLENGE.XP_PERFECT_BONUS : 0);
    return (
      <CompletedScreen
        xpOverride={totalXp}
        questionsCorrect={uniqueCorrect}
        onContinue={() => setShowCelebration(true)}
        isLoading={isSubmitting}
      />
    );
  }

  // ─── Wrong overlay ────────────────────────────────────────────────────────

  if (phase === 'wrong') {
    const q = lastAnsweredQuestion;
    return (
      <WrongAnswerScreen
        operandA={q?.operand_a ?? 0}
        operandB={q?.operand_b ?? 0}
        correctAnswer={q?.correct_answer ?? 0}
        userAnswer={lastUserAnswer}
        onContinue={() => storeActions.advanceAfterWrong()}
        onRetry={() => storeActions.retryBlock()}
      />
    );
  }

  // ─── Timeout screen ───────────────────────────────────────────────────────

  if (phase === 'timeout') {
    return (
      <TimeExpiredScreen
        onRetry={() => storeActions.retryBlock()}
        onGoHome={() => { storeActions.reset(); router.back(); }}
      />
    );
  }

  // ─── Block end screen ─────────────────────────────────────────────────────

  if (phase === 'block_end') {
    const blockCorrect = useChallengeStore.getState().answers.filter(
      (a) => a.block_number === useChallengeStore.getState().currentBlock &&
             a.child_answer !== null && a.child_answer === a.operand_a * a.operand_b,
    ).length;

    return (
      <BlockEndScreen
        correct={blockCorrect}
        total={CHALLENGE.QUESTIONS_PER_BLOCK}
        onRetry={() => storeActions.retryBlock()}
        onGoHome={() => { storeActions.reset(); router.back(); }}
      />
    );
  }


  // ─── Gameplay ─────────────────────────────────────────────────────────────

  const timerActive = (child?.timer_seconds ?? 0) > 0;
  // bg-muted = oklch(0.95 0.01 255) — cinza com leve tom azul, visível sobre #EEF1FF
  const timerBg = timerActive && remaining <= 2
    ? '#FEE2E2'                 // brand-red-soft
    : timerActive && remaining <= 5
      ? '#FFF3EC'               // brand-orange-soft
      : '#E4E5EF';              // muted com contraste visível sobre #EEF1FF
  const timerColor = timerActive && remaining <= 2
    ? colors.error
    : timerActive && remaining <= 5
      ? colors.accent
      : '#6B7280';              // ink-muted

  return (
    <View style={gs.container}>
      {/* Phase 3 — celebrações pós-challenge */}
      <LevelUpModal
        visible={levelUpData !== null}
        newLevel={levelUpData?.newLevel ?? 1}
        xpEarned={levelUpData?.xpEarned ?? 0}
        unlockedReward={levelUpData?.reward}
        onContinue={() => {
          setLevelUpData(null);
          const next = pendingNavRef.current;
          pendingNavRef.current = null;
          next?.();
        }}
      />
      <TrophyEarnedModal
        items={earnedItems}
        onDone={() => {
          setEarnedItems([]);
          const next = pendingNavRef.current;
          pendingNavRef.current = null;
          next?.();
        }}
      />

      {/* Retroactive banner */}
      {isRetroactive && (
        <View style={gs.retroBanner}>
          <Ionicons name="time-outline" size={14} color="#92400E" />
          <Text style={gs.retroBannerText}>{t('challenge.retroactive.xpOnly')}</Text>
        </View>
      )}
      <ConfirmDialog
        visible={showExitModal}
        title={t('challenge.exitTitle')}
        message={t('challenge.exitMessage')}
        primaryLabel={t('challenge.exitConfirm')}
        primaryVariant="primary"
        onPrimary={() => setShowExitModal(false)}
        confirmLabel={t('challenge.exitLeave')}
        confirmVariant="neutral"
        onConfirm={() => { setShowExitModal(false); storeActions.reset(); router.back(); }}
        layout="stack"
      />

      {/* Header: [X] [Questão X de 20 + progress] [⏰ timer] */}
      <View style={gs.header}>
        <Pressable onPress={() => setShowExitModal(true)} style={gs.exitBtn} accessibilityLabel={t('challenge.exitChallengeLabel')}>
          <View style={gs.exitBtnCircle}>
            <Ionicons name="close" size={22} color="#4B5563" />
          </View>
        </Pressable>

        <View style={gs.headerMiddle}>
          <Text style={gs.headerTitle}>
            {t('challenge.question', {
              current: String(currentQuestionIndex + 1),
              total: String(totalQuestions),
            })}
          </Text>
          <View style={{ height: 6 }} />
          <View style={gs.progressTrack}>
            <Animated.View style={[gs.progressFill, animatedProgress] as StyleProp<ViewStyle>}>
              <View style={gs.progressDot} />
            </Animated.View>
          </View>
        </View>

        <View style={[gs.timerChip, { backgroundColor: timerBg }]}>
          <Ionicons name="time-outline" size={15} color={timerColor} />
          <Text style={[gs.timerText, { color: timerColor }]}>
            {child?.timer_seconds === 0 ? '∞' : `${remaining}s`}
          </Text>
        </View>
      </View>

      {/* Main: badge + equation — centered together (matches zip flex-1 items-center justify-center) */}
      <View style={gs.questionArea}>
        <View style={gs.categoryBadge}>
          <Text style={gs.categoryBadgeText}>{t('challenge.category')}</Text>
        </View>

        {question ? (
          <Animated.View style={[gs.equationRow, animatedQuestion] as StyleProp<ViewStyle>}>
            <Text style={gs.operandText}>{question.operand_a}</Text>
            <Text style={gs.operatorText}>×</Text>
            <Text style={gs.operandText}>{question.operand_b}</Text>
            <Text style={gs.operatorText}>=</Text>
            <View style={[
              gs.answerBox,
              inputDigits.length > 0 ? gs.answerBoxActive : null,
            ] as StyleProp<ViewStyle>}>
              <Text style={gs.answerBoxText}>
                {inputDigits.join('') || '?'}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>

      {/* Keypad */}
      <NumericKeypad
        onDigit={handleDigit}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        hasInput={inputDigits.length > 0 && phase === 'playing'}
        disabled={phase !== 'playing'}
      />
    </View>
  );
}

// ─── Correct overlay styles ───────────────────────────────────────────────────

const correctStyles = StyleSheet.create({
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  label: {
    fontFamily: fontFamily.extraBold,
    fontSize: 32,
    color: '#166534',
    textAlign: 'center',
  },
});

// milestoneStyles removed — replaced by MilestoneScreen component + msStyles

// ─── Overlay card styles (wrong / timeout / block_end) ────────────────────────

const overlayStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    ...shadows.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Equation card inside wrong overlay
  equationCard: {
    backgroundColor: colors.background.cardAlt,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  equationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eqNum: {
    fontFamily: fontFamily.extraBold,
    fontSize: 28,
    color: colors.text.primary,
  },
  eqOp: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: colors.text.primary,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border.default,
  },
  yourAnswer: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text.secondary,
  },
  // Score card for block_end
  scoreCard: {
    backgroundColor: colors.background.cardAlt,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  scoreText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 36,
    color: colors.text.primary,
  },
  scoreLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.text.secondary,
  },
  scoreTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border.default,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  scoreFill: {
    height: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  scoreFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  scoreFooterText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: colors.text.secondary,
  },
  // Buttons
  primaryBtn: {
    backgroundColor: colors.success,
    borderRadius: 32,
    height: 54,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  primaryBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },
  ghostBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: colors.text.secondary,
  },
});

// ─── Gameplay styles — port exato do zip (Tailwind → px) ─────────────────────
const gs = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF1FF', // --background oklch(0.97 0.012 255)
    paddingHorizontal: 16,      // px-4
    paddingTop: 56,
    paddingBottom: 16,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Retroactive challenge banner (shown when date != today)
  retroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'center',
    marginBottom: 8,
  },
  retroBannerText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: '#92400E',
  },

  // header: flex items-center gap-3 px-4 pt-safe
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,                    // gap-3
    marginBottom: 0,            // conteúdo principal centrado pelo questionArea flex:1
  },

  exitBtn: {},

  // Design: rounded square (not full circle) with muted bg — matches screenshot header
  exitBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDEEF5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerMiddle: {
    flex: 1,
  },

  // text-xs font-extrabold text-ink — xs = 12px
  headerTitle: {
    fontFamily: fontFamily.extraBold,
    fontSize: 12,               // text-xs
    color: '#1A1F36',
    marginBottom: 4,
  },

  // flex items-center gap-1 rounded-full px-2.5 py-1 bg-muted
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,                     // gap-1
    paddingHorizontal: 10,      // px-2.5
    paddingVertical: 4,         // py-1
    borderRadius: 9999,
  },

  // text-sm font-extrabold tabular-nums — sm = 14px
  timerText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 14,
  },

  // h-2.5 overflow-VISIBLE (dot precisa ultrapassar) bg-brand-green-soft rounded-full
  progressTrack: {
    height: 10,
    backgroundColor: '#DCFCE7', // brand-green-soft
    borderRadius: 9999,
    overflow: 'visible',        // permite o dot ultrapassar a borda
  },

  // bg-brand-green rounded-full — contém o dot no extremo direito
  progressFill: {
    height: 10,
    backgroundColor: '#22C55E',
    borderRadius: 9999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'visible',
  },

  // dot verde no extremo direito da barra (igual ao design)
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2.5,
    borderColor: '#EEF1FF',    // mesmo fundo da tela
    marginRight: -7,            // metade para fora da barra
  },

  // main: flex-1 items-center justify-center — badge + equação centrados juntos
  questionArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // mb-6 rounded-full bg-brand-green-soft px-4 py-1.5 text-sm font-extrabold text-brand-green-dark
  categoryBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9999,
    paddingHorizontal: 20,      // px-4 + um pouco mais de fôlego
    paddingVertical: 8,
    marginBottom: 28,           // mb-6 + espaço extra para separar da equação
  },
  categoryBadgeText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 14,               // text-sm
    color: '#16A34A',
  },

  // flex flex-wrap items-center justify-center gap-x-3 gap-y-2
  equationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 12,              // gap-x-3
    rowGap: 8,                  // gap-y-2
  },

  // text-7xl font-black text-ink (72px)
  operandText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 72,
    lineHeight: 88,
    color: '#1A1F36',
    fontVariant: ['tabular-nums'],
  } as import('react-native').TextStyle,

  // text-6xl font-black text-brand-blue (60px)
  operatorText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 60,
    lineHeight: 88,
    color: '#2B52E5',
    fontVariant: ['tabular-nums'],
  } as import('react-native').TextStyle,

  // h-24 min-w-24 rounded-3xl border-4 border-dashed px-3 border-brand-blue-soft
  // brand-blue-soft = oklch(0.93 0.04 255) ≈ #DCE2FF (leve, não saturado)
  answerBox: {
    minWidth: 96,
    height: 96,
    borderRadius: 24,           // rounded-3xl
    borderWidth: 4,
    borderColor: '#C8CEFF',     // brand-blue-soft — leve, quase pastela
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  // active: border-brand-blue bg-brand-blue-soft solid
  answerBoxActive: {
    borderStyle: 'solid',
    borderColor: '#2B52E5',
    backgroundColor: '#DCE2FF', // brand-blue-soft
  },

  // text-7xl font-black text-brand-blue (72px — mesmo tamanho dos operandos)
  answerBoxText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 72,
    lineHeight: 88,
    color: '#2B52E5',
    fontVariant: ['tabular-nums'],
  } as import('react-native').TextStyle,
});
