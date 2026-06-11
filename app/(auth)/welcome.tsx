import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk
import { Dimensions, Image } from 'react-native'; // eslint-disable-line
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
// @ts-expect-error reanimated named-export quirk
import { withRepeat, withSequence, withDelay, cancelAnimation, interpolate, Extrapolation } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated Easing named-export quirk
import { Easing } from 'react-native-reanimated'; // eslint-disable-line
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors, radius, space } from '@/theme';

const W: number = (Dimensions as { get: (s: string) => { width: number; height: number } }).get('window').width;
const H: number = (Dimensions as { get: (s: string) => { width: number; height: number } }).get('window').height;

const GOLD  = colors.warning;
const WHITE = colors.text.inverse;

// ─── Floating math symbols (identical to SplashScreen) ────────────────────────

const FLOATERS = [
  { symbol: '+', left: 0.06, size: 20, delay: 0,    dur: 7000, drift: 18,  alpha: 0.20 },
  { symbol: '7', left: 0.14, size: 24, delay: 2100, dur: 9000, drift: -16, alpha: 0.22 },
  { symbol: '−', left: 0.22, size: 16, delay: 1600, dur: 8000, drift: -14, alpha: 0.18 },
  { symbol: '×', left: 0.38, size: 20, delay: 800,  dur: 6500, drift: 22,  alpha: 0.18 },
  { symbol: '3', left: 0.42, size: 20, delay: 2200, dur: 7200, drift: -16, alpha: 0.22 },
  { symbol: '÷', left: 0.52, size: 18, delay: 2400, dur: 7500, drift: -10, alpha: 0.18 },
  { symbol: '=', left: 0.60, size: 18, delay: 400,  dur: 8500, drift: 16,  alpha: 0.18 },
  { symbol: '9', left: 0.68, size: 26, delay: 600,  dur: 8800, drift: 20,  alpha: 0.22 },
  { symbol: '+', left: 0.78, size: 16, delay: 4000, dur: 7000, drift: -12, alpha: 0.18 },
  { symbol: '5', left: 0.82, size: 20, delay: 2800, dur: 6600, drift: -12, alpha: 0.22 },
  { symbol: '×', left: 0.94, size: 16, delay: 1200, dur: 6800, drift: 12,  alpha: 0.18 },
] as const;

type FloaterCfg = typeof FLOATERS[number];

function FloatingSymbol({ symbol, left, size, delay, dur, drift, alpha }: FloaterCfg) {
  const progress = useSharedValue(0);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => {
    const p: number = progress.value;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const rotDeg: number = interpolate(p, [0, 1], [0, 180]);
    return {
      position: 'absolute' as const,
      bottom: 0,
      left: W * left,
      fontSize: size,
      color: WHITE,
      fontWeight: '800' as const,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      opacity: interpolate(p, [0, 0.10, 0.88, 1], [0, alpha, alpha, 0], Extrapolation.CLAMP),
      transform: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { translateY: interpolate(p, [0, 0.10, 0.88, 1], [0, -H * 0.04, -H * 0.92, -H * 1.15]) },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { translateX: interpolate(p, [0, 1], [0, drift]) },
        { rotate: `${rotDeg}deg` },
      ],
    };
  });
  return <Animated.Text style={animStyle as StyleProp<TextStyle>}>{symbol}</Animated.Text>;
}

// ─── Orbit stars ──────────────────────────────────────────────────────────────

const ORBIT_STARS = [
  { angle:   0, radius: 100, size: 16, duration:  9000 },
  { angle: 120, radius: 108, size: 12, duration: 11000 },
  { angle: 240, radius:  92, size: 14, duration: 10000 },
] as const;

const ORBIT_SIZE = 240;

type StarCfg = typeof ORBIT_STARS[number];

