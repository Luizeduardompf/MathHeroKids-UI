/**
 * Trophy Room screen.
 *
 * Real data: child.current_streak from profileStore.
 * Trophies: TODO Phase 3 — wire to child_trophies via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { colors, fontFamily, radius, space } from '@/theme';

// ─── Mock trophy data (Phase 3: replace with child_trophies query) ────────────

type TrophyRarity = 'bronze' | 'silver' | 'gold' | 'diamond';
type TrophyCategory = 'diario' | 'semanal' | 'mensal' | 'sequencia' | 'especial';

interface Trophy {
  id: string;
  name: string;
  rarity: TrophyRarity;
  category: TrophyCategory;
  earned: boolean;
  progress?: { current: number; total: number };
}

const TROPHIES: Trophy[] = [
  { id: 't1',  name: 'Troféu Diário',    rarity: 'bronze',  category: 'diario',    earned: true  },
  { id: 't2',  name: 'Madrugador',       rarity: 'silver',  category: 'diario',    earned: false },
  { id: 't3',  name: 'Dedicado',         rarity: 'gold',    category: 'diario',    earned: false, progress: { current: 18, total: 30 } },
  { id: 't4',  name: 'Semana Perfeita',  rarity: 'silver',  category: 'semanal',   earned: false, progress: { current: 3, total: 7 }  },
  { id: 't5',  name: 'Imparável',        rarity: 'gold',    category: 'semanal',   earned: false },
  { id: 't6',  name: 'Mês Épico',        rarity: 'diamond', category: 'mensal',    earned: false },
  { id: 't7',  name: '7 Dias Seguidos',  rarity: 'bronze',  category: 'sequencia', earned: true  },
  { id: 't8',  name: '30 Dias Seguidos', rarity: 'gold',    category: 'sequencia', earned: false },
  { id: 't9',  name: 'Herói da Tabuada', rarity: 'diamond', category: 'especial',  earned: false },
];

const CATEGORY_LABELS: Record<TrophyCategory, string> = {
  diario:    'Diários',
  semanal:   'Semanais',
  mensal:    'Mensais',
  sequencia: 'Sequência',
  especial:  'Especiais',
};

const CATEGORY_ORDER: TrophyCategory[] = ['diario', 'semanal', 'mensal', 'sequencia', 'especial'];

const RARITY_COLORS: Record<TrophyRarity, { bg: string; icon: string; border: string }> = {
  bronze:  { bg: colors.trophy.bronzeLight,  icon: colors.trophy.bronze,  border: `${colors.trophy.bronze}40`  },
  silver:  { bg: colors.trophy.silverLight,  icon: colors.trophy.silver,  border: `${colors.trophy.silver}50`  },
  gold:    { bg: colors.trophy.goldLight,    icon: colors.trophy.gold,    border: `${colors.trophy.gold}50`    },
  diamond: { bg: colors.trophy.diamondLight, icon: colors.trophy.diamond, border: `${colors.trophy.diamond}50` },
};

// ─── Trophy card ──────────────────────────────────────────────────────────────

function TrophyCard({ trophy }: { trophy: Trophy }) {
  const r = RARITY_COLORS[trophy.rarity];
  return (
    <TouchableOpacity style={styles.trophyCard} activeOpacity={0.75}>
      <View style={[
        styles.trophyIconCircle,
        { backgroundColor: trophy.earned ? r.bg : colors.background.cardAlt },
      ]}>
        <Ionicons
          name={trophy.earned ? 'trophy' : 'lock-closed'}
          size={26}
          color={trophy.earned ? r.icon : colors.text.tertiary}
        />
      </View>
      <Text
        variant="caption"
        align="center"
        color={trophy.earned ? colors.text.primary : colors.text.tertiary}
        style={styles.trophyName}
        numberOfLines={2}
      >
        {trophy.name}
      </Text>
      <View style={[
        styles.trophyRarityChip,
        { backgroundColor: trophy.earned ? r.bg : colors.background.cardAlt,
          borderColor: trophy.earned ? r.border : colors.border.default },
      ]}>
        <Text style={[
          styles.trophyRarityText,
          { color: trophy.earned ? r.icon : colors.text.tertiary },
        ]}>
          {trophy.rarity}
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
        <View style={styles.statPillGold}>
          <View style={styles.statIcon}>
            <Ionicons name="trophy" size={22} color={colors.trophy.gold} />
          </View>
          <View>
            <Text style={styles.statValue}>{earnedCount}</Text>
            <Text variant="caption" color={colors.text.secondary}>Conquistados</Text>
          </View>
        </View>
        <View style={styles.statPillOrange}>
          <View style={styles.statIconOrange}>
            <Ionicons name="flame" size={22} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.statValue}>{child?.current_streak ?? 0}</Text>
            <Text variant="caption" color={colors.text.secondary}>Sequência</Text>
          </View>
        </View>
      </View>

      {/* ── Next trophy progress ───────────────────────────────────────────── */}
      {nextTrophy?.progress && (
        <Card border shadow="sm">
          <Text style={styles.nextLabel}>PRÓXIMO TROFÉU</Text>
          <View style={styles.nextRow}>
            <View style={[styles.trophyIconCircle, { backgroundColor: colors.background.cardAlt }]}>
              <Ionicons name="lock-closed" size={22} color={colors.text.tertiary} />
            </View>
            <View style={styles.nextInfo}>
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

      {/* ── Trophy categories ─────────────────────────────────────────────── */}
      {CATEGORY_ORDER.map((cat) => {
        const list = TROPHIES.filter((t) => t.category === cat);
        if (list.length === 0) return null;
        return (
          <View key={cat} style={styles.category}>
            <Text variant="h3">{CATEGORY_LABELS[cat]}</Text>
            <View style={styles.trophyGrid}>
              {list.map((t) => <TrophyCard key={t.id} trophy={t} />)}
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
  statPillGold: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.trophy.goldLight,
    borderRadius: radius['2xl'],
    padding: space.md,
    borderWidth: 1,
    borderColor: `${colors.trophy.gold}30`,
  },
  statPillOrange: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.accentLight,
    borderRadius: radius['2xl'],
    padding: space.md,
    borderWidth: 1,
    borderColor: `${colors.accent}25`,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.trophy.gold}25`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconOrange: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.accent}20`,
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
  nextInfo: { flex: 1 },

  // ── Category grid ────────────────────────────────────────────────────────────
  category: { gap: space.sm },
  trophyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  trophyCard: {
    width: '30%',
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    padding: space.sm,
    gap: space.xs,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  trophyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyName: { fontSize: 11, lineHeight: 15 },
  trophyRarityChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  trophyRarityText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 10,
    textTransform: 'capitalize',
  } as import('react-native').TextStyle,
});
