/**
 * Challenge gameplay screen.
 *
 * Route: /challenge/YYYY-MM-DD
 * Param: date — ISO date string of the challenge
 *
 * Architecture:
 * - Questions generated client-side (deterministic seed)
 * - Answers buffered in challengeStore
 * - All 20 answers submitted in batch at the end via complete_challenge EF
 * - Timer runs client-side; server validates total session time on completion
 * - Block checkpoint every 5 questions (4 blocks × 5 questions)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
// Alert: direct subpath import avoids TypeScript 6 / RN 0.85 export* resolution quirk
import { Alert } from 'react-native/Libraries/Alert/Alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { colors, radius, space, shadows } from '@/theme';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import {
  useChallengeStore,
  selectCurrentQuestion,
  selectProgressFraction,
  selectAllAnswers,
} from '@/stores/challenge.store';
import { challengeService } from '@/services/challenge.service';
import { generateQuestions, buildQuestionSeed } from '@/lib/question-generator';
import { MODULE_ID, CHALLENGE } from '@/constants/config';

// ─── UUID helper (no expo-crypto dep needed) ──────────────────────────────────

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  disabled = false,
}: {
  onDigit: (d: number) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'] as const;
  return (
    <View style={styles.keypad}>
      {keys.map((k, i) => {
        if (k === null) return <View key={i} style={styles.keyEmpty} />;
        const isDel = k === 'del';
        return (
          <Pressable
            key={i}
            style={({ pressed }) =>
              [
                styles.key,
                pressed && !disabled ? styles.keyPressed : null,
                disabled ? styles.keyDisabled : null,
              ] as StyleProp<ViewStyle>
            }
            onPress={() => {
              if (disabled) return;
              if (isDel) onDelete();
              else onDigit(k as number);
            }}
            accessibilityLabel={isDel ? 'Apagar' : String(k)}
          >
            <Text variant="h2" style={styles.keyText}>{isDel ? '⌫' : k}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
  const storeActions = useChallengeStore((s) => ({
    setPhase: s.setPhase,
    startSession: s.startSession,
    submitAnswer: s.submitAnswer,
    retryBlock: s.retryBlock,
    dismissMilestone: s.dismissMilestone,
    markQuestionStart: s.markQuestionStart,
    reset: s.reset,
  }));

  const question = useChallengeStore(selectCurrentQuestion);
  const progress = useChallengeStore(selectProgressFraction);
  const allAnswers = useChallengeStore(selectAllAnswers);

  const [inputDigits, setInputDigits] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation
  const progressWidth = useSharedValue(0);
  const questionScale = useSharedValue(1);

  useEffect(() => {
    progressWidth.value = withTiming(progress, { duration: 300 });
  }, [progress, progressWidth]);

  const animatedProgress = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as `${number}%`,
  }));
  const animatedQuestion = useAnimatedStyle(() => ({
    transform: [{ scale: questionScale.value }],
  }));

  // ─── Init ──────────────────────────────────────────────────────────────

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

  // ─── Timer ────────────────────────────────────────────────────────────

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

  // Reset timer + animate on new question
  useEffect(() => {
    if (phase === 'playing') {
      resetTimer();
      storeActions.markQuestionStart();
      setInputDigits([]);
      // Two-step spring (withSequence has TS6 export quirk with Reanimated 4.3)
      questionScale.value = withSpring(0.94, { damping: 8 });
      setTimeout(() => { questionScale.value = withSpring(1, { damping: 14 }); }, 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, phase]);

  // Auto-advance after correct flash
  useEffect(() => {
    if (phase !== 'correct') return;
    const t = setTimeout(() => {
      if (useChallengeStore.getState().phase === 'correct') {
        useChallengeStore.getState().setPhase('playing');
      }
    }, 700);
    return () => clearTimeout(t);
  }, [phase]);

  // ─── Input ────────────────────────────────────────────────────────────

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

  // Auto-submit at 3 digits (max = 20×20=400)
  useEffect(() => {
    if (inputDigits.length === 3) handleSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputDigits]);

  // ─── Complete ─────────────────────────────────────────────────────────

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

  // ─── Exit ─────────────────────────────────────────────────────────────

  const handleExit = useCallback(() => {
    Alert.alert(t('challenge.exitTitle'), t('challenge.exitMessage'), [
      { text: t('challenge.exitConfirm'), style: 'cancel' },
      {
        text: t('challenge.exitLeave'),
        style: 'destructive',
        onPress: () => { storeActions.reset(); router.back(); },
      },
    ]);
  }, [storeActions, router, t]);

  // ─── Loading ──────────────────────────────────────────────────────────

  if (phase === 'idle' || phase === 'loading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Completed ────────────────────────────────────────────────────────

  if (phase === 'completed' || phase === 'submitting') {
    const uniqueCorrect = new Set(
      allAnswers
        .filter((a) => a.child_answer !== null && a.child_answer === a.operand_a * a.operand_b)
        .map((a) => a.question_index),
    ).size;
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.card}>
          <Text style={{ fontSize: 64, textAlign: 'center' }}>🏆</Text>
          <Text variant="h1" align="center">{t('challenge.completed.title')}</Text>
          <Text variant="body" align="center" color={colors.text.secondary}>
            {t('challenge.completed.subtitle')}
          </Text>
          <View style={styles.statsRow}>
            <Text variant="h2" color={colors.success}>{uniqueCorrect}/20</Text>
            <Text variant="body" color={colors.text.secondary}> corretas</Text>
          </View>
          {isSubmitting
            ? <ActivityIndicator color={colors.primary} style={{ marginTop: space.lg }} />
            : (
              <Pressable style={styles.primaryBtn} onPress={() => { void handleComplete(); }}>
                <Text variant="button" color={colors.text.inverse}>{t('challenge.completed.continue')}</Text>
              </Pressable>
            )}
        </View>
      </View>
    );
  }

  // ─── Milestone ────────────────────────────────────────────────────────

  if (phase === 'milestone') {
    const mk = currentQuestionIndex === 5 ? 'q5' : currentQuestionIndex === 10 ? 'q10' : 'q15';
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.card}>
          <Text style={{ fontSize: 64, textAlign: 'center' }}>🧙‍♂️</Text>
          <Text variant="h2" align="center">{t(`challenge.milestone.${mk}.title`)}</Text>
          <Text variant="body" align="center" color={colors.text.secondary}>
            {t(`challenge.milestone.${mk}.subtitle`)}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => storeActions.dismissMilestone()}>
            <Text variant="button" color={colors.text.inverse}>{t('challenge.milestone.continue')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Wrong / Timeout ──────────────────────────────────────────────────

  if (phase === 'wrong' || phase === 'timeout') {
    const isTimeout = phase === 'timeout';
    const k = isTimeout ? 'timeout' : 'wrong';
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.card}>
          <Text style={{ fontSize: 64, textAlign: 'center' }}>{isTimeout ? '⏰' : '😅'}</Text>
          <Text variant="h2" align="center">{t(`challenge.${k}.title`)}</Text>
          {isTimeout ? (
            <Text variant="body" align="center" color={colors.text.secondary}>
              {t('challenge.timeout.message')}
            </Text>
          ) : (
            <>
              <Text variant="body" align="center" color={colors.text.secondary}>
                {t('challenge.wrong.subtitle')}
              </Text>
              <View style={styles.correctBox}>
                <Text variant="h1" color={colors.success}>{lastCorrectAnswer}</Text>
              </View>
            </>
          )}
          <Pressable style={styles.primaryBtn} onPress={() => storeActions.retryBlock()}>
            <Text variant="button" color={colors.text.inverse}>
              {t(`challenge.${isTimeout ? 'timeout' : 'wrong'}.retry`)}
            </Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => { storeActions.reset(); router.back(); }}>
            <Text variant="bodySmall" color={colors.text.secondary}>
              {t('challenge.blockIncomplete.goHome')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Gameplay ─────────────────────────────────────────────────────────

  const timerColor = (child?.timer_seconds ?? 0) > 0 && remaining <= 5
    ? colors.error : colors.text.secondary;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleExit} style={styles.exitBtn}>
          <Text variant="h3" color={colors.text.secondary}>✕</Text>
        </Pressable>
        <Text variant="caption" color={colors.text.secondary}>
          {t('challenge.question', {
            current: String(currentQuestionIndex + 1),
            total: String(CHALLENGE.TOTAL_QUESTIONS),
          })}
        </Text>
        <Text variant="body" style={{ color: timerColor, fontWeight: '700', minWidth: 40, textAlign: 'right' }}>
          {child?.timer_seconds === 0
            ? t('challenge.timerUnlimited')
            : t('challenge.timerLabel', { seconds: String(remaining) })}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            animatedProgress,
            phase === 'correct' ? { backgroundColor: colors.success } : null,
          ] as StyleProp<ViewStyle>}
        />
      </View>

      {/* Question */}
      <View style={styles.questionArea}>
        <Text variant="caption" color={colors.text.tertiary} align="center">
          {t('challenge.category')}
        </Text>
        {question ? (
          <Animated.View style={[styles.questionCard, animatedQuestion] as StyleProp<ViewStyle>}>
            <Text style={{
              fontSize: 56,
              fontWeight: '900',
              color: phase === 'correct' ? colors.success : colors.text.primary,
              textAlign: 'center',
              letterSpacing: -1,
            }}>
              {question.operand_a} × {question.operand_b}
            </Text>
          </Animated.View>
        ) : null}

        {/* Answer box */}
        <View style={[
          styles.answerBox,
          phase === 'correct' ? styles.answerCorrect : null,
        ] as StyleProp<ViewStyle>}>
          <Text style={{
            fontSize: 48,
            fontWeight: '800',
            textAlign: 'center',
            color: phase === 'correct'
              ? colors.success
              : inputDigits.length > 0
                ? colors.text.primary
                : colors.text.tertiary,
          }}>
            {phase === 'correct' ? question?.correct_answer : (inputDigits.join('') || '?')}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* Submit */}
      {inputDigits.length > 0 && phase === 'playing' && (
        <Pressable style={styles.submitBtn} onPress={handleSubmit}>
          <Text variant="button" color={colors.text.inverse}>Confirmar ✓</Text>
        </Pressable>
      )}

      {/* Keypad */}
      <NumericKeypad
        onDigit={handleDigit}
        onDelete={handleDelete}
        disabled={phase !== 'playing'}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingHorizontal: space.md,
    paddingTop: 60,
    paddingBottom: space.lg,
  },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  exitBtn: { padding: space.xs },

  progressTrack: {
    height: 6,
    backgroundColor: colors.background.cardAlt,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },

  questionArea: { alignItems: 'center', gap: space.lg },
  questionCard: { alignItems: 'center', minHeight: 100, justifyContent: 'center' },

  answerBox: {
    width: '100%',
    height: 80,
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
    ...shadows.sm,
  },
  answerCorrect: { borderColor: colors.success, backgroundColor: colors.successLight },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
    ...shadows.sm,
  },

  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  key: {
    width: '30%',
    aspectRatio: 1.6,
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  keyPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  keyDisabled: { opacity: 0.4 },
  keyEmpty: { width: '30%', aspectRatio: 1.6 },
  keyText: { color: colors.text.primary },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.md,
    ...shadows.md,
  },
  statsRow: { flexDirection: 'row', alignItems: 'baseline' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    height: 52,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ghostBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  correctBox: {
    backgroundColor: colors.successLight,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
});
