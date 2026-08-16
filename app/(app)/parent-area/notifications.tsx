/**
 * Definições > Notificações — configuração de notificações WhatsApp para o pai.
 * 4 tipos: lembrete diário, aviso de desafio não feito, aviso de desafio concluído,
 * resumo semanal. Cada um com toggle + hora (o cron corre 1x/hora, ver
 * backend/functions/send-whatsapp-notifications — só a hora importa, não os minutos).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, Text } from '@/components/ui';
import { notificationSettingsService } from '@/services/notification-settings.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import { NOTIFICATION_HOURS, hourToTimeString, timeStringToHour } from '@/constants/config';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function HourPicker({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <View style={s.optionRow}>
      {NOTIFICATION_HOURS.map((h) => (
        <Pressable key={h} style={[s.optionBtn, value === h && s.optionBtnActive]} onPress={() => onChange(h)}>
          <RNText style={[s.optionText, value === h && s.optionTextActive]}>{String(h).padStart(2, '0')}h</RNText>
        </Pressable>
      ))}
    </View>
  );
}

function ToggleRow({
  icon, label, hint, enabled, onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={[s.settingCard, s.settingHeader]} onPress={onToggle}>
      <View style={s.settingIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" color={colors.text.secondary}>{hint}</Text>
      </View>
      <View style={[s.toggle, enabled && s.toggleOn]}>
        <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

function ToggleTimeRow({
  icon, label, hint, enabled, onToggle, hour, onHourChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  enabled: boolean;
  onToggle: () => void;
  hour: number;
  onHourChange: (h: number) => void;
}) {
  return (
    <View style={s.settingCard}>
      <Pressable style={s.settingHeader} onPress={onToggle}>
        <View style={s.settingIcon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label">{label}</Text>
          <Text variant="caption" color={colors.text.secondary}>{hint}</Text>
        </View>
        <View style={[s.toggle, enabled && s.toggleOn]}>
          <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
        </View>
      </Pressable>
      {enabled ? <HourPicker value={hour} onChange={onHourChange} /> : null}
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const parentId = useAuthStore(selectParentId);

  const { data: prefs, isLoading, isError } = useQuery({
    queryKey: ['notification-preferences', parentId],
    queryFn: () => notificationSettingsService.getParentPreferences(parentId!),
    enabled: !!parentId,
  });

  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [reminderHour, setReminderHour] = useState(16);
  const [unfinishedEnabled, setUnfinishedEnabled] = useState(true);
  const [unfinishedHour, setUnfinishedHour] = useState(19);
  const [completedEnabled, setCompletedEnabled] = useState(false);
  const [completedHour, setCompletedHour] = useState(20);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyHour, setWeeklyHour] = useState(19);
  const [weeklyWeekday, setWeeklyWeekday] = useState(0);
  const [tabuadaMedalNoticeEnabled, setTabuadaMedalNoticeEnabled] = useState(true);

  useEffect(() => {
    if (!prefs) return;
    setWhatsappEnabled(prefs.whatsapp_enabled);
    setDailyReminder(prefs.daily_reminder);
    setReminderHour(timeStringToHour(prefs.reminder_time, 16));
    setUnfinishedEnabled(prefs.unfinished_warning_enabled);
    setUnfinishedHour(timeStringToHour(prefs.unfinished_warning_time, 19));
    setCompletedEnabled(prefs.completed_notice_enabled);
    setCompletedHour(timeStringToHour(prefs.completed_notice_time, 20));
    setWeeklyEnabled(prefs.weekly_summary_enabled);
    setWeeklyHour(timeStringToHour(prefs.weekly_summary_time, 19));
    setWeeklyWeekday(prefs.weekly_summary_weekday);
    setTabuadaMedalNoticeEnabled(prefs.tabuada_medal_notice_enabled);
  }, [prefs]);

  const mutation = useMutation({
    mutationFn: () => notificationSettingsService.updateParentPreferences(parentId!, {
      whatsapp_enabled: whatsappEnabled,
      daily_reminder: dailyReminder,
      reminder_time: hourToTimeString(reminderHour),
      unfinished_warning_enabled: unfinishedEnabled,
      unfinished_warning_time: hourToTimeString(unfinishedHour),
      completed_notice_enabled: completedEnabled,
      completed_notice_time: hourToTimeString(completedHour),
      weekly_summary_enabled: weeklyEnabled,
      weekly_summary_time: hourToTimeString(weeklyHour),
      weekly_summary_weekday: weeklyWeekday,
      tabuada_medal_notice_enabled: tabuadaMedalNoticeEnabled,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences', parentId] });
    },
  });

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.header}>
            <View style={s.headerRow}>
              <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              <View style={s.headerCenter}>
                <Text style={s.headerSub}>Math Hero Kids</Text>
                <Text style={s.headerTitle}>{t('parentArea.notifications.title')}</Text>
              </View>
              <View style={{ width: 42 }} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} /> : null}
      {isError ? (
        <View style={s.center}>
          <Text color={colors.error}>{t('parentArea.notifications.loadError')}</Text>
        </View>
      ) : null}

      {!isLoading && !isError ? (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: space.sm }}>
            {t('parentArea.notifications.subtitle')}
          </Text>

          <Pressable style={s.masterCard} onPress={() => setWhatsappEnabled((v) => !v)}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.notifications.whatsappToggle')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.notifications.whatsappToggleHint')}</Text>
            </View>
            <View style={[s.toggle, whatsappEnabled && s.toggleOn]}>
              <View style={[s.toggleThumb, whatsappEnabled && s.toggleThumbOn]} />
            </View>
          </Pressable>

          <View style={[{ gap: space.sm }, !whatsappEnabled && { opacity: 0.4 }]} pointerEvents={whatsappEnabled ? 'auto' : 'none'}>
            <ToggleTimeRow
              icon="alarm-outline"
              label={t('parentArea.notifications.dailyReminderLabel')}
              hint={t('parentArea.notifications.dailyReminderHint')}
              enabled={dailyReminder}
              onToggle={() => setDailyReminder((v) => !v)}
              hour={reminderHour}
              onHourChange={setReminderHour}
            />
            <ToggleTimeRow
              icon="warning-outline"
              label={t('parentArea.notifications.unfinishedLabel')}
              hint={t('parentArea.notifications.unfinishedHint')}
              enabled={unfinishedEnabled}
              onToggle={() => setUnfinishedEnabled((v) => !v)}
              hour={unfinishedHour}
              onHourChange={setUnfinishedHour}
            />
            <ToggleTimeRow
              icon="checkmark-circle-outline"
              label={t('parentArea.notifications.completedLabel')}
              hint={t('parentArea.notifications.completedHint')}
              enabled={completedEnabled}
              onToggle={() => setCompletedEnabled((v) => !v)}
              hour={completedHour}
              onHourChange={setCompletedHour}
            />

            <View style={s.settingCard}>
              <Pressable style={s.settingHeader} onPress={() => setWeeklyEnabled((v) => !v)}>
                <View style={s.settingIcon}>
                  <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{t('parentArea.notifications.weeklyLabel')}</Text>
                  <Text variant="caption" color={colors.text.secondary}>{t('parentArea.notifications.weeklyHint')}</Text>
                </View>
                <View style={[s.toggle, weeklyEnabled && s.toggleOn]}>
                  <View style={[s.toggleThumb, weeklyEnabled && s.toggleThumbOn]} />
                </View>
              </Pressable>
              {weeklyEnabled ? (
                <>
                  <View style={s.optionRow}>
                    {WEEKDAY_KEYS.map((wd, idx) => (
                      <Pressable
                        key={wd}
                        style={[s.optionBtn, weeklyWeekday === idx && s.optionBtnActive]}
                        onPress={() => setWeeklyWeekday(idx)}
                      >
                        <RNText style={[s.optionText, weeklyWeekday === idx && s.optionTextActive]}>
                          {t(`parentArea.notifications.weekdayShort.${wd}`)}
                        </RNText>
                      </Pressable>
                    ))}
                  </View>
                  <HourPicker value={weeklyHour} onChange={setWeeklyHour} />
                </>
              ) : null}
            </View>

            <ToggleRow
              icon="medal-outline"
              label={t('parentArea.notifications.tabuadaMedalLabel')}
              hint={t('parentArea.notifications.tabuadaMedalHint')}
              enabled={tabuadaMedalNoticeEnabled}
              onToggle={() => setTabuadaMedalNoticeEnabled((v) => !v)}
            />
          </View>

          {mutation.isError ? (
            <Text variant="bodySmall" color={colors.error}>{(mutation.error as Error).message}</Text>
          ) : null}
          {mutation.isSuccess ? (
            <Text variant="bodySmall" color={colors.success}>{t('parentArea.notifications.saved')}</Text>
          ) : null}

          <Button
            label={t('parentArea.notifications.saveBtn')}
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            fullWidth
            style={{ marginTop: space.sm }}
          />

          <Text variant="caption" color={colors.text.tertiary} style={{ textAlign: 'center', marginTop: space.sm }}>
            {t('parentArea.notifications.numberHint')}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background.primary },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  header:       { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 } as import('react-native').TextStyle,
  headerTitle:  { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' } as import('react-native').TextStyle,
  iconBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },

  masterCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: '#fff', borderRadius: radius.xl, padding: space.md,
    ...shadows.sm,
  },

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

  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border.default, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: colors.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
