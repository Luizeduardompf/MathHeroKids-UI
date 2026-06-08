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
// @ts-expect-error TS6/RN0.85 quirk — Image, Modal, Alert present at runtime
import { Alert, Image, Modal } from 'react-native'; // eslint-disable-line
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui';
import { colors, fontFamily, radius, space, shadows } from '@/theme';
import { CorrectOverlay } from '@/components/challenge/CorrectOverlay';
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
import { generateQuestions, buildQuestionSeed } from '@/lib/question-generator';
import { MODULE_ID, CHALLENGE } from '@/constants/config';

// ─── Milo asset ───────────────────────────────────────────────────────────────
// TODO: replace with extracted Milo character PNG from design exports
const MILO_IMAGE = require('../../../assets/images/icon.png') as number;

// ─── UUID helper ──────────────────────────────────────────────────────────────

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#2B52E5', '#F5722A', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'];
const CONFETTI_COUNT = 36;

function Confetti() {
  const pieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      aspect: Math.random() > 0.5 ? 1 : 2.5,
    })),
  ).current;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map((p, i) => (
        <View
          key={i}
          // eslint-disable-next-line react-native/no-inline-styles
          style={[{
            position: 'absolute',
            width: p.size,
            height: p.size * p.aspect,
            borderRadius: p.aspect === 1 ? p.size / 2 : 2,
            backgroundColor: p.color,
            opacity: 0.85,
          }, {
            // RN0.85 DimensionValue — cast needed for TS
            left: `${p.x}%` as unknown as number,
            top: `${p.y}%` as unknown as number,
            transform: [{ rotate: `${p.rotation}deg` as unknown as number }],
          }]}
        />
      ))}
    </View>
  );
}

// ─── XP Badge ─────────────────────────────────────────────────────────────────

function XpBadge({ xp }: { xp: string }) {
  return (
    <View style={xpBadgeStyles.badge}>
      <Text style={xpBadgeStyles.text}>{xp}</Text>
    </View>
  );
}

