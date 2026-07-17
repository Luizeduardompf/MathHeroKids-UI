/**
 * Challenge status screens: TimeExpiredScreen, WrongAnswerScreen, BlockEndScreen.
 *
 * Port do zip: design/exports/04-challenge-status screens.zip
 * Full-screen (não card), fundo colorido suave, MiloBubble redesenhado,
 * botões rounded-full.
 */

import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
// @ts-expect-error RN 0.85 — Image presente em runtime mas TS quirk
import { Image } from 'react-native'; // eslint-disable-line
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated Easing named-export quirk
import { Easing } from 'react-native-reanimated'; // eslint-disable-line

import { Text } from '@/components/ui';
import { fontFamily } from '@/theme';
import { playSound } from '@/services/sound.service';

// ─── MiloBubble ───────────────────────────────────────────────────────────────
// Port do zip: components/milo-bubble.tsx
// [avatar branco 64px] + [col: label + card branca com mensagem]

const MILO_IMG = require('../../../assets/images/milo-celebrate.png') as number;

type BubbleTone = 'destructive' | 'warning' | 'primary';

const BUBBLE_BG: Record<BubbleTone, string> = {
  destructive: '#EF4444',
  warning:     '#F59E0B',
  primary:     '#2B52E5',
};
const LABEL_ALPHA: Record<BubbleTone, string> = {
  destructive: 'rgba(255,255,255,0.80)',
  warning:     'rgba(255,255,255,0.75)',
  primary:     'rgba(255,255,255,0.80)',
};

export function MiloBubble({ message, tone = 'primary' }: { message: string; tone?: BubbleTone }) {
  return (
    <View style={[mb.wrap, { backgroundColor: BUBBLE_BG[tone] }]}>
      <View style={mb.avatarWrap}>
        <Image source={MILO_IMG} style={mb.avatar} resizeMode="contain" />
      </View>
      <View style={mb.col}>
        <Text style={[mb.label, { color: LABEL_ALPHA[tone] }]}>Milo diz</Text>
        <View style={mb.card}>
          <Text style={mb.cardText}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const mb = StyleSheet.create({
  // flex row, rounded-3xl, p-3 pr-4, shadow-sm
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    padding: 12,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // size-16 rounded-full bg-card
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatar: { width: 52, height: 52 },
  col: { flex: 1, gap: 5 },
  // text-xs font-bold uppercase tracking-wide
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  // rounded-2xl bg-card px-4 py-2.5
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#1A1F36',
    lineHeight: 20,
  },
});

// ─── ActionButton ─────────────────────────────────────────────────────────────
// Port do zip: components/action-button.tsx
// h-14 (56px) rounded-full w-full font-bold text-lg

type ActionTone = 'primary' | 'success' | 'warning' | 'neutral';

const BTN_BG: Record<ActionTone, string>  = { primary: '#2B52E5', success: '#22C55E', warning: '#F59E0B', neutral: '#EDEEF5' };
const BTN_FG: Record<ActionTone, string>  = { primary: '#fff',    success: '#fff',    warning: '#fff',    neutral: '#6B7280' };

export function ActionButton({ tone = 'primary', icon, label, onPress }: {
  tone?: ActionTone; icon?: string; label: string; onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) =>
        [ab.btn, { backgroundColor: BTN_BG[tone], opacity: pressed ? 0.78 : 1 }] as StyleProp<ViewStyle>
      }
      onPress={onPress}
    >
      {icon ? <Ionicons name={icon as never} size={20} color={BTN_FG[tone]} /> : null}
      <Text style={[ab.label, { color: BTN_FG[tone] }]}>{label}</Text>
    </Pressable>
  );
}

