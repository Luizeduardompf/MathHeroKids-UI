import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Badge, Button, Card, ProgressBar, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { colors, space } from '@/theme';

const DEMO_CHILD = { display_name: 'Sofia', level: 12, xp_total: 1450, xp_next: 2000, current_streak: 8, best_streak: 21 };

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const xpProgress = DEMO_CHILD.xp_total / DEMO_CHILD.xp_next;

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar displayName={DEMO_CHILD.display_name} size="sm" ringColor={colors.text.inverse} />
            <View>
              <Text variant="label" color={colors.text.inverse}>{DEMO_CHILD.display_name}</Text>
              <Text variant="caption" color="rgba(255,255,255,0.7)">{t('common.level', { level: DEMO_CHILD.level })}</Text>
            </View>
          </View>
          <View style={styles.xpContainer}>
            <Text variant="label" color={colors.text.inverse}>{DEMO_CHILD.xp_total.toLocaleString()} XP</Text>
            <ProgressBar value={xpProgress} color={colors.text.inverse} trackColor="rgba(255,255,255,0.3)" height={6} />
            <Text variant="caption" color="rgba(255,255,255,0.7)">{DEMO_CHILD.xp_next.toLocaleString()}</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <MiloMessage message={t('milo.great_job')} />

          <Card>
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text variant="h1" color={colors.accent}>{DEMO_CHILD.current_streak}</Text>
                <Text variant="caption" color={colors.text.secondary}>{t('home.dayStreak')}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.streakItem}>
                <Text variant="h1">{DEMO_CHILD.best_streak}</Text>
                <Text variant="caption" color={colors.text.secondary}>{t('home.bestStreak')}</Text>
              </View>
            </View>
          </Card>

          <Card>
            <View style={styles.challengeHeader}>
              <Badge label={t('home.challenge.inProgress')} variant="primary" />
              <Text variant="label" color={colors.primary}>+150 XP</Text>
            </View>
            <Text variant="h2" style={{ marginTop: space.xs }}>Multiplication Mountain</Text>
            <Text variant="bodySmall" color={colors.text.secondary}>{t('home.challenge.questions', { current: 4, total: 20 })}</Text>
            <ProgressBar value={0.4} color={colors.success} style={{ marginTop: space.xs }} />
            <Button label={t('home.challenge.continue')} onPress={() => router.push('/(app)/challenge/today')} style={{ marginTop: space.md }} />
          </Card>

          <View style={styles.sectionHeader}>
            <Text variant="h3">{t('home.recentTrophies')}</Text>
            <Text variant="body" color={colors.primary} onPress={() => router.push('/(app)/trophy-room')}>{t('common.seeAll')}</Text>
          </View>

          <Text variant="h3">{t('home.statistics')}</Text>
          <View style={styles.statsGrid}>
            {[
              { label: t('home.perfectDays'), value: '18' },
              { label: t('home.perfectWeeks'), value: '3' },
              { label: t('home.perfectMonths'), value: '1' },
              { label: t('home.challengesDone'), value: '142' },
            ].map((stat) => (
              <Card key={stat.label} style={styles.statCard} padding={space.md}>
                <Text variant="h2">{stat.value}</Text>
                <Text variant="caption" color={colors.text.secondary}>{stat.label}</Text>
              </Card>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.primary },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  xpContainer: { flex: 1, marginLeft: space.lg, gap: 3 },
  scroll: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  streakItem: { alignItems: 'center', gap: space.xs },
  divider: { width: 1, height: 48, backgroundColor: colors.border.default },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statCard: { width: '47%' },
});
