/**
 * CompletedScreen — tela de sucesso ao concluir o desafio.
 * Porta fiel do success-screen.tsx do design reference.
 *
 * Animações (spring/stagger via Reanimated):
 *   100ms  — XP badge entra de cima + scale
 *   200ms  — Milo container spring scale + rotate
 *   450ms  — título sobe
 *   600ms  — subtítulo sobe
 *   700ms  — trophy badge + progress section aparecem
 *   800ms  — barra de progresso anima 0% → pct%
 *  1000ms  — botão sobe
 *  + loop  — Milo flutua suavemente para cima/baixo
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
// @ts-expect-error TS6/RN0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated withDelay named-export quirk
import { withDelay } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated Easing named-export quirk
import { Easing } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withRepeat named-export quirk
import { withRepeat } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withSequence named-export quirk
import { withSequence } from 'react-native-reanimated'; // eslint-disable-line
import { useTranslation } from 'react-i18next';
import type { ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { CHALLENGE } from '@/constants/config';
import { useChallengeStore } from '@/stores/challenge.store';
import { fontFamily } from '@/theme';

const MILO_CELEBRATE = require('../../../assets/images/milo-celebrate.png') as number;

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#2B52E5', '#F5722A', '#22C55E', '#EF4444',
  '#F59E0B', '#8B5CF6', '#EC4899', '#FFFFFF',
];
const CONFETTI_COUNT = 72;

type CPiece = { x: number; color: string; size: number; aspect: number; delay: number; dur: number };

function buildConfetti(n: number): CPiece[] {
  let seed = 99;
  const r = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
  return Array.from({ length: n }, (_, i) => ({
    x:      r() * 96,
    color:  CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    size:   6 + r() * 9,
    aspect: r() > 0.5 ? 1 : 2.5,
    delay:  r() * 700,
    dur:    1800 + r() * 1400,
  }));
}

const PIECES = buildConfetti(CONFETTI_COUNT);

function ConfettoPiece({ piece }: { piece: CPiece }) {
  const y       = useSharedValue(-20);
  const rot     = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const run = () => {
      y.value       = withTiming(980, { duration: piece.dur, easing: Easing.linear });
      rot.value     = withTiming(720, { duration: piece.dur, easing: Easing.linear });
      const fadeAt  = Math.round(piece.dur * 0.65);
      opacity.value = withDelay(
        fadeAt,
        withTiming(0, { duration: piece.dur - fadeAt, easing: Easing.linear }),
      );
    };
    let t: ReturnType<typeof setTimeout> | undefined;
    if (piece.delay > 0) { t = setTimeout(run, piece.delay); } else { run(); }
    return () => { if (t !== undefined) clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: y.value },
      { rotate: `${rot.value}deg` as unknown as number },
    ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  const itemStyle: ViewStyle = {
    position:        'absolute',
    left:            piece.x as unknown as number, // applied as % in style below
    top:             0,
    width:           piece.size,
    height:          piece.size * piece.aspect,
    borderRadius:    piece.aspect <= 1.4 ? piece.size / 2 : 3,
    backgroundColor: piece.color,
  };

  return (
    <Animated.View
      style={[
        itemStyle,
        { left: `${piece.x}%` as unknown as number },
        anim,
      ]}
    />
  );
}

function Confetti() {
  return (
    <View style={cs.container} pointerEvents="none">
      {PIECES.map((p, i) => <ConfettoPiece key={i} piece={p} />)}
    </View>
  );
}

const cs = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

// ─── CompletedScreen ──────────────────────────────────────────────────────────

export function CompletedScreen({
  xpOverride,
  questionsCorrect,
  onContinue,
  isLoading,
}: {
  xpOverride?: number;
  questionsCorrect?: number;
  onContinue: () => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const total = useChallengeStore.getState().totalQuestions || CHALLENGE.TOTAL_QUESTIONS;
  const xp    = xpOverride ?? 300;
  const qs    = questionsCorrect ?? total;
  const pct   = Math.min(100, Math.round((qs / total) * 100));

  // ── Shared values ──────────────────────────────────────────────────────────
  const badgeY      = useSharedValue(-30);
  const badgeScale  = useSharedValue(0.7);
  const badgeOp     = useSharedValue(0);

  const miloScale   = useSharedValue(0);
  const miloRot     = useSharedValue(-25);
  const miloFloat   = useSharedValue(0);

  const trophyScale = useSharedValue(0);

  const titleY      = useSharedValue(24);
  const titleOp     = useSharedValue(0);

  const subY        = useSharedValue(16);
  const subOp       = useSharedValue(0);

  const progressOp  = useSharedValue(0);
  const barWidth    = useSharedValue(0);

  const btnY        = useSharedValue(40);
  const btnOp       = useSharedValue(0);

  useEffect(() => {
    // XP badge (100ms)
    badgeY.value     = withDelay(100, withSpring(0, { stiffness: 320, damping: 18 }));
    badgeScale.value = withDelay(100, withSpring(1, { stiffness: 320, damping: 18 }));
    badgeOp.value    = withDelay(100, withTiming(1, { duration: 180 }));

    // Milo entrance (200ms)
    miloScale.value = withDelay(200, withSpring(1, { stiffness: 200, damping: 12 }));
    miloRot.value   = withDelay(200, withSpring(0, { stiffness: 200, damping: 12 }));

    // Milo float loop (starts after entrance ~700ms)
    miloFloat.value = withDelay(700, withRepeat(
      withSequence(
        withTiming(-12, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(  0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    ));

    // Trophy badge (700ms)
    trophyScale.value = withDelay(700, withSpring(1, { stiffness: 300, damping: 12 }));

    // Title (450ms)
    titleY.value  = withDelay(450, withSpring(0, { stiffness: 260, damping: 18 }));
    titleOp.value = withDelay(450, withTiming(1, { duration: 240 }));

    // Subtitle (600ms)
    subY.value  = withDelay(600, withSpring(0, { stiffness: 260, damping: 18 }));
    subOp.value = withDelay(600, withTiming(1, { duration: 240 }));

    // Progress section (700ms) + bar fill (800ms, 1s ease-out)
    progressOp.value = withDelay(700, withTiming(1, { duration: 280 }));
    barWidth.value   = withDelay(800, withTiming(pct, { duration: 1000, easing: Easing.out(Easing.cubic) }));

    // Button (1000ms)
    btnY.value  = withDelay(1000, withSpring(0, { stiffness: 260, damping: 20 }));
    btnOp.value = withDelay(1000, withTiming(1, { duration: 280 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animated styles (cast to any — this project's RN types quirk) ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const badgeAnim = useAnimatedStyle(() => ({
    opacity:   badgeOp.value,
    transform: [{ translateY: badgeY.value }, { scale: badgeScale.value }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const miloContainerAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: miloScale.value },
      { rotate: `${miloRot.value}deg` as unknown as number },
    ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const miloFloatAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: miloFloat.value }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trophyBadgeAnim = useAnimatedStyle(() => ({
    transform: [{ scale: trophyScale.value }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const titleAnim = useAnimatedStyle(() => ({
    opacity:   titleOp.value,
    transform: [{ translateY: titleY.value }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAnim = useAnimatedStyle(() => ({
    opacity:   subOp.value,
    transform: [{ translateY: subY.value }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const progressSectionAnim = useAnimatedStyle(() => ({ opacity: progressOp.value })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barAnim = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as `${number}%`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btnAnim = useAnimatedStyle(() => ({
    opacity:   btnOp.value,
    transform: [{ translateY: btnY.value }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return (
    <LinearGradient
      colors={['#FDE68A', '#F59E0B', '#C97B0A']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.root}
    >
      <Confetti />

      {/* XP badge — top right */}
      <Animated.View style={[s.xpBadge, badgeAnim]}>
        <Ionicons name="flash" size={18} color="#fff" style={{ marginRight: 4 }} />
        <Text style={s.xpBadgeText}>+{xp} XP</Text>
      </Animated.View>

      {/* Center content */}
      <View style={s.content}>

        {/* Milo float wrapper */}
        <Animated.View style={miloFloatAnim}>
          {/* Milo spring-in wrapper */}
          <Animated.View style={[s.miloOuter, miloContainerAnim]}>
            <View style={s.miloCircle}>
              <Image source={MILO_CELEBRATE} style={s.miloImg} resizeMode="contain" />
            </View>
            {/* Orange trophy badge */}
            <Animated.View style={[s.trophyBadge, trophyBadgeAnim]}>
              <Ionicons name="trophy" size={22} color="#fff" />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={titleAnim}>
          <Text style={s.title}>{t('challenge.completed.title')}</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={subAnim}>
          <Text style={s.subtitle}>{t('challenge.completed.subtitle')}</Text>
        </Animated.View>

        {/* Progress */}
        <Animated.View style={[s.progressSection, progressSectionAnim]}>
          <View style={s.progressRow}>
            <Text style={s.progressLabel}>
              {t('challenge.completed.questionsLabel', { done: qs, total })}
            </Text>
            <Text style={s.progressLabel}>{pct}%</Text>
          </View>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, barAnim]} />
          </View>
        </Animated.View>

      </View>

      {/* Continue button / loading */}
      {isLoading
        ? <ActivityIndicator color="#fff" size="large" style={{ marginBottom: 40 }} />
        : (
          <Animated.View style={[s.btnWrapper, btnAnim]}>
            <Pressable
              style={({ pressed }) => [s.continueBtn, pressed && s.continueBtnPressed]}
              onPress={onContinue}
            >
              <Text style={s.continueBtnText}>{t('common.continue')}</Text>
            </Pressable>
          </Animated.View>
        )
      }
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  xpBadge: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  xpBadgeText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
    color: '#fff',
    letterSpacing: 0.2,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  miloOuter: {
    position: 'relative',
    marginBottom: 28,
  },
  miloCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    borderWidth: 6,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  miloImg: { width: 192, height: 192 },

  trophyBadge: {
    position: 'absolute',
    bottom: 4,
    right: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5722A',
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

  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 40,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 48,
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 300,
  },

  progressSection: {
    width: '100%',
    marginTop: 32,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
  },
  progressTrack: {
    height: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 14,
    backgroundColor: '#fff',
    borderRadius: 999,
  },

  btnWrapper: { width: '100%' },
  continueBtn: {
    backgroundColor: '#fff',
    borderRadius: 999,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  continueBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  continueBtnText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
    color: '#C97B0A',
  },
});