const ab = StyleSheet.create({
  btn: {
    height: 56,
    width: '100%',
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: { fontFamily: fontFamily.bold, fontSize: 17 },
});

// ─── Entrance animation wrapper ───────────────────────────────────────────────

function EntranceView({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value    = withTiming(1,  { duration: 320, easing: Easing.out(Easing.cubic) });
    translateY.value = withSpring(0, { damping: 16, stiffness: 160 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[anim, style] as StyleProp<ViewStyle>}>
      {children}
    </Animated.View>
  );
}

// ─── StatusIcon ───────────────────────────────────────────────────────────────
// Anel externo suave + círculo interno sólido + ícone
// Espelha o padrão do zip: outer bg-color/15, inner bg-color solid

function StatusIcon({ name, outerBg, innerBg, iconColor = '#fff', outer = 112, inner = 88, icon = 44 }: {
  name: string; outerBg: string; innerBg: string;
  iconColor?: string; outer?: number; inner?: number; icon?: number;
}) {
  return (
    <View style={[si.ring, { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: outerBg }]}>
      <View style={[si.core, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: innerBg }]}>
        <Ionicons name={name as never} size={icon} color={iconColor} />
      </View>
    </View>
  );
}
const si = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  core: { alignItems: 'center', justifyContent: 'center' },
});

// ─── TimeExpiredScreen ────────────────────────────────────────────────────────

export function TimeExpiredScreen({ onRetry, onGoHome }: { onRetry: () => void; onGoHome: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    playSound('wrong');
  }, []);

  return (
    <View style={[sc.root, { backgroundColor: '#FEF2F2' }]}>
      <EntranceView style={sc.body}>
        <StatusIcon
          name="time-outline"
          outerBg="rgba(239,68,68,0.15)"
          innerBg="#EF4444"
          outer={128} inner={96} icon={48}
        />
        <View style={sc.textGroup}>
          <Text style={sc.title}>{t('challenge.timeout.title')}</Text>
          <Text style={sc.subtitle}>{t('challenge.timeout.message')}</Text>
        </View>
        <MiloBubble message={t('challenge.timeout.miloMessage')} tone="destructive" />
      </EntranceView>
      <View style={sc.actions}>
        <ActionButton tone="primary" icon="refresh" label={t('challenge.timeout.retry')} onPress={onRetry} />
        <ActionButton tone="neutral" icon="home-outline" label={t('challenge.timeout.goHome')} onPress={onGoHome} />
      </View>
    </View>
  );
}

// ─── WrongAnswerScreen ────────────────────────────────────────────────────────

export function WrongAnswerScreen({ operandA, operandB, correctAnswer, userAnswer, onContinue, onRetry }: {
  operandA: number; operandB: number; correctAnswer: number;
  userAnswer: number | null; onContinue: () => void; onRetry: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    playSound('wrong');
  }, []);

  return (
    <View style={[sc.root, { backgroundColor: '#FFFBEB' }]}>
      <EntranceView style={sc.body}>
        <StatusIcon
          name="close"
          outerBg="rgba(245,158,11,0.25)"
          innerBg="#F59E0B"
          outer={96} inner={80} icon={40}
        />
        <View style={sc.textGroup}>
          <Text style={sc.title}>{t('challenge.wrong.title')}</Text>
          <Text style={sc.subtitle}>{t('challenge.wrong.subtitle')}</Text>
        </View>

        {/* Equação correta */}
        <View style={wa.card}>
          <View style={wa.eqRow}>
            <Text style={wa.num}>{operandA}</Text>
            <Text style={wa.op}>×</Text>
            <Text style={wa.num}>{operandB}</Text>
            <Text style={wa.op}>=</Text>
            <Text style={wa.correct}>{correctAnswer}</Text>
            <View style={wa.check}><Ionicons name="checkmark" size={14} color="#fff" /></View>
          </View>
          {userAnswer !== null && (
            <View style={wa.userRow}>
              <Text style={wa.userLabel}>{t('challenge.yourAnswer')}</Text>
              <Text style={wa.userWrong}>{userAnswer}</Text>
            </View>
          )}
        </View>
        <MiloBubble message={t('challenge.wrong.miloMessage')} tone="primary" />
      </EntranceView>

      <View style={sc.actions}>
        <ActionButton tone="success" label={t('challenge.wrong.continueAnyway')} onPress={onContinue} />
        <ActionButton tone="neutral" icon="refresh" label={t('challenge.wrong.retry')} onPress={onRetry} />
      </View>
    </View>
  );
}

