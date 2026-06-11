/**
 * Trophy Room screen.
 *
 * Data ported from design/exports/08-gamification-trophy-levels.zip gamification-data.ts.
 * Phase 3: wire to child_trophies via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { colors, fontFamily, radius, space } from '@/theme';

// ─── Types & rarity config ────────────────────────────────────────────────────

type Rarity = 'bronze' | 'silver' | 'gold' | 'diamond';
type TrophyCategory = 'diario' | 'semanal' | 'mensal' | 'sequencia' | 'especial';

interface Trophy {
  id: string;
  /** i18n key — e.g. 'trophies.items.diario1.name'. Phase 3: comes from DB name_key column. */
  nameKey: string;
  descKey: string;
  howToEarnKey: string;
  category: TrophyCategory;
  rarity: Rarity;
  earned: boolean;
  /** ISO date string — formatted locale-aware at render time. */
  dateEarned?: string;
  progress?: { current: number; total: number };
}

// Rarity config — no label (resolved via t('trophies.tiers.X') at render time)
const RARITY: Record<Rarity, { bg: string; icon: string; chip: string; chipText: string }> = {
  bronze:  { bg: colors.accentLight,         icon: colors.accent,         chip: colors.accentLight,         chipText: colors.accent         },
  silver:  { bg: colors.background.cardAlt,  icon: colors.text.secondary, chip: colors.background.cardAlt,  chipText: colors.text.secondary },
  gold:    { bg: colors.trophy.goldLight,     icon: colors.trophy.gold,    chip: colors.trophy.goldLight,     chipText: colors.trophy.gold    },
  diamond: { bg: colors.primaryLight,         icon: colors.primary,        chip: colors.primaryLight,         chipText: colors.primary        },
};

const CATEGORY_ORDER: TrophyCategory[] = ['diario', 'semanal', 'mensal', 'sequencia', 'especial'];

/**
 * Static trophy catalog — Phase 3: replace with DB query (trophies table).
 * nameKey / descKey / howToEarnKey map to i18n keys (same convention as DB name_key column).
 * dateEarned is an ISO string; formatted locale-aware at render time.
 */
const TROPHIES: Trophy[] = [
  {
    id: 'diario-1',
    nameKey: 'trophies.items.diario1.name', descKey: 'trophies.items.diario1.desc', howToEarnKey: 'trophies.items.diario1.howTo',
    category: 'diario', rarity: 'bronze', earned: true, dateEarned: '2026-06-17',
  },
  {
    id: 'diario-2',
    nameKey: 'trophies.items.diario2.name', descKey: 'trophies.items.diario2.desc', howToEarnKey: 'trophies.items.diario2.howTo',
    category: 'diario', rarity: 'bronze', earned: false, progress: { current: 0, total: 1 },
  },
  {
    id: 'semanal-1',
    nameKey: 'trophies.items.semanal1.name', descKey: 'trophies.items.semanal1.desc', howToEarnKey: 'trophies.items.semanal1.howTo',
    category: 'semanal', rarity: 'silver', earned: true, dateEarned: '2026-06-15',
  },
  {
    id: 'mensal-1',
    nameKey: 'trophies.items.mensal1.name', descKey: 'trophies.items.mensal1.desc', howToEarnKey: 'trophies.items.mensal1.howTo',
    category: 'mensal', rarity: 'gold', earned: false, progress: { current: 18, total: 30 },
  },
  {
    id: 'sequencia-1',
    nameKey: 'trophies.items.sequencia1.name', descKey: 'trophies.items.sequencia1.desc', howToEarnKey: 'trophies.items.sequencia1.howTo',
    category: 'sequencia', rarity: 'gold', earned: false, progress: { current: 8, total: 10 },
  },
  {
    id: 'especial-1',
    nameKey: 'trophies.items.especial1.name', descKey: 'trophies.items.especial1.desc', howToEarnKey: 'trophies.items.especial1.howTo',
    category: 'especial', rarity: 'diamond', earned: true, dateEarned: '2026-06-10',
  },
  {
    id: 'especial-2',
    nameKey: 'trophies.items.especial2.name', descKey: 'trophies.items.especial2.desc', howToEarnKey: 'trophies.items.especial2.howTo',
    category: 'especial', rarity: 'diamond', earned: false, progress: { current: 12, total: 30 },
  },
];

// ─── Trophy card — 2-col, tall, icon centrado ─────────────────────────────────

function TrophyCard({ trophy, onPress }: { trophy: Trophy; onPress: () => void }) {
  const { t, i18n } = useTranslation();
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
        {t(trophy.nameKey)}
      </Text>

      {/* Rarity chip */}
      <View style={[styles.rarityChip, { backgroundColor: r.chip }]}>
        <Text style={[styles.rarityChipText, { color: r.chipText }]}>
          {t(`trophies.tiers.${trophy.rarity}`)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrophyRoomScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child  = useProfileStore(selectActiveChild);

  const earnedCount = TROPHIES.filter((t) => t.earned).length;
  const nextTrophy  = TROPHIES.find((t) => !t.earned && t.progress);

  return (
    <AuthScreen
      title={t('trophies.title')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message={t('trophies.miloMessage')} />

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={[styles.statPill, styles.statPillGold]}>
          <View style={[styles.statIconWrap, { backgroundColor: `${colors.trophy.gold}25` }]}>
            <Ionicons name="trophy" size={22} color={colors.trophy.gold} />
          </View>
          <View>
            <Text style={styles.statValue}>{earnedCount}</Text>
            <Text variant="caption" color={colors.text.secondary}>{t('trophies.earned')}</Text>
          </View>
        </View>
        <View style={[styles.statPill, styles.statPillOrange]}>
          <View style={[styles.statIconWrap, { backgroundColor: `${colors.accent}20` }]}>
            <Ionicons name="flame" size={22} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.statValue}>{child?.current_streak ?? 0}</Text>
            <Text variant="caption" color={colors.text.secondary}>{t('trophies.streak')}</Text>
          </View>
        </View>
      </View>

      {/* ── Next trophy ───────────────────────────────────────────────────── */}
      {nextTrophy?.progress && (
        <Card border shadow="sm">
          <Text style={styles.nextLabel}>{t('trophies.nextTrophy')}</Text>
          <View style={styles.nextRow}>
            <View style={[styles.trophyIconWrapSm, { backgroundColor: colors.background.cardAlt }]}>
              <Ionicons name="lock-closed" size={20} color={colors.text.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t(nextTrophy.nameKey)}</Text>
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
            <Text variant="h3">{t(`trophies.sections.${cat === 'diario' ? 'daily' : cat === 'semanal' ? 'weekly' : cat === 'mensal' ? 'monthly' : cat === 'sequencia' ? 'streak' : 'special'}`)}</Text>
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