const xpBadgeStyles = StyleSheet.create({
  badge: {
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  text: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
});

// ─── Milo Box ─────────────────────────────────────────────────────────────────

function MiloBox({ message, bg }: { message: string; bg: string }) {
  return (
    <View style={[miloBoxStyles.box, { backgroundColor: bg }]}>
      <View style={miloBoxStyles.avatarWrap}>
        <Image source={MILO_IMAGE} style={miloBoxStyles.avatar} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={miloBoxStyles.label}>MILO DIZ</Text>
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

  const reset = useCallback(() => setRemaining(seconds), [seconds]);

  useEffect(() => {
    if (!active || seconds === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, seconds]);

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
        accessibilityLabel="Apagar"
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
        accessibilityLabel="Confirmar"
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

// ─── Exit Modal ───────────────────────────────────────────────────────────────

function ExitModal({
  visible,
  onContinue,
  onLeave,
}: {
  visible: boolean;
  onContinue: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={exitStyles.backdrop}>
        <View style={exitStyles.card}>
          <Text style={exitStyles.title}>{t('challenge.exitTitle')}</Text>
          <Text style={exitStyles.subtitle}>{t('challenge.exitMessage')}</Text>
          <Pressable style={exitStyles.continueBtn} onPress={onContinue}>
            <Text style={exitStyles.continueBtnText}>{t('challenge.exitConfirm')}</Text>
          </Pressable>
          <Pressable style={exitStyles.leaveBtn} onPress={onLeave}>
            <Text style={exitStyles.leaveBtnText}>{t('challenge.exitLeave')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const exitStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 12,
    ...shadows.lg,
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  continueBtn: {
    backgroundColor: colors.success,
    borderRadius: 32,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  continueBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },
  leaveBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 32,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.secondary,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChallengeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const child = useProfileStore(selectActiveChild);

  const phase = useChallengeStore((s) => s.phase);
  const sessionId = useChallengeStore((s) => s.sessionId);
  const challengeDate = useChallengeStore((s) => s.challengeDate);
  const moduleId = useChallengeStore((s) => s.moduleId);
  const currentQuestionIndex = useChallengeStore((s) => s.currentQuestionIndex);
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

      const sid = randomUUID();
      const seed = buildQuestionSeed(child.id, date, MODULE_ID.MULTIPLICATION);
      const questions = generateQuestions(seed, child.multiplication_max);

      // Backend é best-effort — questões geradas localmente sempre funcionam.
      // Se a EF falhar (offline, deploy pendente), a sessão local inicia igualmente
      // e o payload é enviado no complete_challenge quando estiver disponível.
      let resumeFromIndex = 0;
      try {
        const result = await challengeService.startChallenge({
          childId: child.id,
          challengeDate: date,
          moduleId: MODULE_ID.MULTIPLICATION,
          sessionId: sid,
          questionSeed: seed,
          timerSeconds: child.timer_seconds,
          multiplicationMax: child.multiplication_max,
        });
        resumeFromIndex = result.resumeFromIndex;
      } catch (backendErr) {
        // Backend indisponível — continua com sessão local
        console.warn('[Challenge] start_challenge indisponível, iniciando sessão local:', backendErr);
      }

      try {
        storeActions.startSession({
          sessionId: sid,
          childId: child.id,
          challengeDate: date,
          moduleId: MODULE_ID.MULTIPLICATION,
          questions,
          timerSeconds: child.timer_seconds,
          resumeFromIndex,
        });
      } catch (e) {
        storeActions.setPhase('error');
        Alert.alert(t('common.error'), (e as Error).message, [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      }
    }
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, date]);

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
    try {
      const result = await challengeService.completeChallenge({
        childId: child.id,
        challengeDate: challengeDate!,
        sessionId,
        moduleId: moduleId as import('@/constants/config').ModuleId,
        timerSeconds: child.timer_seconds,
        multiplicationMax: child.multiplication_max,
        answers: allAnswers,
      });
      if (result) {
        useProfileStore.getState().updateChildXp(
          result.session.xp_awarded,
          result.new_level ?? child.level,
        );
      }
      storeActions.reset();
      router.replace('/(app)/(tabs)/');
    } catch (e) {
      storeActions.setPhase('error');
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [child, sessionId, challengeDate, moduleId, allAnswers, router, t, storeActions]);

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (phase === 'idle' || phase === 'loading') {
    return (
      <View style={[gs.container, gs.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Correct overlay — CorrectOverlay com confetti animado ─────────────────

  if (phase === 'correct') {
    return <CorrectOverlay xpGain={10} />;
  }

  // ─── Milestone — full screen colored with Milo ────────────────────────────

  if (phase === 'milestone') {
    const mk = currentQuestionIndex <= 5 ? 'q5' : currentQuestionIndex <= 10 ? 'q10' : 'q15';
    const bgColors = { q5: '#2B52E5', q10: '#F5722A', q15: '#16A34A' };
    const bg = bgColors[mk];
    const pct = Math.round((currentQuestionIndex / CHALLENGE.TOTAL_QUESTIONS) * 100);

    return (
      <View style={[gs.container, gs.centered, { backgroundColor: bg }]}>
        <Confetti />
        <XpBadge xp={`+${sessionXp} XP`} />
        <View style={{ height: 20 }} />
        <View style={milestoneStyles.miloCircle}>
          <Image source={MILO_IMAGE} style={milestoneStyles.miloImg} />
        </View>
        <View style={{ height: 24 }} />
        <Text style={milestoneStyles.title}>{t(`challenge.milestone.${mk}.title`)}</Text>
        <Text style={milestoneStyles.subtitle}>{t(`challenge.milestone.${mk}.subtitle`)}</Text>
        <View style={{ height: 28 }} />
        <Text style={milestoneStyles.progressText}>
          {currentQuestionIndex}/{CHALLENGE.TOTAL_QUESTIONS} questões · {pct}%
        </Text>
        <View style={milestoneStyles.progressTrack}>
          <View style={[milestoneStyles.progressFill, { width: `${pct}%` as `${number}%` }]} />
        </View>
        <View style={{ height: 32 }} />
        <Pressable style={milestoneStyles.continueBtn} onPress={() => storeActions.dismissMilestone()}>
          <Text style={milestoneStyles.continueBtnText}>{t('challenge.milestone.continue')}</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Completed — full screen gold ────────────────────────────────────────

  if (phase === 'completed' || phase === 'submitting') {
    const totalXp = sessionXp + 200 + (uniqueCorrect === 20 ? 100 : 0);
    const pct = Math.round((uniqueCorrect / CHALLENGE.TOTAL_QUESTIONS) * 100);

    return (
      <View style={[gs.container, gs.centered, { backgroundColor: '#F59E0B' }]}>
        <Confetti />
        <XpBadge xp={`+${totalXp} XP`} />
        <View style={{ height: 20 }} />
        <View style={milestoneStyles.miloCircle}>
          <Image source={MILO_IMAGE} style={milestoneStyles.miloImg} />
        </View>
        <View style={{ height: 24 }} />
        <Text style={[milestoneStyles.title, { fontSize: 34 }]}>{t('challenge.completed.title')}</Text>
        <Text style={milestoneStyles.subtitle}>{t('challenge.completed.subtitle')}</Text>
        <View style={{ height: 28 }} />
        <Text style={milestoneStyles.progressText}>
          {uniqueCorrect}/{CHALLENGE.TOTAL_QUESTIONS} questões · {pct}%
        </Text>
        <View style={milestoneStyles.progressTrack}>
          <View style={[milestoneStyles.progressFill, { width: `${pct}%` as `${number}%` }]} />
        </View>
        <View style={{ height: 32 }} />
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Pressable style={milestoneStyles.continueBtn} onPress={() => { void handleComplete(); }}>
            <Text style={milestoneStyles.continueBtnText}>{t('challenge.completed.continue')}</Text>
          </Pressable>
        )}
      </View>
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
      <ExitModal
        visible={showExitModal}
        onContinue={() => setShowExitModal(false)}
        onLeave={() => { setShowExitModal(false); storeActions.reset(); router.back(); }}
      />

      {/* Header: [X] [Questão X de 20 + progress] [⏰ timer] */}
      <View style={gs.header}>
        <Pressable onPress={() => setShowExitModal(true)} style={gs.exitBtn} accessibilityLabel="Sair do desafio">
          <View style={gs.exitBtnCircle}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </View>
        </Pressable>

        <View style={gs.headerMiddle}>
          <Text style={gs.headerTitle}>
            {t('challenge.question', {
              current: String(currentQuestionIndex + 1),
              total: String(CHALLENGE.TOTAL_QUESTIONS),
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

// ─── Milestone / Completed styles ─────────────────────────────────────────────

const milestoneStyles = StyleSheet.create({
  miloCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  miloImg: { width: 96, height: 96 },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 30,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 6,
  },
  progressText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressTrack: {
    width: '60%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  continueBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 32,
    height: 54,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },
});

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

  // header: flex items-center gap-3 px-4 pt-safe
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,                    // gap-3
    marginBottom: 0,            // conteúdo principal centrado pelo questionArea flex:1
  },

  exitBtn: {},

  // h-10 w-10 rounded-full bg-muted text-ink-muted
  exitBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    // bg-muted: oklch(0.95 0.01 255) — levemente azul-acinzentado, não branco puro
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
    lineHeight: 88,             // linha explícita previne clipping iOS
    color: '#1A1F36',
  },

  // text-6xl font-black text-brand-blue (60px)
  operatorText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 60,
    lineHeight: 88,             // mesma altura de linha dos operandos — alinhamento vertical
    color: '#2B52E5',
  },

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
  },
});
