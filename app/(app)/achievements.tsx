/**
 * Achievements screen.
 *
 * TODO Phase 3: wire to child_achievements via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { colors, fontFamily, radius, space } from '@/theme';

// ─── Mock achievement data (Phase 3: replace with child_achievements query) ───

type AchievementIcon =
  | 'star-outline'
  | 'flame-outline'
  | 'flash-outline'
  | 'ribbon-outline'
  | 'calendar-outline'
  | 'medal-outline'
  | 'sparkles-outline'
  | 'trophy-outline';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: AchievementIcon;
  category: string;
  earned: boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  // Primeiros passos
  { id: 'a1', name: 'Primeiro Dia Perfeito', description: 'Acertou todas as respostas em um dia.',    icon: 'star-outline',     category: 'Primeiros passos', earned: true  },
  { id: 'a2', name: 'Primeiro Acesso',        description: 'Bem-vindo ao app!',                       icon: 'sparkles-outline', category: 'Primeiros passos', earned: true  },
  // Sequências
  { id: 'a3', name: '7 Dias Seguidos',        description: 'Fez desafios 7 dias sem parar.',           icon: 'flame-outline',    category: 'Sequências',       earned: true  },
  { id: 'a4', name: '30 Dias Seguidos',       description: 'Um mês inteiro de desafios!',              icon: 'flame-outline',    category: 'Sequências',       earned: false },
  // Desempenho
  { id: 'a5', name: 'Nota 100',               description: 'Acertou todas as 20 questões.',            icon: 'flash-outline',    category: 'Desempenho',       earned: false },
  { id: 'a6', name: 'Velocista',              description: 'Completou um desafio em menos de 3 min.', icon: 'flash-outline',    category: 'Desempenho',       earned: false },
  // Colecção
  { id: 'a7', name: '5 Troféus',             description: 'Conquistou 5 troféus.',                    icon: 'trophy-outline',   category: 'Coleção',          earned: false },
  { id: 'a8', name: 'Nível 10',              description: 'Chegou ao nível 10!',                      icon: 'ribbon-outline',   category: 'Coleção',          earned: false },
];

// ─── Achievement card ─────────────────────────────────────────────────────────

function AchievementCard({ a }: { a: Achievement }) {
  return (
    <View style={[styles.achCard, a.earned ? styles.achCardEarned : styles.achCardLocked]}>
      <View style={[
        styles.achIcon,
        a.earned ? styles.achIconEarned : styles.achIconLocked,
      ]}>
        <Ionicons
          name={a.earned ? a.icon : 'lock-closed-outline'}
          size={28}
          color={a.earned ? colors.primary : colors.text.tertiary}
        />
      </View>
      <Text
        variant="label"
        align="center"
        color={a.earned ? colors.text.primary : colors.text.tertiary}
        style={styles.achName}
        numberOfLines={2}
      >
        {a.name}
      </Text>
      <Text
        variant="caption"
        align="center"
        color={colors.text.tertiary}
        style={styles.achDesc}
        numberOfLines={3}
      >
        {a.description}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AchievementsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const earned = ACHIEVEMENTS.filter((a) => a.earned).length;
  const total  = ACHIEVEMENTS.length;
  const pct    = Math.round((earned / total) * 100);

  const categories = Array.from(new Set(ACHIEVEMENTS.map((a) => a.category)));

  return (
    <AuthScreen
      title={t('achievements.title')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message={t('milo.achievements')} />

      {/* ── Overall progress ──────────────────────────────────────────────── */}
      <Card border shadow="sm">
        <View style={styles.progressHeader}>
          <Text variant="h3">{t('achievements.collection')}</Text>
          <Text style={styles.pctText}>{pct}%</Text>
        </View>
        <ProgressBar
          value={earned / total}
          color={colors.primary}
          trackColor={colors.background.primary}
          height={12}
          style={styles.progressBar}
        />
        <Text variant="body" color={colors.text.secondary} style={styles.progressHint}>
          {earned} de {total} conquistas desbloqueadas
        </Text>
      </Card>

      {/* ── Category sections ─────────────────────────────────────────────── */}
      {categories.map((cat) => (
        <View key={cat} style={styles.category}>
          <Text variant="h3">{cat}</Text>
          <View style={styles.achGrid}>
            {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => (
              <AchievementCard key={a.id} a={a} />
            ))}
          </View>
        </View>
      ))}
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Progress card ────────────────────────────────────────────────────────────
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  pctText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    color: colors.primary,
  } as import('react-native').TextStyle,
  progressBar: { marginBottom: space.sm },
  progressHint: { marginTop: 2 },

  // ── Achievement grid ─────────────────────────────────────────────────────────
  category: { gap: space.sm },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  achCard: {
    width: '47%',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    padding: space.md,
    alignItems: 'center',
    gap: space.xs,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  achCardEarned: {
    backgroundColor: colors.background.card,
    borderColor: colors.border.default,
  },
  achCardLocked: {
    backgroundColor: `${colors.background.cardAlt}CC`,
    borderColor: colors.border.default,
  },
  achIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  achIconEarned: { backgroundColor: colors.primaryLight },
  achIconLocked: { backgroundColor: colors.background.primary },
  achName: { lineHeight: 18 },
  achDesc: { lineHeight: 16, fontSize: 11 },
});
