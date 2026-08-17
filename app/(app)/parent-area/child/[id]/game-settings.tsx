import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';

import { Button, ScreenHeader, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useChild } from '@/hooks/use-child';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import { TIMER_OPTIONS, MULTIPLICATION_RANGES, QUESTION_COUNT_OPTIONS, OPERATIONS, type TimerOption, type MultiplicationRange, type QuestionCountOption, type ModuleId } from '@/constants/config';

export default function ChildGameSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parentId = useAuthStore(selectParentId);
  const activeChild = useProfileStore(selectActiveChild);
  const setActiveChild = useProfileStore((st) => st.setActiveChild);

  const { child, isLoading, isError } = useChild(id);
  const initialized = useRef(false);

  const [timerSeconds, setTimerSeconds] = useState<TimerOption>(15);
  const [timerAuto, setTimerAuto] = useState(false);
  const [multiMax, setMultiMax] = useState<MultiplicationRange>(10);
  const [questionCount, setQuestionCount] = useState<QuestionCountOption>(20);
  const [enabledOperations, setEnabledOperations] = useState<ModuleId[]>(['multiplication']);
  const [mixOperations, setMixOperations] = useState(false);
  const [socialEnabled, setSocialEnabled] = useState(true);

  useEffect(() => {
    if (!child || initialized.current) return;
    initialized.current = true;
    if (child.timer_seconds !== undefined) setTimerSeconds(child.timer_seconds as TimerOption);
    setTimerAuto(child.timer_auto ?? false);
    if (child.multiplication_max !== undefined) setMultiMax(child.multiplication_max as MultiplicationRange);
    if (child.question_count !== undefined) setQuestionCount(child.question_count as QuestionCountOption);
    if (child.enabled_operations?.length) setEnabledOperations(child.enabled_operations);
    setMixOperations(child.mix_operations ?? false);
    setSocialEnabled(child.social_enabled ?? true);
  }, [child]);

  function toggleOperation(op: ModuleId) {
    setEnabledOperations((prev) => {
      if (prev.includes(op)) {
        if (prev.length === 1) return prev; // pelo menos uma tem de ficar activa
        return prev.filter((o) => o !== op);
      }
      return [...prev, op];
    });
  }

  const mutation = useMutation({
    mutationFn: () => childService.updateChild(child!.id, {
      timer_seconds: timerSeconds,
      timer_auto: timerAuto,
      multiplication_max: multiMax,
      question_count: questionCount,
      enabled_operations: enabledOperations,
      mix_operations: mixOperations,
      social_enabled: socialEnabled,
    }),
    onSuccess: async (updated) => {
      if (activeChild?.id === updated.id) setActiveChild(updated);
      await queryClient.invalidateQueries({ queryKey: ['children', parentId] });
    },
  });

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !child) {
    return (
      <View style={s.center}>
        <Text variant="body" color={colors.error}>{t('parentArea.child.loadError')}</Text>
        <Button label={t('common.back')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader
        title={child.display_name}
        subtitle={t('parentArea.child.gameSettings')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Question count */}
        <View style={s.settingCard}>
          <View style={s.settingHeader}>
            <View style={s.settingIcon}>
              <Ionicons name="list-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.questionsLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.questionsHint')}</Text>
            </View>
          </View>
          <View style={s.optionRow}>
            {QUESTION_COUNT_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[s.optionBtn, questionCount === opt && s.optionBtnActive]}
                onPress={() => setQuestionCount(opt)}
              >
                <RNText style={[s.optionText, questionCount === opt && s.optionTextActive]}>
                  {opt === 0 ? 'AUTO' : String(opt)}
                </RNText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Timer */}
        <View style={s.settingCard}>
          <View style={s.settingHeader}>
            <View style={s.settingIcon}>
              <Ionicons name="timer-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.timerLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.timerHint')}</Text>
            </View>
          </View>
          <View style={[s.optionRow, timerAuto && { opacity: 0.4 }]}>
            {TIMER_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                disabled={timerAuto}
                style={[s.optionBtn, timerSeconds === opt && s.optionBtnActive]}
                onPress={() => setTimerSeconds(opt)}
              >
                <RNText style={[s.optionText, timerSeconds === opt && s.optionTextActive]}>
                  {opt === 0 ? '∞' : `${opt}s`}
                </RNText>
              </Pressable>
            ))}
          </View>
          <Pressable style={s.autoTimerRow} onPress={() => setTimerAuto((v) => !v)}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.timerAutoLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.timerAutoHint')}</Text>
            </View>
            <View style={[s.toggle, timerAuto && s.toggleOn]}>
              <View style={[s.toggleThumb, timerAuto && s.toggleThumbOn]} />
            </View>
          </Pressable>
        </View>

        {/* Multiplication max */}
        <View style={s.settingCard}>
          <View style={s.settingHeader}>
            <View style={s.settingIcon}>
              <Ionicons name="calculator-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.tablesLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.tablesHint')}</Text>
            </View>
          </View>
          <View style={s.optionRow}>
            {MULTIPLICATION_RANGES.map((opt) => (
              <Pressable
                key={opt}
                style={[s.optionBtn, multiMax === opt && s.optionBtnActive]}
                onPress={() => setMultiMax(opt)}
              >
                <RNText style={[s.optionText, multiMax === opt && s.optionTextActive]}>
                  {`×${opt}`}
                </RNText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Operations */}
        <View style={s.settingCard}>
          <View style={s.settingHeader}>
            <View style={s.settingIcon}>
              <Ionicons name="apps-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.operationsLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.operationsHint')}</Text>
            </View>
          </View>
          <View style={s.optionRow}>
            {OPERATIONS.map((op) => {
              const active = enabledOperations.includes(op);
              return (
                <Pressable
                  key={op}
                  style={[s.optionBtn, active && s.optionBtnActive]}
                  onPress={() => toggleOperation(op)}
                >
                  <RNText style={[s.optionText, active && s.optionTextActive]}>
                    {t(`parentArea.child.operationNames.${op}`)}
                  </RNText>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[s.autoTimerRow, enabledOperations.length < 2 && { opacity: 0.4 }]}
            disabled={enabledOperations.length < 2}
            onPress={() => setMixOperations((v) => !v)}
          >
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.mixOperationsLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.mixOperationsHint')}</Text>
            </View>
            <View style={[s.toggle, mixOperations && s.toggleOn]}>
              <View style={[s.toggleThumb, mixOperations && s.toggleThumbOn]} />
            </View>
          </Pressable>
        </View>

        {/* Social enabled */}
        <Pressable style={s.settingCard} onPress={() => setSocialEnabled((v) => !v)}>
          <View style={s.settingHeader}>
            <View style={s.settingIcon}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.socialLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.socialHint')}</Text>
            </View>
            <View style={[s.toggle, socialEnabled && s.toggleOn]}>
              <View style={[s.toggleThumb, socialEnabled && s.toggleThumbOn]} />
            </View>
          </View>
        </Pressable>

        {mutation.isError ? <Text variant="bodySmall" color={colors.error}>{(mutation.error as Error).message}</Text> : null}
        {mutation.isSuccess ? <Text variant="bodySmall" color={colors.success}>{t('parentArea.notifications.saved')}</Text> : null}

        <Button
          label={t('parentArea.child.save')}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          style={s.saveBtn}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  saveBtn: { marginTop: space.sm },

  settingCard: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.sm,
    ...shadows.sm,
  },
  settingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  autoTimerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginTop: space.xs,
  },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.cardAlt,
  },
  optionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    fontFamily: fontFamily.semiBold, fontSize: 14,
    color: colors.text.secondary,
  },
  optionTextActive: { color: colors.primary },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: colors.border.default,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: colors.primary },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