function OrbitStar({ angle: initialAngle, radius: r, size, duration }: StarCfg) {
  const rotation = useSharedValue(initialAngle);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    rotation.value = withRepeat(withTiming(initialAngle + 360, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const center = ORBIT_SIZE / 2;
  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: center - size / 2,
    top:  center - size / 2,
    width: size,
    height: size,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    transform: [
      { rotate: `${rotation.value}deg` },
      { translateX: r },
      { rotate: `${-rotation.value}deg` },
    ],
  }));
  return (
    <Animated.View style={animStyle}>
      <RNText style={{ color: GOLD, fontSize: size, lineHeight: size + 2 }}>★</RNText>
    </Animated.View>
  );
}

// ─── Title letter-by-letter ────────────────────────────────────────────────────

const TITLE       = 'Math Hero Kids';
const TITLE_CHARS = TITLE.split('');

function TitleLetter({ char, index, titleProgress }: { char: string; index: number; titleProgress: SharedValue<number> }) {
  const animStyle = useAnimatedStyle(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const p: number = interpolate(titleProgress.value, [index, index + 1], [0, 1], Extrapolation.CLAMP);
    return {
      fontFamily:    'Nunito_800ExtraBold',
      fontSize:       38,
      lineHeight:     46,
      color:          WHITE,
      letterSpacing: -0.5,
      opacity: p,
      transform: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { translateY: interpolate(p, [0, 1], [16, 0]) },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { scale:      interpolate(p, [0, 1], [0.7, 1]) },
      ],
    };
  });
  return <Animated.Text style={animStyle as StyleProp<TextStyle>}>{char}</Animated.Text>;
}

// ─── Feature pills ────────────────────────────────────────────────────────────

