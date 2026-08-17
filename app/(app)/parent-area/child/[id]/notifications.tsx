import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

import { Button, ScreenHeader, Text } from '@/components/ui';
import { notificationSettingsService } from '@/services/notification-settings.service';
import { useChild } from '@/hooks/use-child';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import { NOTIFICATION_HOURS, hourToTimeString, timeStringToHour } from '@/constants/config';

export default function ChildNotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { child, isLoading: isChildLoading, isError: isChildError } = useChild(id);

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['child-notification-settings', id],
    queryFn: () => notificationSettingsService.getChildSettings(id),
    enabled: !!id,
  });

  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [dailyReminderHour, setDailyReminderHour] = useState(16);
  const [unfinishedEnabled, setUnfinishedEnabled] = useState(false);
  const [unfinishedHour, setUnfinishedHour] = useState(19);

  useEffect(() => {
    if (!settings) return;
    setWhatsappEnabled(settings.whatsapp_enabled);
    setDailyReminderEnabled(settings.daily_reminder_enabled);
    setDailyReminderHour(timeStringToHour(settings.daily_reminder_time, 16));
    setUnfinishedEnabled(settings.unfinished_warning_enabled);
    setUnfinishedHour(timeStringToHour(settings.unfinished_warning_time, 19));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => notificationSettingsService.updateChildSettings(id, {
      whatsapp_enabled: whatsappEnabled,
      daily_reminder_enabled: dailyReminderEnabled,
      daily_reminder_time: hourToTimeString(dailyReminderHour),
      unfinished_warning_enabled: unfinishedEnabled,
      unfinished_warning_time: hourToTimeString(unfinishedHour),
    }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['child-notification-settings', id] }),
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
        subtitle={t('parentArea.child.whatsappNotifTitle')}
        onBack={() => router.back()}
      />

      {isSettingsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.settingCard}>
            <Pressable style={s.settingHeader} onPress={() => setWhatsappEnabled((v) => !v)}>
              <View style={s.settingIcon}>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{t('parentArea.child.whatsappNotifTitle')}</Text>
                <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.whatsappNotifHint')}</Text>
              </View>
              <View style={[s.toggle, whatsappEnabled && s.toggleOn]}>
                <View style={[s.toggleThumb, whatsappEnabled && s.toggleThumbOn]} />
              </View>
            </Pressable>

            {whatsappEnabled ? (
              <>
                <Pressable style={s.autoTimerRow} onPress={() => setDailyReminderEnabled((v) => !v)}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{t('parentArea.child.dailyReminderLabel')}</Text>
                    <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.dailyReminderHint')}</Text>
                  </View>
                  <View style={[s.toggle, dailyReminderEnabled && s.toggleOn]}>
                    <View style={[s.toggleThumb, dailyReminderEnabled && s.toggleThumbOn]} />
                  </View>
                </Pressable>
                {dailyReminderEnabled ? (
                  <View style={s.optionRow}>
                    {NOTIFICATION_HOURS.map((h) => (
                      <Pressable key={h} style={[s.optionBtn, dailyReminderHour === h && s.optionBtnActive]} onPress={() => setDailyReminderHour(h)}>
                        <RNText style={[s.optionText, dailyReminderHour === h && s.optionTextActive]}>{String(h).padStart(2, '0')}h</RNText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <Pressable style={s.autoTimerRow} onPress={() => setUnfinishedEnabled((v) => !v)}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{t('parentArea.child.unfinishedLabel')}</Text>
                    <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.unfinishedHint')}</Text>
                  </View>
                  <View style={[s.toggle, unfinishedEnabled && s.toggleOn]}>
                    <View style={[s.toggleThumb, unfinishedEnabled && s.toggleThumbOn]} />
                  </View>
                </Pressable>
                {unfinishedEnabled ? (
                  <View style={s.optionRow}>
                    {NOTIFICATION_HOURS.map((h) => (
                      <Pressable key={h} style={[s.optionBtn, unfinishedHour === h && s.optionBtnActive]} onPress={() => setUnfinishedHour(h)}>
                        <RNText style={[s.optionText, unfinishedHour === h && s.optionTextActive]}>{String(h).padStart(2, '0')}h</RNText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
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
