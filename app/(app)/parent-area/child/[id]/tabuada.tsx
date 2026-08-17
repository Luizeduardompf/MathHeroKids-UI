import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

import { Button, Input, ScreenHeader, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { notificationSettingsService } from '@/services/notification-settings.service';
import { useChild } from '@/hooks/use-child';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import { NOTIFICATION_HOURS } from '@/constants/config';

// ─── Tabuada Semanal Premiada — secção consolidada ─────────────────────────────
// Todas as definições do módulo num só sítio: habilitado, seguir regras gerais, mesada,
// lembretes e resumo de domingo. Grava em duas tabelas (child_profiles +
// child_notification_settings) num único "Guardar".

export default function ChildTabuadaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parentId = useAuthStore(selectParentId);
  const activeChild = useProfileStore(selectActiveChild);
  const setActiveChild = useProfileStore((st) => st.setActiveChild);

  const { child, isLoading: isChildLoading, isError: isChildError } = useChild(id);

  const { data: notifSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['child-notification-settings', id],
    queryFn: () => notificationSettingsService.getChildSettings(id),
    enabled: !!id,
  });

  const [enabled, setEnabled] = useState(false);
  const [useGeneralSettings, setUseGeneralSettings] = useState(false);
  const [weeklyReward, setWeeklyReward] = useState('0');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHours, setReminderHours] = useState<number[]>([]);
  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(true);

  useEffect(() => {
    if (!child) return;
    setEnabled(child.tabuada_enabled);
    setUseGeneralSettings(child.tabuada_use_general_settings);
    setWeeklyReward(String(Number(child.tabuada_weekly_reward ?? 0)));
  }, [child]);

  useEffect(() => {
    if (!notifSettings) return;
    setReminderEnabled(notifSettings.tabuada_reminder_enabled);
    setReminderHours(notifSettings.tabuada_reminder_hours ?? []);
    setWeeklySummaryEnabled(notifSettings.tabuada_weekly_summary_enabled);
  }, [notifSettings]);

  function toggleHour(h: number) {
    setReminderHours((prev) => {
      if (prev.includes(h)) return prev.filter((x) => x !== h);
      if (prev.length >= 4) return prev; // máx. 4 lembretes/dia (limite da coluna na BD)
      return [...prev, h].sort((a, b) => a - b);
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const [updatedChild] = await Promise.all([
        childService.updateChild(id, {
          tabuada_enabled: enabled,
          tabuada_use_general_settings: useGeneralSettings,
          tabuada_weekly_reward: Math.max(0, parseFloat(weeklyReward.replace(',', '.')) || 0),
        }),
        notificationSettingsService.updateChildSettings(id, {
          tabuada_reminder_enabled: reminderEnabled,
          tabuada_reminder_hours: reminderHours,
          tabuada_weekly_summary_enabled: weeklySummaryEnabled,
        }),
      ]);
      return updatedChild;
    },
    onSuccess: async (updatedChild) => {
      if (activeChild?.id === updatedChild.id) setActiveChild(updatedChild);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['children', parentId] }),
        queryClient.invalidateQueries({ queryKey: ['child-notification-settings', id] }),
      ]);
    },
  });

  if (isChildLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isChildError || !child) {
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
        subtitle={t('parentArea.child.tabuadaEnabledLabel')}
        onBack={() => router.back()}
      />

      {isSettingsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.settingCard}>
            <Pressable style={s.settingHeader} onPress={() => setEnabled((v) => !v)}>
              <View style={[s.settingIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="medal-outline" size={18} color="#B8860B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{t('parentArea.child.tabuadaEnabledLabel')}</Text>
                <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.tabuadaEnabledHint')}</Text>
              </View>
              <View style={[s.toggle, enabled && s.toggleOn]}>
                <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
              </View>
            </Pressable>

            {enabled ? (
              <>
                <Pressable style={s.autoTimerRow} onPress={() => setUseGeneralSettings((v) => !v)}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{t('parentArea.child.tabuadaUseGeneralLabel')}</Text>
                    <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.tabuadaUseGeneralHint')}</Text>
                  </View>
                  <View style={[s.toggle, useGeneralSettings && s.toggleOn]}>
                    <View style={[s.toggleThumb, useGeneralSettings && s.toggleThumbOn]} />
                  </View>
                </Pressable>

                <View style={s.dividerBlock}>
                  <Input
                    label={t('parentArea.child.tabuadaRewardLabel')}
                    hint={t('parentArea.child.tabuadaRewardHint')}
                    value={weeklyReward}
                    onChangeText={setWeeklyReward}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    leftIcon={<RNText style={{ fontSize: 16, color: colors.text.secondary }}>€</RNText>}
                  />
                </View>

                <Pressable style={s.autoTimerRow} onPress={() => setReminderEnabled((v) => !v)}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{t('parentArea.child.tabuadaReminderLabel')}</Text>
                    <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.tabuadaReminderHint')}</Text>
                  </View>
                  <View style={[s.toggle, reminderEnabled && s.toggleOn]}>
                    <View style={[s.toggleThumb, reminderEnabled && s.toggleThumbOn]} />
                  </View>
                </Pressable>
                {reminderEnabled ? (
                  <>
                    <Text variant="caption" color={colors.text.tertiary}>
                      {t('parentArea.child.tabuadaReminderPickHint', { count: reminderHours.length })}
                    </Text>
                    <View style={s.optionRow}>
                      {NOTIFICATION_HOURS.map((h) => {
                        const selected = reminderHours.includes(h);
                        return (
                          <Pressable key={h} style={[s.optionBtn, selected && s.optionBtnActive]} onPress={() => toggleHour(h)}>
                            <RNText style={[s.optionText, selected && s.optionTextActive]}>{String(h).padStart(2, '0')}h</RNText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Pressable style={s.autoTimerRow} onPress={() => setWeeklySummaryEnabled((v) => !v)}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{t('parentArea.child.tabuadaWeeklySummaryLabel')}</Text>
                    <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.tabuadaWeeklySummaryHint')}</Text>
                  </View>
                  <View style={[s.toggle, weeklySummaryEnabled && s.toggleOn]}>
                    <View style={[s.toggleThumb, weeklySummaryEnabled && s.toggleThumbOn]} />
                  </View>
                </Pressable>

                <Text variant="caption" color={colors.text.tertiary}>
                  {t('parentArea.child.tabuadaNotifRequiresWhatsapp')}
                </Text>
              </>
            ) : null}
          </View>

          {mutation.isError ? <Text variant="bodySmall" color={colors.error}>{(mutation.error as Error).message}</Text> : null}
          {mutation.isSuccess ? <Text variant="bodySmall" color={colors.success}>{t('parentArea.notifications.saved')}</Text> : null}

          <Button
            label={t('parentArea.notifications.saveBtn')}
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            fullWidth
            style={s.saveBtn}
          />
        </ScrollView>
      )}
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
  dividerBlock: {
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
  optionBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionText: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.text.secondary },
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