const FEATURE_KEYS = [
  { key: 'trophies',   icon: '🏆', iconBg: colors.warning },
  { key: 'challenges', icon: '✨', iconBg: colors.accent  },
  { key: 'profiles',   icon: '⭐', iconBg: colors.success },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // Shared animation values
  const mascotScale   = useSharedValue(0);
  const floatAnim     = useSharedValue(0);
  const haloAnim      = useSharedValue(0);
  const sparkleAnim   = useSharedValue(0);
  const titleProgress = useSharedValue(0);
  const contentAnim   = useSharedValue(0);

  useEffect(() => {
    mascotScale.value = withSpring(1, { damping: 10, stiffness: 160 });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    floatAnim.value   = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    haloAnim.value    = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    sparkleAnim.value = withRepeat(withTiming(1, { duration: 900,  easing: Easing.inOut(Easing.ease) }), -1, true);

    titleProgress.value = withDelay( // eslint-disable-line @typescript-eslint/no-unsafe-call
      600,
      withTiming(TITLE_CHARS.length, { duration: TITLE_CHARS.length * 55, easing: Easing.out(Easing.ease) }),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    contentAnim.value = withDelay(1400, withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }));

    return () => {
      cancelAnimation(mascotScale);
      cancelAnimation(floatAnim);
      cancelAnimation(haloAnim);
      cancelAnimation(sparkleAnim);
      cancelAnimation(titleProgress);
      cancelAnimation(contentAnim);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mascotStyle = useAnimatedStyle(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const scale: number  = interpolate(mascotScale.value, [0, 0.65, 1], [0, 1.12, 1], Extrapolation.CLAMP);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const floatY: number = interpolate(floatAnim.value, [0, 1], [0, -12]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const floatR: number = interpolate(floatAnim.value, [0, 1], [-1.5, 1.5]);
    return { transform: [{ scale }, { translateY: floatY }, { rotate: `${floatR}deg` }] };
  });

  const haloStyle = useAnimatedStyle(() => ({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    opacity: interpolate(haloAnim.value, [0, 1], [0.4, 0.75]),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transform: [{ scale: interpolate(haloAnim.value, [0, 1], [1.2, 1.45]) }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      { scale: interpolate(sparkleAnim.value, [0, 1], [0.8, 1.2]) },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      { rotate: `${interpolate(sparkleAnim.value, [0, 1], [0, 20])}deg` },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentAnim.value,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transform: [{ translateY: interpolate(contentAnim.value, [0, 1], [20, 0]) }],
  }));

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={styles.root}
    >
      {/* Glows de fundo */}
      <View style={styles.glowTL} />
      <View style={styles.glowBR} />

      {/* Símbolos flutuantes */}
      <View style={styles.floatersLayer} pointerEvents="none">
        {FLOATERS.map((f, i) => <FloatingSymbol key={i} {...f} />)}
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.scroll}>

          {/* ── Mascote + órbita ────────────────────────────────────── */}
          <View style={styles.orbitContainer}>
            <Animated.View style={[styles.halo, haloStyle] as StyleProp<ViewStyle>} />
            {ORBIT_STARS.map((s, i) => <OrbitStar key={i} {...s} />)}

            <Animated.View style={mascotStyle}>
              <View style={styles.mascotRing}>
                <View style={styles.mascotCircle}>
                  <Image
                    source={require('../../assets/images/milo-mascot.png')}
                    style={styles.mascotImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </Animated.View>

            {/* Sparkle ✦ */}
            <Animated.View style={[styles.sparkle, sparkleStyle] as StyleProp<ViewStyle>}>
              <RNText style={styles.sparkleText}>✦</RNText>
            </Animated.View>
          </View>

          {/* ── Título letra a letra ─────────────────────────────────── */}
          <View style={styles.titleRow}>
            {TITLE_CHARS.map((char, i) => (
              <TitleLetter key={i} char={char} index={i} titleProgress={titleProgress} />
            ))}
          </View>

          {/* ── Subtítulo + pills + botões (fade-in conjunto) ────────── */}
          <Animated.View style={[styles.contentBlock, contentStyle] as StyleProp<ViewStyle>}>
            <Text
              variant="bodyLarge"
              color="rgba(255,255,255,0.82)"
              align="center"
              style={styles.subtitle}
            >
              {t('auth.welcome.subtitle')}
            </Text>

            <View style={styles.features}>
              {FEATURE_KEYS.map((f) => (
                <View key={f.key} style={styles.pill}>
                  <View style={[styles.pillIcon, { backgroundColor: f.iconBg }]}>
                    <RNText style={{ fontSize: 18 }}>{f.icon}</RNText>
                  </View>
                  <Text variant="label" color={colors.text.inverse} style={styles.pillLabel}>
                    {t(`auth.welcome.features.${f.key}`)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Button
                label={t('auth.welcome.getStarted')}
                variant="secondary"
                size="lg"
                onPress={() => router.push('/(auth)/register/parent')}
              />
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text variant="label" color="#fff" style={styles.ghostBtnLabel}>
                  {t('auth.welcome.signIn')}
                </Text>
              </Pressable>
            </View>
          </Animated.View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  glowTL: {
    position: 'absolute', left: -96, top: -96,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  glowBR: {
    position: 'absolute', right: -80, bottom: -112,
    width: 384, height: 384, borderRadius: 192,
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  floatersLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },

  scroll: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },

  // ── Orbit + mascote ─────────────────────────────────────────────────────────
  orbitContainer: {
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  halo: {
    position: 'absolute',
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  mascotRing: {
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotCircle: {
    width: 124, height: 124,
    borderRadius: 62,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...({
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    } as object),
  },
  mascotImage: { width: 108, height: 108 },
  sparkle: {
    position: 'absolute',
    top:   ORBIT_SIZE / 2 - 80 - 12,
    right: ORBIT_SIZE / 2 - 80 - 16,
    zIndex: 20,
  },
  sparkleText: { color: GOLD, fontSize: 26, lineHeight: 30 },

  // ── Título ──────────────────────────────────────────────────────────────────
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginBottom: space.xs,
  },

  // ── Conteúdo animado ────────────────────────────────────────────────────────
  contentBlock: { width: '100%', alignItems: 'center', flex: 1 },
  subtitle: { lineHeight: 24, maxWidth: 300, marginBottom: space.md, textAlign: 'center' },

  features: { width: '100%', gap: space.xs, marginBottom: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  pillIcon: {
    width: 38, height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: { flex: 1, lineHeight: 20 },

  actions: { width: '100%', gap: space.xs, marginTop: 'auto' as never },
  ghostBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnPressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
  ghostBtnLabel: { letterSpacing: 0.3 } as import('react-native').TextStyle,
});
