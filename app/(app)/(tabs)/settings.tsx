import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { SUPPORTED_LOCALES, TIMER_OPTIONS, MULTIPLICATION_RANGES } from '@/constants/config';
import type { SupportedLocale, TimerOption, MultiplicationRange } from '@/constants/config';
import { changeLocale } from '@/lib/i18n';
import { colors, space, radius } from '@/theme';

const LOCALE_LABEL: Record<SupportedLocale, string> = {
  pt: '🇧🇷  PT',
  en: '🇺🇸  EN',
  es: '🇪🇸  ES',
  fr: '🇫🇷  FR',
};

const LOCALE_STORAGE_KEY = 'math-hero-locale-v1';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const child = useProfileStore(selectActiveChild);
  const setActiveChild = useProfileStore((s) => s.setActiveChild);

  const [savingTimer, setSavingTimer] = useState(false);
  const [savingMult, setSavingMult] = useState(false);

  const currentLocale = i18n.language as SupportedLocale;

  async function handleLocale(locale: SupportedLocale) {
    changeLocale(locale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }

  async function handleTimer(value: TimerOption) {
    if (!child || value === child.timer_seconds || savingTimer) return;
    setSavingTimer(true);
    try {
      const updated = await childService.updateChild(child.id, { timer_seconds: value });
      setActiveChild(updated);
    } finally {
      setSavingTimer(false);
    }
  }

  async function handleMultiplication(value: MultiplicationRange) {
    if (!child || value === child.multiplication_max || savingMult) return;
    setSavingMult(true);
    try {
      const updated = await childService.updateChild(child.id, { multiplication_max: value });
      setActiveChild(updated);
    } finally {
      setSavingMult(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <Text variant="caption" color={colors.text.inverse} style={styles.appName}>
            Math Hero Kids
          </Text>
          <Text variant="h1" color={colors.text.inverse}>
            {t('settings.title')}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Language ─────────────────────────────────────────── */}
        <Card style={styles.section}>
          <View style={styles.sectionTitle}>
            <Text style={styles.sectionIcon}>🌐</Text>
            <Text variant="h3">{t('settings.language')}</Text>
          </View>
          <View style={styles.optionGrid}>
            {SUPPORTED_LOCALES.map((locale) => {
              const selected = currentLocale === locale;
              return (
                <TouchableOpacity
                  key={locale}
                  style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                  onPress={() => handleLocale(locale)}
                  activeOpacity={0.7}
                >
                  <Text
                    variant="label"
                    color={selected ? colors.primary : colors.text.primary}
                    style={styles.optionLabel}
                  >
                    {LOCALE_LABEL[locale]}
                  </Text>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* ── Timer ────────────────────────────────────────────── */}
        {child && (
          <Card style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitle}>
                <Text style={styles.sectionIcon}>⏱️</Text>
                <Text variant="h3">{t('settings.timerTitle')}</Text>
              </View>
              {savingTimer && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <Text variant="bodySmall" color={colors.text.secondary}>
              {t('settings.timerDescription')}
            </Text>
            <View style={styles.optionRow}>
              {TIMER_OPTIONS.map((val) => {
                const selected = child.timer_seconds === val;
                const label = val === 0 ? t('settings.timerUnlimited') : `${val}s`;
                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.chipBtn, selected && styles.chipBtnSelected]}
                    onPress={() => handleTimer(val)}
                    activeOpacity={0.7}
                  >
                    <Text
                      variant="label"
                      color={selected ? colors.text.inverse : colors.text.primary}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* ── Multiplication range ──────────────────────────────── */}
        {child && (
          <Card style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitle}>
                <Text style={styles.sectionIcon}>✖️</Text>
                <Text variant="h3">{t('settings.multiplicationTitle')}</Text>
              </View>
              {savingMult && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <Text variant="bodySmall" color={colors.text.secondary}>
              {t('settings.multiplicationLabel')}
            </Text>
            <View style={styles.optionRow}>
              {MULTIPLICATION_RANGES.map((val) => {
                const selected = child.multiplication_max === val;
                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.chipBtn, selected && styles.chipBtnSelected]}
                    onPress={() => handleMultiplication(val)}
                    activeOpacity={0.7}
                  >
                    <Text
                      variant="label"
                      color={selected ? colors.text.inverse : colors.text.primary}
                    >
                      {val}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  safeHeader: { backgroundColor: colors.primary },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.xs,
  },
  appName: { opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  section: { gap: space.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionIcon: { fontSize: 20 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '47%',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.cardAlt,
    gap: space.sm,
  },
  optionBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.background.card,
  },
  optionLabel: { flex: 1 },
  checkmark: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chipBtn: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.cardAlt,
  },
  chipBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
});
