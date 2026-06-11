/**
 * Challenge tab — entry point.
 *
 * Flow:
 * 1. Check if today's challenge is done.
 * 2. Not done → go directly to today's challenge screen.
 * 3. Done → show "today is done" screen with option to do retroactive
 *    challenges (up to 7 days back, counts XP only — no streak/perfect week).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { challengeService } from '@/services/challenge.service';
import { colors, fontFamily, radius, shadows, space } from '@/theme';

// Returns YYYY-MM-DD for today and the previous N days
function getPastDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]!);
  }
  return dates;
}

const LANG_TO_LOCALE: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

function formatDate(dateStr: string, language = 'en'): string {
  const d = new Date(dateStr + 'T12:00:00');
  const locale = LANG_TO_LOCALE[language] ?? 'en-US';
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Retroactive day card ──────────────────────────────────────────────────────

function DayCard({
  date,
  isToday,
  isCompleted,
  onPress,
}: {
  date: string;
  isToday: boolean;
  isCompleted: boolean;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Pressable
      style={[s.dayCard, isCompleted ? s.dayCardDone : null]}
      onPress={onPress}
      disabled={isCompleted}
    >
      <View style={s.dayCardLeft}>
        {isCompleted ? (
          <View style={[s.dayIcon, s.dayIconDone]}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </View>
        ) : (
          <View style={[s.dayIcon, isToday ? s.dayIconToday : s.dayIconPast]}>
            <Ionicons name={isToday ? 'flash' : 'time-outline'} size={18} color={isToday ? '#fff' : colors.primary} />
          </View>
        )}
        <View>
          <Text style={isCompleted ? [s.dayLabel, s.dayLabelDone] : s.dayLabel}>
            {isToday ? t('challenge.retroactive.today') : formatDate(date, i18n.language)}
          </Text>
          {!isCompleted && !isToday && (
            <Text style={s.dayXpHint}>{t('challenge.retroactive.xpOnly')}</Text>
          )}
          {isCompleted && (
            <Text style={s.dayCompletedLabel}>{t('challenge.retroactive.alreadyDone')}</Text>
          )}
        </View>
      </View>
      {!isCompleted && (
        <View style={[s.startBtn, isToday ? s.startBtnToday : s.startBtnPast]}>
          <Text style={!isToday ? [s.startBtnText, s.startBtnTextPast] : s.startBtnText}>
            {isToday ? t('challenge.retroactive.startToday') : t('challenge.retroactive.startPast')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={isToday ? '#fff' : colors.primary} />
        </View>
      )}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChallengeTab() {
  const { t }  = useTranslation();
  const router = useRouter();
  const child  = useProfileStore(selectActiveChild);

  const [checking,    setChecking]    = useState(true);
  const [todayDone,   setTodayDone]   = useState(false);
  const [completions, setCompletions] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0]!;
  // 7 past days (not including today — today is shown separately at top)
  const pastDates = getPastDates(8).slice(1); // indices 1–7 = yesterday to 7 days ago

  const checkDates = useCallback(async () => {
    if (!child) return;
    setChecking(true);

    const todayComplete = await challengeService.isDateCompleted(child.id, today);

    if (!todayComplete) {
      // Not done today → go straight to challenge
      setChecking(false);
      router.replace(`/(app)/challenge/${today}`);
      return;
    }

    setTodayDone(true);

    // Check which past days are completed
    const results = await Promise.all(
      pastDates.map(async (d) => ({
        date: d,
        done: await challengeService.isDateCompleted(child.id, d),
      })),
    );
    const doneSet = new Set(results.filter((r) => r.done).map((r) => r.date));
    setCompletions(doneSet);
    setChecking(false);
  }, [child, today]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(useCallback(() => { void checkDates(); }, [checkDates]));

  useEffect(() => {
    if (!child) return;
    void checkDates();
  }, [child, checkDates]);

  if (checking) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!todayDone) return null; // Will redirect

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={s.header}>
            <Text variant="caption" style={s.appName}>Math Hero Kids</Text>
            <Text variant="h1" color={colors.text.inverse}>{t('challenge.retroactive.title')}</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <MiloMessage message={t('challenge.retroactive.miloMessage')} />

        {/* Today — already done badge */}
        <View style={s.todayBanner}>
          <Ionicons name="trophy" size={22} color="#F59E0B" />
          <Text style={s.todayBannerText}>{t('challenge.retroactive.todayCompleted')}</Text>
        </View>

        {/* Info about retroactive */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} style={{ flexShrink: 0 }} />
          <Text style={s.infoText}>{t('challenge.retroactive.infoText')}</Text>
        </View>

        {/* Past days */}
        <Text style={s.sectionTitle}>{t('challenge.retroactive.pastDays')}</Text>

        {pastDates.map((d) => (
          <DayCard
            key={d}
            date={d}
            isToday={false}
            isCompleted={completions.has(d)}
            onPress={() => router.push(`/(app)/challenge/${d}?retroactive=1`)}
          />
        ))}

        <Text style={s.disclaimer}>{t('challenge.retroactive.disclaimer')}</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.background.primary },
  loading:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background.primary },

  header:   { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.lg, gap: space.xs },
  appName:  { color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 } as import('react-native').TextStyle,

  content: { paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['2xl'], gap: space.md },

  todayBanner: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: '#FEF3C7', borderRadius: radius.xl, padding: space.md,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  todayBannerText: { fontFamily: fontFamily.bold, fontSize: 14, color: '#92400E', flex: 1 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    backgroundColor: colors.primaryLight, borderRadius: radius.xl, padding: space.md,
  },
  infoText: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.primary, flex: 1, lineHeight: 19 },

  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 16, color: colors.text.primary, marginTop: space.sm },

  dayCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: radius.xl, padding: space.md, ...shadows.sm,
  },
  dayCardDone: { backgroundColor: '#F9FAFB', opacity: 0.75 },
  dayCardLeft: { flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 },

  dayIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayIconToday: { backgroundColor: colors.primary },
  dayIconPast:  { backgroundColor: colors.primaryLight },
  dayIconDone:  { backgroundColor: '#22C55E' },

  dayLabel:     { fontFamily: fontFamily.bold, fontSize: 14, color: colors.text.primary },
  dayLabelDone: { color: colors.text.secondary },
  dayXpHint:    { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  dayCompletedLabel: { fontFamily: fontFamily.semiBold, fontSize: 12, color: '#22C55E', marginTop: 1 },

  startBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  startBtnToday:{ backgroundColor: colors.primary },
  startBtnPast: { backgroundColor: colors.primaryLight },
  startBtnText: { fontFamily: fontFamily.bold, fontSize: 13, color: '#fff' },
  startBtnTextPast: { color: colors.primary },

  disclaimer: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.tertiary, textAlign: 'center', lineHeight: 17 },
});
