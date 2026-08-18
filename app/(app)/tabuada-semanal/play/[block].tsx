/**
 * Tabuada Semanal Premiada — jogo de UM bloco (20 questões, 10s cada).
 *
 * Estrutura de UI modelada em app/(app)/challenge/[date].tsx mas simplificada: sem
 * marcos/celebrações de XP (este módulo não tem XP), sem múltiplos blocos numa sessão —
 * cada visita a este ecrã é um único bloco. Reaproveita WrongAnswerScreen (genérico,
 * onContinue em vez de sair) para erro e timeout.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated Easing named-export quirk in this TS config
import { Easing } from 'react-native-reanimated'; // eslint-disable-line
import { playSound } from '@/services/sound.service';

import { Text } from '@/components/ui';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import { WrongAnswerScreen } from '@/components/challenge/StatusScreens';
import { TabuadaDayCompleteModal } from '@/components/challenge/TabuadaDayCompleteModal';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import {
  useTabuadaSemanalStore,
  selectCurrentQuestion,
  selectProgressFraction,
  selectCorrectCount,
} from '@/stores/tabuada-semanal.store';
import { tabuadaSemanalService } from '@/services/tabuada-semanal.service';
import { notificationSettingsService } from '@/services/notification-settings.service';
import { queryClient } from '@/lib/query-client';
import { WEEKLY_TABUADA, centsToEuroLabel, tabuadaBlockEarnedCents, sumTabuadaBlocksEarnedCents, OPERATION_SYMBOLS, MODULE_ID } from '@/constants/config';
import type { SubmitTabuadaBlockResponse } from '@/types/database.types';

// ─── Timer hook (cópia enxuta de challenge/[date].tsx) ─────────────────────────

function useTimer(seconds: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const reset = useCallback(() => setRemaining(seconds), [seconds]);

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!active) return;

    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setTimeout(() => onExpireRef.current(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [active, seconds]);

  return { remaining, reset };
}

// ─── Numeric keypad (cópia enxuta de challenge/[date].tsx) ─────────────────────

function NumericKeypad({ onDigit, onDelete, onSubmit, hasInput, disabled }: {
  onDigit: (d: number) => void; onDelete: () => void; onSubmit: () => void;
  hasInput: boolean; disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={kp.keypad}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
        <Pressable
          key={k}
          style={({ pressed }) => [kp.key, pressed && !disabled ? kp.keyPressed : null, disabled ? kp.keyDisabled : null] as StyleProp<ViewStyle>}
          onPress={() => { if (!disabled) onDigit(k); }}
        >
          <Text style={kp.keyText}>{k}</Text>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [kp.key, kp.keyMuted, pressed && !disabled ? kp.keyPressed : null, disabled ? kp.keyDisabled : null] as StyleProp<ViewStyle>}
        onPress={() => { if (!disabled) onDelete(); }}
        accessibilityLabel={t('common.delete')}
      >
        <Ionicons name="backspace-outline" size={26} color="#6B7280" />
      </Pressable>
      <Pressable
        style={({ pressed }) => [kp.key, pressed && !disabled ? kp.keyPressed : null, disabled ? kp.keyDisabled : null] as StyleProp<ViewStyle>}
        onPress={() => { if (!disabled) onDigit(0); }}
      >
        <Text style={kp.keyText}>0</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [kp.key, kp.keyConfirm, !hasInput ? kp.keyConfirmDisabled : null, pressed && hasInput ? kp.keyPressed : null] as StyleProp<ViewStyle>}
        onPress={() => { if (hasInput) onSubmit(); }}
        accessibilityLabel={t('common.confirm')}
        accessibilityState={{ disabled: !hasInput }}
      >
        <Ionicons name="checkmark" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Check de "correto" — grande, centrado no ecrã, com zoom-out dinâmico ──────

const CORRECT_CIRCLE = 168;

function CorrectCheckBurst() {
  const scale = useSharedValue(2.6);
  const opacity = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0.55);

  useEffect(() => {
    playSound('correct');
    opacity.value = withTiming(1, { duration: 90 });
    scale.value = withSpring(1, { damping: 10, stiffness: 220, mass: 0.8 });
    ringScale.value = withTiming(1.9, { duration: 430, easing: Easing.out(Easing.quad) });
    ringOpacity.value = withTiming(0, { duration: 430, easing: Easing.out(Easing.quad) });
    const fadeOut = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 140 });
    }, 420);
    return () => clearTimeout(fadeOut);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circleAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const ringAnim = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={cc.overlay} pointerEvents="none">
      <Animated.View style={[cc.ring, ringAnim] as StyleProp<ViewStyle>} />
      <Animated.View style={[cc.circle, circleAnim] as StyleProp<ViewStyle>}>
        <Ionicons name="checkmark" size={92} color="#fff" />
      </Animated.View>
    </View>
  );
}

const cc = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  ring: {
    position: 'absolute', width: CORRECT_CIRCLE, height: CORRECT_CIRCLE,
    borderRadius: CORRECT_CIRCLE / 2, borderWidth: 5, borderColor: colors.success,
  },
  circle: {
    width: CORRECT_CIRCLE, height: CORRECT_CIRCLE, borderRadius: CORRECT_CIRCLE / 2,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#166534', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});

const kp = StyleSheet.create({
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 4 },
  key: { width: '30%', height: 72, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  keyMuted: { backgroundColor: '#EDEEF5' },
  keyConfirm: { backgroundColor: '#22C55E' },
  keyConfirmDisabled: { opacity: 0.5 },
  keyPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  keyDisabled: { opacity: 0.35 },
  keyText: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, color: '#1A1F36' },
});

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function TabuadaBlockPlayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { block } = useLocalSearchParams<{ block: string }>();
  const blockNumber = Number(block);
  const child = useProfileStore(selectActiveChild);

  const phase = useTabuadaSemanalStore((s) => s.phase);
  const lastCorrectAnswer = useTabuadaSemanalStore((s) => s.lastCorrectAnswer);
  const lastUserAnswer = useTabuadaSemanalStore((s) => s.lastUserAnswer);
  const lastAnsweredQuestion = useTabuadaSemanalStore((s) => s.lastAnsweredQuestion);
  const currentIndex = useTabuadaSemanalStore((s) => s.currentIndex);
  const question = useTabuadaSemanalStore(selectCurrentQuestion);
  const progress = useTabuadaSemanalStore(selectProgressFraction);
  const correctCount = useTabuadaSemanalStore(selectCorrectCount);

  const [inputDigits, setInputDigits] = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitTabuadaBlockResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dayCompleteDismissed, setDayCompleteDismissed] = useState(false);
  const initedRef = useRef(false);
  const submittingRef = useRef(false);

  const parentId = useAuthStore(selectParentId);
  const { data: notifPrefs } = useQuery({
    queryKey: ['notification-preferences', parentId],
    queryFn: () => notificationSettingsService.getParentPreferences(parentId!),
    enabled: !!parentId,
    staleTime: 60_000,
  });
  const parentWillBeNotified = !!notifPrefs?.whatsapp_enabled && !!notifPrefs?.tabuada_day_completed_enabled;

  const loadBlock = useCallback(async () => {
    if (!child || !Number.isFinite(blockNumber)) return;
    try {
      const dayData = await tabuadaSemanalService.startDay(child.id);
      const blockQuestions = dayData.questions.filter((q) => q.block_number === blockNumber);
      if (blockQuestions.length !== WEEKLY_TABUADA.QUESTIONS_PER_BLOCK) {
        setLoadError('errors.generic');
        return;
      }
      useTabuadaSemanalStore.getState().startBlock(blockNumber, blockQuestions);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [child, blockNumber]);

  // ─── Init: gera/retoma o dia e arranca este bloco ───────────────────────────
  useEffect(() => {
    if (!child || initedRef.current || !Number.isFinite(blockNumber)) return;
    initedRef.current = true;
    void loadBlock();
    return () => { useTabuadaSemanalStore.getState().reset(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, blockNumber]);

  // ─── Retry: mesmo bloco, tentar de novo (só dentro do próprio dia) ───────────
  const handleRetry = useCallback(() => {
    setResult(null);
    setSubmitError(null);
    setLoadError(null);
    submittingRef.current = false;
    void loadBlock();
  }, [loadBlock]);

  // ─── Timer ───────────────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (useTabuadaSemanalStore.getState().phase !== 'playing') return;
    useTabuadaSemanalStore.getState().submitAnswer(null);
    setInputDigits([]);
  }, []);

  const { remaining, reset: resetTimer } = useTimer(
    WEEKLY_TABUADA.TIME_PER_QUESTION_SECONDS,
    phase === 'playing',
    handleTimerExpire,
  );

  useEffect(() => {
    if (phase === 'playing') {
      resetTimer();
      setInputDigits([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, phase]);

  // Feedback "correto" — breve, auto-avança (sem badge de XP, este módulo não tem XP)
  useEffect(() => {
    if (phase !== 'correct') return;
    const timer = setTimeout(() => {
      if (useTabuadaSemanalStore.getState().phase === 'correct') {
        useTabuadaSemanalStore.getState().setPhase('playing');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [phase]);

  // ─── Submissão do bloco ao servidor ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'completed' || submittingRef.current || !child) return;
    submittingRef.current = true;
    (async () => {
      try {
        const answers = useTabuadaSemanalStore.getState().answers.map((a) => ({
          position: a.position,
          fact_id: a.fact_id,
          child_answer: a.child_answer,
        }));
        const res = await tabuadaSemanalService.submitBlock(child.id, blockNumber, answers);
        setResult(res);
        void queryClient.invalidateQueries({ queryKey: ['tabuada-today'] });
        void queryClient.invalidateQueries({ queryKey: ['tabuada-week-status'] });
        void queryClient.invalidateQueries({ queryKey: ['tabuada-week-days'] });
      } catch (e) {
        setSubmitError((e as Error).message);
      }
    })();
  }, [phase, child, blockNumber]);

  // ─── Input ───────────────────────────────────────────────────────────────────
  const handleDigit = useCallback((d: number) => {
    if (useTabuadaSemanalStore.getState().phase !== 'playing') return;
    setInputDigits((prev) => (prev.length >= 3 ? prev : [...prev, d]));
  }, []);
  const handleDelete = useCallback(() => setInputDigits((p) => p.slice(0, -1)), []);
  const handleSubmit = useCallback(() => {
    const s = useTabuadaSemanalStore.getState();
    if (s.phase !== 'playing') return;
    setInputDigits((prev) => {
      if (prev.length === 0) return prev;
      s.submitAnswer(parseInt(prev.join(''), 10));
      return [];
    });
  }, []);

  // ─── Loading / error de arranque ─────────────────────────────────────────────
  if (!child || phase === 'idle') {
    if (loadError) {
      return (
        <SafeAreaView style={gs.centered}>
          <Text variant="body" color={colors.text.secondary} align="center" style={{ marginBottom: space.md }}>
            {t(loadError) === loadError ? t('errors.generic') : t(loadError)}
          </Text>
          <Pressable onPress={() => router.back()} style={gs.errBtn}>
            <Text variant="button" color={colors.text.inverse}>{t('common.back')}</Text>
          </Pressable>
        </SafeAreaView>
      );
    }
    return (
      <View style={[gs.container, gs.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Wrong / timeout ──────────────────────────────────────────────────────────
  if (phase === 'wrong' || phase === 'timeout') {
    const q = lastAnsweredQuestion;
    return (
      <WrongAnswerScreen
        operandA={q?.operand_a ?? 0}
        operandB={q?.operand_b ?? 0}
        correctAnswer={q?.correct_answer ?? 0}
        userAnswer={lastUserAnswer}
        operation={q?.operation}
        onContinue={() => useTabuadaSemanalStore.getState().advanceAfterWrong()}
      />
    );
  }

  // ─── Bloco concluído — submissão + resultado ─────────────────────────────────
  if (phase === 'completed') {
    if (submitError) {
      return (
        <SafeAreaView style={gs.centered}>
          <Text variant="body" color={colors.error} align="center" style={{ marginBottom: space.md }}>
            {submitError}
          </Text>
          <Pressable
            onPress={() => router.replace('/(app)/tabuada-semanal')}
            style={gs.errBtn}
          >
            <Text variant="button" color={colors.text.inverse}>{t('common.back')}</Text>
          </Pressable>
        </SafeAreaView>
      );
    }

    if (!result) {
      return (
        <View style={[gs.container, gs.centered]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="body" color={colors.text.secondary} style={{ marginTop: space.md }}>
            {t('tabuadaSemanal.submitting')}
          </Text>
        </View>
      );
    }

    const passed = result.blockPassed;
    const maxed = result.correctCount === WEEKLY_TABUADA.QUESTIONS_PER_BLOCK;
    const weeklyReward = Number(child?.tabuada_weekly_reward ?? 0);
    const earnedCents = tabuadaBlockEarnedCents(weeklyReward, result.correctCount);
    const blockMaxCents = tabuadaBlockEarnedCents(weeklyReward, WEEKLY_TABUADA.QUESTIONS_PER_BLOCK);
    const todayEarnedCents = sumTabuadaBlocksEarnedCents(result.blocksState, weeklyReward);
    const showDayCompleteModal = result.dayCompleted && result.justCompleted && !dayCompleteDismissed;

    return (
      <SafeAreaView style={[gs.resultRoot, { backgroundColor: passed ? '#ECFDF5' : '#FFFBEB' }]}>
        <TabuadaDayCompleteModal
          visible={showDayCompleteModal}
          earnedCents={todayEarnedCents}
          medalEarned={result.weekStatus.medalEarned}
          parentWillBeNotified={parentWillBeNotified}
          onContinue={() => setDayCompleteDismissed(true)}
        />
        <View style={gs.resultBody}>
          <View style={[gs.resultIconWrap, { backgroundColor: passed ? colors.success : colors.warning }]}>
            <Ionicons name={passed ? 'checkmark' : 'refresh'} size={44} color="#fff" />
          </View>
          <Text variant="h1" align="center">
            {t(passed ? 'tabuadaSemanal.blockPassedTitle' : 'tabuadaSemanal.blockFailedTitle')}
          </Text>
          <Text variant="body" color={colors.text.secondary} align="center">
            {t('tabuadaSemanal.blockScore', { correct: result.correctCount, total: WEEKLY_TABUADA.QUESTIONS_PER_BLOCK })}
          </Text>

          {blockMaxCents > 0 && (
            <View style={gs.earnedBanner}>
              <Ionicons name="cash-outline" size={20} color="#B8860B" />
              <Text variant="label" style={{ flex: 1 }}>
                {t('tabuadaSemanal.blockEarnedResult', { earned: centsToEuroLabel(earnedCents), total: centsToEuroLabel(blockMaxCents) })}
              </Text>
            </View>
          )}

          {!maxed && (
            <Text variant="bodySmall" color={colors.text.secondary} align="center">
              {t('tabuadaSemanal.blockPassedRetryHint')}
            </Text>
          )}

          {result.dayCompleted && (
            <View style={gs.dayCompleteBanner}>
              <Ionicons name="star" size={20} color={colors.trophy.gold} />
              <Text variant="label" color="#7A5A00">{t('tabuadaSemanal.dayCompleteBanner')}</Text>
            </View>
          )}
          {!result.dayCompleted && result.tabuadaBlocksPassed && (
            <Pressable
              style={gs.almostDoneBanner}
              onPress={() => router.push(`/(app)/challenge/${new Date().toISOString().split('T')[0]}`)}
            >
              <Ionicons name="flash" size={18} color="#fff" />
              <Text variant="label" color={colors.text.inverse} style={{ flex: 1 }}>
                {t('tabuadaSemanal.almostDoneBanner')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </Pressable>
          )}
          {result.weekStatus.medalEarned && (
            <View style={gs.medalBanner}>
              <Ionicons name="medal" size={24} color="#fff" />
              <Text variant="label" color={colors.text.inverse} style={{ flex: 1 }}>
                {t('tabuadaSemanal.medalEarnedSubtitle')}
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: space.sm }}>
          {!maxed && (
            <Pressable style={gs.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text variant="button" color={colors.text.inverse}>{t('tabuadaSemanal.retryBlockCta')}</Text>
            </Pressable>
          )}
          <Pressable
            style={gs.continueBtn}
            onPress={() => router.replace('/(app)/tabuada-semanal')}
          >
            <Text variant="button" color="#16A34A">{t('common.continue')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Gameplay ─────────────────────────────────────────────────────────────────
  const timerBg = remaining <= 2 ? '#FEE2E2' : remaining <= 5 ? '#FFF3EC' : '#E4E5EF';
  const timerColor = remaining <= 2 ? colors.error : remaining <= 5 ? colors.accent : '#6B7280';

  return (
    <View style={gs.container}>
      <View style={gs.header}>
        <Pressable
          onPress={() => { useTabuadaSemanalStore.getState().reset(); router.back(); }}
          style={gs.exitBtnCircle}
          accessibilityLabel={t('challenge.exitChallengeLabel')}
        >
          <Ionicons name="close" size={22} color="#4B5563" />
        </Pressable>

        <View style={gs.headerMiddle}>
          <Text style={gs.headerTitle}>
            {t('challenge.question', { current: String(currentIndex + 1), total: String(WEEKLY_TABUADA.QUESTIONS_PER_BLOCK) })}
          </Text>
          <View style={{ height: 6 }} />
          <View style={gs.progressTrack}>
            <View style={[gs.progressFill, { width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
          </View>
        </View>

        <View style={[gs.timerChip, { backgroundColor: timerBg }]}>
          <Ionicons name="time-outline" size={15} color={timerColor} />
          <Text style={[gs.timerText, { color: timerColor }]}>{remaining}s</Text>
        </View>
      </View>

      <View style={gs.questionArea}>
        <View style={gs.blockBadge}>
          <Text style={gs.blockBadgeText}>{t('tabuadaSemanal.blockLabel', { n: blockNumber })}</Text>
        </View>

        {question ? (
          <View style={gs.equationRow}>
            <Text style={gs.operandText}>{question.operand_a}</Text>
            <Text style={gs.operatorText}>{OPERATION_SYMBOLS[question.operation ?? MODULE_ID.MULTIPLICATION]}</Text>
            <Text style={gs.operandText}>{question.operand_b}</Text>
            <Text style={gs.operatorText}>=</Text>
            <View style={[gs.answerBox, inputDigits.length > 0 ? gs.answerBoxActive : null] as StyleProp<ViewStyle>}>
              <Text style={gs.answerBoxText}>{inputDigits.join('') || '?'}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <NumericKeypad
        onDigit={handleDigit}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        hasInput={inputDigits.length > 0 && phase === 'playing'}
        disabled={phase !== 'playing'}
      />

      {phase === 'correct' && <CorrectCheckBurst />}
    </View>
  );
}

const gs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1FF', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  errBtn: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: space.xl, paddingVertical: space.md },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exitBtnCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EDEEF5', alignItems: 'center', justifyContent: 'center' },
  headerMiddle: { flex: 1 },
  headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 12, color: '#1A1F36', marginBottom: 4 },
  progressTrack: { height: 10, backgroundColor: '#FEF3C7', borderRadius: 9999, overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: colors.trophy.gold, borderRadius: 9999 },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  timerText: { fontFamily: fontFamily.extraBold, fontSize: 14 },

  questionArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockBadge: { backgroundColor: '#FEF3C7', borderRadius: 9999, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 28 },
  blockBadgeText: { fontFamily: fontFamily.extraBold, fontSize: 14, color: '#92400E' },

  equationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 8 },
  operandText: { fontFamily: fontFamily.extraBold, fontSize: 72, lineHeight: 88, color: '#1A1F36', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  operatorText: { fontFamily: fontFamily.extraBold, fontSize: 60, lineHeight: 88, color: '#2B52E5', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  answerBox: { minWidth: 96, height: 96, borderRadius: 24, borderWidth: 4, borderColor: '#C8CEFF', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  answerBoxActive: { borderStyle: 'solid', borderColor: '#2B52E5', backgroundColor: '#DCE2FF' },
  answerBoxText: { fontFamily: fontFamily.extraBold, fontSize: 72, lineHeight: 88, color: '#2B52E5', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,

  resultRoot: { flex: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 32 },
  resultBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  resultIconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  dayCompleteBanner: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: '#FEF3C7', borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm },
  almostDoneBanner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: '#16A34A', borderRadius: radius.xl, padding: space.md, width: '100%' },
  medalBanner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.trophy.gold, borderRadius: radius.xl, padding: space.md, width: '100%' },
  earnedBanner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: '#fff', borderRadius: radius.xl, padding: space.md, width: '100%' },
  continueBtn: { height: 58, borderRadius: 9999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  retryBtn: { height: 58, borderRadius: 9999, backgroundColor: '#2B52E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
