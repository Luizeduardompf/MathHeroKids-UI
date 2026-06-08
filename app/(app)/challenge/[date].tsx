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
          [kpStyles.key, pressed && !disabled ? kpStyles.keyPressed : null, disabled ? kpStyles.keyDisabled : null] as StyleProp<ViewStyle>
        }
        onPress={() => { if (!disabled) onDelete(); }}
        accessibilityLabel="Apagar"
      >
        <Ionicons name="backspace-outline" size={22} color={colors.text.secondary} />
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
      {hasInput && onSubmit ? (
        <Pressable
          style={({ pressed }) =>
            [kpStyles.key, kpStyles.keyConfirm, pressed ? kpStyles.keyPressed : null] as StyleProp<ViewStyle>
          }
          onPress={onSubmit}
          accessibilityLabel="Confirmar"
        >
          <Ionicons name="checkmark" size={28} color="#fff" />
        </Pressable>
      ) : (
        <View style={kpStyles.keyEmpty} />
      )}
    </View>
  );
}

const kpStyles = StyleSheet.create({
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  key: {
    width: '30%',
    height: 68,
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  keyConfirm: { backgroundColor: colors.success },
  keyPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  keyDisabled: { opacity: 0.3 },
  keyEmpty: { width: '30%', height: 68 },
  keyText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 26,
    color: colors.text.primary,
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
      try {
        const sid = randomUUID();
        const seed = buildQuestionSeed(child.id, date, MODULE_ID.MULTIPLICATION);
        const questions = generateQuestions(seed, child.multiplication_max);
        const result = await challengeService.startChallenge({
          childId: child.id,
          challengeDate: date,
          moduleId: MODULE_ID.MULTIPLICATION,
          sessionId: sid,
          questionSeed: seed,
          timerSeconds: child.timer_seconds,
          multiplicationMax: child.multiplication_max,
        });
        storeActions.startSession({
          sessionId: result.sessionId,
          childId: child.id,
          challengeDate: date,
          moduleId: MODULE_ID.MULTIPLICATION,
          questions,
          timerSeconds: child.timer_seconds,
          resumeFromIndex: result.resumeFromIndex,
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

  // Auto-advance correct overlay after 900ms
  useEffect(() => {
    if (phase !== 'correct') return;
    const timer = setTimeout(() => {
      if (useChallengeStore.getState().phase === 'correct') {
        useChallengeStore.getState().setPhase('playing');
      }
    }, 900);
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

  // ─── Correct overlay — full screen green with confetti ───────────────────

  if (phase === 'correct') {
    return (
      <View style={[gs.container, gs.centered, { backgroundColor: '#DCFCE7' }]}>
        <Confetti />
        <XpBadge xp="+10 XP" />
        <View style={{ height: 16 }} />
        <View style={correctStyles.circle}>
          <Ionicons name="checkmark" size={52} color="#fff" />
        </View>
        <View style={{ height: 20 }} />
        <Text style={correctStyles.label}>{t('challenge.correct')}</Text>
      </View>
    );
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
      <View style={[gs.container, gs.centered]}>
        <View style={overlayStyles.card}>
          {/* Icon */}
          <View style={[overlayStyles.iconCircle, { backgroundColor: '#F5722A' }]}>
            <Ionicons name="close" size={36} color="#fff" />
          </View>
          {/* Title */}
          <Text style={overlayStyles.title}>{t('challenge.wrong.title')}</Text>
          <Text style={overlayStyles.subtitle}>{t('challenge.wrong.subtitle')}</Text>
          {/* Equation with correct answer */}
          {q && (
            <View style={overlayStyles.equationCard}>
              <View style={overlayStyles.equationRow}>
                <Text style={overlayStyles.eqNum}>{q.operand_a}</Text>
                <Text style={overlayStyles.eqOp}>×</Text>
                <Text style={overlayStyles.eqNum}>{q.operand_b}</Text>
                <Text style={overlayStyles.eqOp}>=</Text>
                <Text style={[overlayStyles.eqNum, { color: colors.success }]}>{q.correct_answer}</Text>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
              <View style={overlayStyles.divider} />
              <Text style={overlayStyles.yourAnswer}>
                {t('challenge.yourAnswer')}{' '}
                <Text style={{ color: colors.error, fontFamily: fontFamily.bold }}>{lastUserAnswer}</Text>
              </Text>
            </View>
          )}
          {/* Milo box */}
          <MiloBox
            message={t('challenge.wrong.miloMessage')}
            bg="#2B52E5"
          />
          {/* Actions */}
          <Pressable style={overlayStyles.primaryBtn} onPress={() => storeActions.advanceAfterWrong()}>
            <Text style={overlayStyles.primaryBtnText}>{t('challenge.wrong.continueAnyway')}</Text>
          </Pressable>
          <Pressable style={overlayStyles.ghostBtn} onPress={() => storeActions.retryBlock()}>
            <Ionicons name="refresh" size={16} color={colors.text.secondary} />
            <Text style={overlayStyles.ghostBtnText}>{t('challenge.wrong.retry')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Timeout overlay ──────────────────────────────────────────────────────

  if (phase === 'timeout') {
    return (
      <View style={[gs.container, gs.centered]}>
        <View style={overlayStyles.card}>
          <View style={[overlayStyles.iconCircle, { backgroundColor: colors.error }]}>
            <Ionicons name="time-outline" size={36} color="#fff" />
          </View>
          <Text style={overlayStyles.title}>{t('challenge.timeout.title')}</Text>
          <Text style={overlayStyles.subtitle}>{t('challenge.timeout.message')}</Text>
          <MiloBox
            message={t('challenge.timeout.miloMessage')}
            bg={colors.error}
          />
          <Pressable style={[overlayStyles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => storeActions.retryBlock()}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={overlayStyles.primaryBtnText}>{t('challenge.timeout.retry')}</Text>
          </Pressable>
          <Pressable style={overlayStyles.ghostBtn} onPress={() => { storeActions.reset(); router.back(); }}>
            <Ionicons name="home-outline" size={16} color={colors.text.secondary} />
            <Text style={overlayStyles.ghostBtnText}>{t('challenge.timeout.goHome')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Block end overlay ────────────────────────────────────────────────────

  if (phase === 'block_end') {
    const blockCorrect = useChallengeStore.getState().answers.filter(
      (a) => a.block_number === useChallengeStore.getState().currentBlock &&
             a.child_answer !== null && a.child_answer === a.operand_a * a.operand_b,
    ).length;
    const pct = Math.round((blockCorrect / CHALLENGE.QUESTIONS_PER_BLOCK) * 100);

    return (
      <View style={[gs.container, gs.centered]}>
        <View style={overlayStyles.card}>
          <View style={[overlayStyles.iconCircle, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="radio-button-on-outline" size={36} color="#fff" />
          </View>
          <Text style={overlayStyles.title}>{t('challenge.blockIncomplete.title')}</Text>
          <Text style={overlayStyles.subtitle}>{t('challenge.blockIncomplete.subtitle')}</Text>
          <View style={overlayStyles.scoreCard}>
            <Text style={overlayStyles.scoreText}>{blockCorrect}/{CHALLENGE.QUESTIONS_PER_BLOCK}</Text>
            <Text style={overlayStyles.scoreLabel}>respostas corretas</Text>
            <View style={overlayStyles.scoreTrack}>
              <View style={[overlayStyles.scoreFill, { width: `${pct}%` as `${number}%` }]} />
            </View>
            <View style={overlayStyles.scoreFooter}>
              <Text style={overlayStyles.scoreFooterText}>{pct}% acertos</Text>
              <Text style={[overlayStyles.scoreFooterText, { color: '#F59E0B' }]}>★ Meta: 100%</Text>
            </View>
          </View>
          <MiloBox
            message={t('challenge.blockIncomplete.miloMessage')}
            bg="#F59E0B"
          />
          <Pressable style={[overlayStyles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => storeActions.retryBlock()}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={overlayStyles.primaryBtnText}>{t('challenge.blockIncomplete.retry')}</Text>
          </Pressable>
          <Pressable style={overlayStyles.ghostBtn} onPress={() => { storeActions.reset(); router.back(); }}>
            <Ionicons name="home-outline" size={16} color={colors.text.secondary} />
            <Text style={overlayStyles.ghostBtnText}>{t('challenge.blockIncomplete.goHome')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Gameplay ─────────────────────────────────────────────────────────────

  const timerColor = (child?.timer_seconds ?? 0) > 0 && remaining <= 5 ? colors.error : colors.text.secondary;

  return (
    <View style={gs.container}>
      <ExitModal
        visible={showExitModal}
        onContinue={() => setShowExitModal(false)}
        onLeave={() => { setShowExitModal(false); storeActions.reset(); router.back(); }}
      />

      {/* Header */}
      <View style={gs.header}>
        <Pressable onPress={() => setShowExitModal(true)} style={gs.exitBtn} accessibilityLabel="Sair do desafio">
          <View style={gs.exitBtnCircle}>
            <Ionicons name="close" size={18} color={colors.text.secondary} />
          </View>
        </Pressable>
        <Text style={gs.headerTitle}>
          {t('challenge.question', {
            current: String(currentQuestionIndex + 1),
            total: String(CHALLENGE.TOTAL_QUESTIONS),
          })}
        </Text>
        <View style={gs.timerRow}>
          {(child?.timer_seconds ?? 0) > 0 && (
            <Ionicons name="time-outline" size={16} color={timerColor} />
          )}
          <Text style={[gs.timerText, { color: timerColor }]}>
            {child?.timer_seconds === 0 ? '∞' : `${remaining}s`}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={gs.progressTrack}>
        <Animated.View style={[gs.progressFill, animatedProgress] as StyleProp<ViewStyle>}>
          <View style={gs.progressDot} />
        </Animated.View>
      </View>

      {/* Category badge */}
      <View style={gs.categoryBadge}>
        <Text style={gs.categoryBadgeText}>{t('challenge.category')}</Text>
      </View>

      {/* Equation: 7 × 8 = ? */}
      <View style={gs.questionArea}>
        {question ? (
          <Animated.View style={[gs.equationRow, animatedQuestion] as StyleProp<ViewStyle>}>
            <Text style={gs.operandText}>{question.operand_a}</Text>
            <Text style={gs.operatorText}>×</Text>
            <Text style={gs.operandText}>{question.operand_b}</Text>
            <Text style={gs.operatorText}>=</Text>
            <View style={[
              gs.answerCircle,
              inputDigits.length > 0 ? gs.answerCircleActive : null,
            ] as StyleProp<ViewStyle>}>
              <Text style={[
                gs.answerCircleText,
                inputDigits.length > 0 ? { color: colors.primary } : { color: colors.primary },
              ]}>
                {inputDigits.join('') || '?'}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <View style={{ flex: 1 }} />

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

// ─── Gameplay styles ──────────────────────────────────────────────────────────

const gs = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exitBtn: {},
  exitBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
    justifyContent: 'flex-end',
  },
  timerText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
  },

  // Progress bar — green with leading dot
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'visible',
    marginBottom: 20,
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.success,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'visible',
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    marginRight: -7,
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Category badge
  categoryBadge: {
    alignSelf: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 99,
    paddingHorizontal: 20,
    paddingVertical: 7,
    marginBottom: 32,
  },
  categoryBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: '#16A34A',
  },

  // Equation
  questionArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  equationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  operandText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 68,
    color: '#1A1F36',
    lineHeight: 80,
  },
  operatorText: {
    fontFamily: fontFamily.bold,
    fontSize: 46,
    color: '#1A1F36',
    lineHeight: 80,
  },
  answerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerCircleActive: {
    borderStyle: 'solid',
    backgroundColor: '#EEF1FF',
  },
  answerCircleText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 34,
    color: colors.primary,
  },
});