const wa = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.30)',
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  eqRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  num:     { fontFamily: fontFamily.extraBold, fontSize: 32, color: '#1A1F36', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  op:      { fontFamily: fontFamily.bold,      fontSize: 24, color: '#6B7280' },
  correct: { fontFamily: fontFamily.extraBold, fontSize: 32, color: '#22C55E', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  check:   { width: 24, height: 24, borderRadius: 12, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10,
  },
  userLabel: { fontFamily: fontFamily.semiBold, fontSize: 13, color: '#6B7280' },
  userWrong: { fontFamily: fontFamily.extraBold, fontSize: 18, color: '#EF4444', textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
});

// ─── BlockEndScreen ───────────────────────────────────────────────────────────

export function BlockEndScreen({ correct, total, onRetry, onGoHome }: {
  correct: number; total: number; onRetry: () => void; onGoHome: () => void;
}) {
  const { t } = useTranslation();
  const pct = Math.round((correct / total) * 100);

  useEffect(() => {
    playSound('wrong');
  }, []);

  return (
    <View style={[sc.root, { backgroundColor: '#FFFBEB' }]}>
      <EntranceView style={sc.body}>
        <StatusIcon
          name="radio-button-on-outline"
          outerBg="rgba(245,158,11,0.25)"
          innerBg="#F59E0B"
          outer={112} inner={88} icon={44}
        />
        <View style={sc.textGroup}>
          <Text style={sc.title}>{t('challenge.blockIncomplete.title')}</Text>
          <Text style={sc.subtitle}>{t('challenge.blockIncomplete.subtitle')}</Text>
        </View>

        {/* Score card */}
        <View style={be.card}>
          <Text style={be.num}>{correct}<Text style={be.numTotal}>/{total}</Text></Text>
          <Text style={be.numLabel}>{t('challenge.correctAnswers')}</Text>
          <View style={be.track}>
            <View style={[be.fill, { width: `${pct}%` as `${number}%` }]} />
          </View>
          <View style={be.footer}>
            <Text style={be.footerTxt}>{t('challenge.accuracy', { pct })}</Text>
            <Text style={[be.footerTxt, { color: '#F59E0B' }]}>{t('challenge.target100')}</Text>
          </View>
        </View>
        <MiloBubble message={t('challenge.blockIncomplete.miloMessage')} tone="warning" />
      </EntranceView>

      <View style={sc.actions}>
        <ActionButton tone="primary" icon="refresh" label={t('challenge.blockIncomplete.retry')} onPress={onRetry} />
        <ActionButton tone="neutral" icon="home-outline" label={t('challenge.blockIncomplete.goHome')} onPress={onGoHome} />
      </View>
    </View>
  );
}

const be = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.30)',
    padding: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  num:      { fontFamily: fontFamily.extraBold, fontSize: 48, color: '#1A1F36', lineHeight: 56, fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  numTotal: { fontFamily: fontFamily.bold,      fontSize: 24, color: '#6B7280' },
  numLabel: { fontFamily: fontFamily.bold,      fontSize: 13, color: '#6B7280', marginBottom: 4 },
  track:    { width: '100%', height: 12, backgroundColor: '#F3F4F6', borderRadius: 6, overflow: 'hidden', marginTop: 4 },
  fill:     { height: 12, backgroundColor: '#F59E0B', borderRadius: 6 },
  footer:   { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  footerTxt:{ fontFamily: fontFamily.bold, fontSize: 12, color: '#6B7280' },
});

// ─── Shared layout ────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  // flex-1 px-6 pb-8 pt-12 — full screen, não card
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,       // safe area top
    paddingBottom: 32,
  },
  // flex-1 items-center justify-center gap-6
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  textGroup: { alignItems: 'center', gap: 8 },
  // font-heading text-3xl font-extrabold text-foreground
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 28,
    lineHeight: 36,
    color: '#1A1F36',
    textAlign: 'center',
  },
  // text-base font-semibold leading-relaxed text-muted-foreground
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  actions:  { gap: 12, paddingBottom: 8 },
});
