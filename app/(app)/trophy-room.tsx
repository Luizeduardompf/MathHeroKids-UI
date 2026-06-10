/**
 * Trophy Room screen.
 *
 * Data ported from design/exports/08-gamification-trophy-levels.zip gamification-data.ts.
 * Phase 3: wire to child_trophies via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { colors, fontFamily, radius, space } from '@/theme';

// ─── Types & rarity config ────────────────────────────────────────────────────

type Rarity = 'bronze' | 'prata' | 'ouro' | 'diamante';
type TrophyCategory = 'diario' | 'semanal' | 'mensal' | 'sequencia' | 'especial';

interface Trophy {
  id: string;
  name: string;
  category: TrophyCategory;
  rarity: Rarity;
  description: string;
  howToEarn: string;
  earned: boolean;
  dateEarned?: string;
  progress?: { current: number; total: number };
}

// Rarity config — matches design (Portuguese labels)
const RARITY: Record<Rarity, { label: string; bg: string; icon: string; chip: string; chipText: string }> = {
  bronze:   { label: 'Bronze',   bg: colors.accentLight,              icon: colors.accent,         chip: colors.accentLight,              chipText: colors.accent         },
  prata:    { label: 'Prata',    bg: colors.background.cardAlt,       icon: colors.text.secondary, chip: colors.background.cardAlt,       chipText: colors.text.secondary },
  ouro:     { label: 'Ouro',     bg: colors.trophy.goldLight,         icon: colors.trophy.gold,    chip: colors.trophy.goldLight,         chipText: colors.trophy.gold    },
  diamante: { label: 'Diamante', bg: colors.primaryLight,             icon: colors.primary,        chip: colors.primaryLight,             chipText: colors.primary        },
};

const CATEGORY_LABELS: Record<TrophyCategory, string> = {
  diario:    'Diários',
  semanal:   'Semanais',
  mensal:    'Mensais',
  sequencia: 'Sequência',
  especial:  'Especiais',
};

const CATEGORY_ORDER: TrophyCategory[] = ['diario', 'semanal', 'mensal', 'sequencia', 'especial'];

// Data from gamification-data.ts
const TROPHIES: Trophy[] = [
  {
    id: 'diario-1', name: 'Troféu Diário', category: 'diario', rarity: 'bronze',
    description: 'Complete o desafio do dia para ganhar este troféu.',
    howToEarn: 'Termine 1 desafio diário com o Milo.', earned: true, dateEarned: '17 de junho de 2026',
  },
  {
    id: 'diario-2', name: 'Madrugador', category: 'diario', rarity: 'bronze',
    description: 'Comece o desafio bem cedinho.',
    howToEarn: 'Complete um desafio antes das 9h.', earned: false, progress: { current: 0, total: 1 },
  },
  {
    id: 'semanal-1', name: 'Troféu Semanal', category: 'semanal', rarity: 'prata',
    description: 'Jogue todos os dias por 7 dias seguidos.',
    howToEarn: 'Mantenha sua sequência por uma semana inteira.', earned: true, dateEarned: '15 de junho de 2026',
  },
  {
    id: 'mensal-1', name: 'Troféu Mensal', category: 'mensal', rarity: 'ouro',
    description: 'Um mês inteiro de matemática sem falhar!',
    howToEarn: 'Complete os desafios todos os dias do mês.', earned: false, progress: { current: 18, total: 30 },
  },
  {
    id: 'sequencia-1', name: 'Sequência de Fogo', category: 'sequencia', rarity: 'ouro',
    description: 'Sua sequência está pegando fogo!',
    howToEarn: 'Alcance uma sequência de 10 dias.', earned: false, progress: { current: 8, total: 10 },
  },
  {
    id: 'especial-1', name: 'Semana Perfeita', category: 'especial', rarity: 'diamante',
    description: '7 dias seguidos sem errar nenhuma resposta.',
    howToEarn: 'Acerte 100% dos desafios por 7 dias.', earned: true, dateEarned: '10 de junho de 2026',
  },
  {
    id: 'especial-2', name: 'Mês Perfeito', category: 'especial', rarity: 'diamante',
    description: 'O troféu mais raro de todos: um mês impecável.',
    howToEarn: 'Acerte 100% dos desafios o mês inteiro.', earned: false, progress: { current: 12, total: 30 },
  },
];

// ─── Trophy card — 2-col, tall, icon centrado ─────────────────────────────────

function TrophyCard({ trophy, onPress }: { trophy: Trophy; onPress: () => void }) {
  const r = RARITY[trophy.rarity];
  return (
    <TouchableOpacity style={styles.trophyCard} onPress={onPress} activeOpacity={0.75}>
      {/* Icon circle */}
      <View style={[styles.trophyIconWrap, { backgroundColor: trophy.earned ? r.bg : colors.background.cardAlt }]}>
        <Ionicons
          name={trophy.earned ? 'trophy' : 'lock-closed'}
          size={36}
          color={trophy.earned ? r.icon : colors.text.tertiary}
        />
      </View>

      {/* Name */}
      <Text
        variant="label"
        align="center"
        color={trophy.earned ? colors.text.primary : colors.text.tertiary}
        numberOfLines={2}
        style={styles.trophyName}
      >
        {trophy.name}
      </Text>

      {/* Rarity chip */}
      <View style={[styles.rarityChip, { backgroundColor: r.chip }]}>
        <Text style={[styles.rarityChipText, { color: r.chipText }]}>
          {r.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrophyRoomScreen() {
  const router = useRouter();
  const child  = useProfileStore(selectActiveChild);

  const earnedCount = TROPHIES.filter((t) => t.earned).length;
  const nextTrophy  = TROPHIES.find((t) => !t.earned && t.progress);

  return (
    <AuthScreen
      title="Sala de Troféus"
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message="Olha quantos troféus você já tem! Vamos conquistar mais?" />

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={[styles.statPill, styles.statPillGold]}>
          <View style={[styles.statIconWrap, { backgroundColor: `${colors.trophy.gold}25` }]}>
            <Ionicons name="trophy" size={22} color={colors.trophy.gold} />
          </View>
          <View>
            <Text style={styles.statValue}>{earnedCount}</Text>
            <Text variant="caption" color={colors.text.secondary}>Conquistados</Text>
          </View>
        </View>
        <View style={[styles.statPill, styles.statPillOrange]}>
          <View style={[styles.statIconWrap, { backgroundColor: `${colors.accent}20` }]}>
            <Ionicons name="flame" size={22} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.statValue}>{child?.current_streak ?? 0}</Text>
            <Text variant="caption" color={colors.text.secondary}>Sequência</Text>
          </View>
        </View>
      </View>

      {/* ── Next trophy ───────────────────────────────────────────────────── */}
      {nextTrophy?.progress && (
        <Card border shadow="sm">
          <Text style={styles.nextLabel}>PRÓXIMO TROFÉU</Text>
          <View style={styles.nextRow}>
            <View style={[styles.trophyIconWrapSm, { backgroundColor: colors.background.cardAlt }]}>
              <Ionicons name="lock-closed" size={20} color={colors.text.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{nextTrophy.name}</Text>
              <ProgressBar
                value={nextTrophy.progress.current / nextTrophy.progress.total}
                color={colors.warning}
                trackColor={colors.background.primary}
                height={10}
                style={{ marginTop: space.xs }}
              />
              <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 4 }}>
                {nextTrophy.progress.current} / {nextTrophy.progress.total}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* ── Categories ────────────────────────────────────────────────────── */}
      {CATEGORY_ORDER.map((cat) => {
        const list = TROPHIES.filter((t) => t.category === cat);
        if (list.length === 0) return null;
        return (
          <View key={cat} style={styles.category}>
            <Text variant="h3">{CATEGORY_LABELS[cat]}</Text>
            <View style={styles.trophyGrid}>
              {list.map((t) => (
                <TrophyCard
                  key={t.id}
                  trophy={t}
                  onPress={() => router.push(`/(app)/trophy/${t.id}`)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Stats ───────────────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: space.sm },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius['2xl'],
    padding: space.md,
    borderWidth: 1,
  },
  statPillGold:   { backgroundColor: colors.trophy.goldLight,  borderColor: `${colors.trophy.gold}30`  },
  statPillOrange: { backgroundColor: colors.accentLight,        borderColor: `${colors.accent}25`       },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    color: colors.text.primary,
    lineHeight: 28,
  } as import('react-native').TextStyle,

  // ── Next trophy ─────────────────────────────────────────────────────────────
  nextLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    color: colors.text.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  } as import('react-native').TextStyle,
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  trophyIconWrapSm: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Categories ───────────────────────────────────────────────────────────────
  category: { gap: space.sm },
  trophyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  // ── Trophy card ──────────────────────────────────────────────────────────────
  trophyCard: {
    width: '47%',
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: space.sm,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  trophyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyName: { lineHeight: 18 },
  rarityChip: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  rarityChipText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
  } as import('react-native').TextStyle,
});
