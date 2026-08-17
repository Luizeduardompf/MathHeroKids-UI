import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Button, ScreenHeader, Text } from '@/components/ui';
import { retestService, type RetestFactEntry } from '@/services/retest.service';
import { appConfigService } from '@/services/app-config.service';
import { useChild } from '@/hooks/use-child';
import { colors, radius, space } from '@/theme';
import { OPERATION_SYMBOLS } from '@/constants/config';

function PerformanceRow({ entry, threshold, learned }: { entry: RetestFactEntry; threshold: number; learned?: boolean }) {
  const { t } = useTranslation();
  const symbol = OPERATION_SYMBOLS[entry.operation] ?? '×';
  return (
    <View style={s.performanceRow}>
      <Text variant="bodySmall">
        {entry.operandA} {symbol} {entry.operandB} = {entry.answer}
      </Text>
      {learned ? (
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
      ) : (
        <Text variant="caption" color={colors.text.secondary}>
          {t('parentArea.child.performanceStreak', { streak: entry.retestCorrectStreak, threshold })}
        </Text>
      )}
    </View>
  );
}

export default function ChildPerformanceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { child, isLoading: isChildLoading, isError: isChildError } = useChild(id);

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ['child-retest-performance', id],
    queryFn: () => retestService.fetchChildRetestPerformance(id),
    enabled: !!id,
  });

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => appConfigService.getAppConfig(),
  });

  const threshold = appConfig?.retest_correct_threshold ?? 5;
  const retesting = (entries ?? []).filter((e) => e.aRetestar);
  const learned = (entries ?? []).filter((e) => !e.aRetestar && e.clearedAt != null);

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
        subtitle={t('parentArea.child.performanceTitle')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={s.content}>
        <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: space.sm }}>
          {t('parentArea.child.performanceHint')}
        </Text>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {isError ? (
          <Text variant="bodySmall" color={colors.error}>{t('parentArea.child.performanceLoadError')}</Text>
        ) : null}

        {!isLoading && !isError ? (
          <>
            <View style={s.performanceSection}>
              <Text variant="caption" color={colors.text.tertiary} style={s.performanceGroupLabel}>
                {t('parentArea.child.performanceRetestingTitle')} ({retesting.length})
              </Text>
              {retesting.length === 0 ? (
                <Text variant="bodySmall" color={colors.text.secondary}>
                  {t('parentArea.child.performanceRetestingEmpty')}
                </Text>
              ) : (
                <View style={s.performanceList}>
                  {retesting.map((e) => (
                    <PerformanceRow key={e.factId} entry={e} threshold={threshold} />
                  ))}
                </View>
              )}
            </View>

            <View style={s.performanceSection}>
              <Text variant="caption" color={colors.text.tertiary} style={s.performanceGroupLabel}>
                {t('parentArea.child.performanceLearnedTitle')} ({learned.length})
              </Text>
              {learned.length === 0 ? (
                <Text variant="bodySmall" color={colors.text.secondary}>
                  {t('parentArea.child.performanceLearnedEmpty')}
                </Text>
              ) : (
                <View style={s.performanceList}>
                  {learned.map((e) => (
                    <PerformanceRow key={e.factId} entry={e} threshold={threshold} learned />
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },

  performanceSection: {
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.card,
    gap: 4,
  },
  performanceGroupLabel: { marginBottom: 4, textTransform: 'uppercase' },
  performanceList: { gap: 6 },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background.cardAlt,
  },
});
