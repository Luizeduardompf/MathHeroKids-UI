import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
// @ts-expect-error RN 0.85 strict API quirk — Modal present at runtime
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'; // eslint-disable-line
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Avatar, AvatarPicker, Badge, Button, Card, ProgressBar, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { childService } from '@/services/child.service';
import { challengeService } from '@/services/challenge.service';
import { supabase } from '@/lib/supabase';
import { CHALLENGE, getLevelXpFloor, getLevelXpCeil } from '@/constants/config';
import { colors, fontFamily, radius, space } from '@/theme';
import type { ChildProfile } from '@/types';

// ─── Stats query ──────────────────────────────────────────────────────────────

interface ChildStats {
  perfectDays:   number;
  perfectWeeks:  number;
  perfectMonths: number;
  challengesDone: number;
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  // ISO week: Mon=1, shift so Mon=0
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return monday.toISOString().split('T')[0]!;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

async function fetchStats(childId: string): Promise<ChildStats> {
  const [calResult, sessResult, localComps] = await Promise.all([
    supabase
      .from('calendar_days')
      .select('day_date, is_perfect, state')
      .eq('child_id', childId),
    supabase
      .from('challenge_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('status', 'completed'),
    challengeService.getLocalCompletions(childId),
  ]);

  // Merge calendar_days + local completions
  const perfectDates  = new Set<string>();
  const completedDates = new Set<string>();

  for (const d of ((calResult.data ?? []) as Array<{ day_date: string; is_perfect: boolean; state: string }>)) {
    if (d.is_perfect)        perfectDates.add(d.day_date);
    if (d.state === 'completed') completedDates.add(d.day_date);
  }
  for (const lc of localComps) {
    completedDates.add(lc.challengeDate);
    if (lc.isPerfect) perfectDates.add(lc.challengeDate);
  }

  const challengesDone = Math.max(sessResult.count ?? 0, completedDates.size);

  // Perfect weeks: group by ISO week-start, count weeks with 7 perfect days
  const weekMap = new Map<string, number>();
  for (const d of perfectDates) {
    const k = isoWeekKey(d);
    weekMap.set(k, (weekMap.get(k) ?? 0) + 1);
  }
  let perfectWeeks = 0;
  for (const [, cnt] of weekMap) { if (cnt >= 7) perfectWeeks++; }

  // Perfect months: group by YYYY-MM, count months with ≥28 perfect days
  const monthMap = new Map<string, number>();
  for (const d of perfectDates) {
    const k = monthKey(d);
    monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
  }
  let perfectMonths = 0;
  for (const [k, cnt] of monthMap) {
    const [y, m] = k.split('-').map(Number);
    const daysInMonth = new Date(y!, m!, 0).getDate();
    if (cnt >= daysInMonth) perfectMonths++;
  }

  return {
    perfectDays:   perfectDates.size,
    perfectWeeks,
    perfectMonths,
    challengesDone,
  };
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router   = useRouter();
  const parentId = useAuthStore(selectParentId);
  const child    = useProfileStore(selectActiveChild);
  const setActiveChild = useProfileStore((s) => s.setActiveChild);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [headerBottom, setHeaderBottom] = useState(0);

  const queryClient = useQueryClient();

  const { data: children = [] } = useQuery({
    queryKey: ['children', parentId],
    queryFn: () => childService.listChildren(parentId!),
    enabled: !!parentId,
    staleTime: 60_000,
  });

  const { data: stats } = useQuery<ChildStats>({
    queryKey: ['child_stats', child?.id],
    queryFn:  () => fetchStats(child!.id),
    enabled:  !!child?.id,
    staleTime: 60_000,
  });

  if (!child) return null;

  const xpFloor    = getLevelXpFloor(child.level);
  const xpCeil     = getLevelXpCeil(child.level);
  const xpProgress = xpCeil > xpFloor ? (child.xp_total - xpFloor) / (xpCeil - xpFloor) : 1;
  const todayDate  = new Date().toISOString().split('T')[0]!;

  function handleSelectChild(c: ChildProfile) {
    if (c.id === child!.id) return; // already active — don't re-set
    setActiveChild(c);
    setEditingAvatar(false);
    setDropdownOpen(false);
  }

  async function handleAvatarChange(avatarId: import('@/constants/config').AvatarId) {
    if (savingAvatar || avatarId === child!.avatar_id) return;
    setSavingAvatar(true);
    try {
      const updated = await childService.updateChild(child!.id, { avatar_id: avatarId });
      setActiveChild(updated);
      // Refresh children list so dropdown shows the new avatar
      void queryClient.invalidateQueries({ queryKey: ['children', parentId] });
      setEditingAvatar(false);
    } catch {
      // TODO: surface error toast in Phase 6
    } finally {
      setSavingAvatar(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView
        edges={['top']}
        style={styles.safeHeader}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View
          style={styles.header}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onLayout={(e: any) => setHeaderBottom((e.nativeEvent.layout.y as number) + (e.nativeEvent.layout.height as number))}
        >
          {/* Left: profile card button */}
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setDropdownOpen((v) => !v)}
            activeOpacity={0.85}
            accessibilityLabel={t('home.switchProfile')}
          >
            <Avatar
              avatarId={child.avatar_id}
              displayName={child.display_name}
              size="md"
              ringColor={colors.primaryLight}
            />
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>{child.display_name}</Text>
                <Ionicons
                  name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.text.secondary}
                />
              </View>
              <Text variant="caption" color={colors.text.secondary}>
                {t('common.level', { level: child.level })}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Right: XP progress with gradient fill */}
          <TouchableOpacity
            style={styles.xpBlock}
            onPress={() => router.push('/(app)/progression')}
            activeOpacity={0.8}
          >
            <View style={styles.xpRow}>
              <Text style={styles.xpValue}>{child.xp_total.toLocaleString()} XP</Text>
              <Text variant="caption" color={colors.text.tertiary}>{xpCeil.toLocaleString()}</Text>
            </View>
            {/* Gradient XP bar */}
            <View style={styles.xpTrack}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.xpFill, { width: `${Math.round(xpProgress * 100)}%` as `${number}%` }]}
              />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Profile dropdown ──────────────────────────────────────────── */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => { setDropdownOpen(false); setEditingAvatar(false); }}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => { setDropdownOpen(false); setEditingAvatar(false); }}
        />
        <View style={[styles.dropdown, { top: headerBottom + 8 }]}>
          {children.map((c) => {
            const isActive = c.id === child.id;
            return (
              <View key={c.id}>
                <TouchableOpacity
                  style={[styles.dropdownRow, isActive ? styles.dropdownRowSelected : null]}
                  onPress={() => handleSelectChild(c)}
                  activeOpacity={isActive ? 1 : 0.75}
                >
                  <Avatar
                    avatarId={c.avatar_id}
                    displayName={c.display_name}
                    size="sm"
                    ringColor={isActive ? colors.primary : undefined}
                  />
                  <View style={styles.dropdownInfo}>
                    <Text style={styles.dropdownName}>{c.display_name}</Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      {t('common.level', { level: c.level })}
                    </Text>
                  </View>

                  {isActive ? (
                    /* Edit avatar button — only visible on active child */
                    <TouchableOpacity
                      style={styles.editAvatarBtn}
                      onPress={() => setEditingAvatar((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={editingAvatar ? 'close' : 'create-outline'}
                        size={16}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.checkCircleGhost} />
                  )}
                </TouchableOpacity>

                {/* Inline avatar picker — only for active child */}
                {isActive && editingAvatar && (
                  <View style={styles.avatarPickerWrap}>
                    <AvatarPicker
                      selected={child.avatar_id as import('@/constants/config').AvatarId}
                      onSelect={handleAvatarChange}
                    />
                    {savingAvatar && (
                      <Text variant="caption" color={colors.text.secondary} style={styles.savingText}>
                        A guardar…
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Modal>

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1 — Milo */}
        <MiloMessage
          message={
            child.current_streak > 0
              ? t('milo.streak_active', { days: child.current_streak })
              : t('milo.great_job')
          }
        />

        {/* Section 2 — Streak stats */}
        <View style={styles.streakRow}>
          {/* Current streak — orange gradient pill */}
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakPillAccent}
          >
            <View style={styles.streakIconCircleLight}>
              <Ionicons name="flame" size={20} color={colors.text.inverse} />
            </View>
            <View>
              <Text variant="h2" color={colors.text.inverse}>{child.current_streak}</Text>
              <Text variant="caption" color="rgba(255,255,255,0.85)">{t('home.dayStreak')}</Text>
            </View>
          </LinearGradient>
          {/* Best streak — white pill */}
          <View style={styles.streakPillNeutral}>
            <View style={styles.streakIconCircleGold}>
              <Ionicons name="trophy" size={20} color={colors.warning} />
            </View>
            <View>
              <Text variant="h2">{child.best_streak}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('home.bestStreak')}</Text>
            </View>
          </View>
        </View>

        {/* Section 3 — Today's Challenge */}
        <LinearGradient
          colors={['#16A34A', '#14532D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.challengeCard}
        >
          {/* Decorative circles */}
          <View style={styles.challengeDecoTR} pointerEvents="none" />
          <View style={styles.challengeDecoBL} pointerEvents="none" />

          <View style={styles.challengeHeader}>
            <Badge
              label={t('home.challenge.notStarted')}
              variant="neutral"
              icon="sparkles"
              style={styles.challengeStatusBadge}
            />
            <View style={styles.xpBadge}>
              <Text variant="caption" style={styles.xpBadgeText}>
                {t('home.challenge.xpReward', {
                  xp: CHALLENGE.XP_PER_CORRECT_ANSWER * CHALLENGE.TOTAL_QUESTIONS
                    + CHALLENGE.XP_COMPLETION_BONUS + CHALLENGE.XP_PERFECT_BONUS,
                })}
              </Text>
            </View>
          </View>
          <Text variant="caption" color="rgba(255,255,255,0.70)" style={{ marginTop: space.sm }}>
            {t('home.challenge.todaysChallenge')}
          </Text>
          <Text variant="h2" color={colors.text.inverse} style={styles.challengeTitle}>
            Multiplication Mountain
          </Text>
          <Text variant="bodySmall" color="rgba(255,255,255,0.70)">
            {t('home.challenge.questions', { current: 0, total: CHALLENGE.TOTAL_QUESTIONS })}
          </Text>
          <ProgressBar
            value={0}
            color="rgba(255,255,255,0.9)"
            trackColor="rgba(255,255,255,0.25)"
            style={{ marginTop: space.xs }}
          />
          <Button
            label={t('home.challenge.start')}
            variant="secondary"
            onPress={() => router.push(`/(app)/challenge/${todayDate}`)}
            style={{ marginTop: space.md }}
          />
        </LinearGradient>

        {/* Section 4 — Recent Trophies (Phase 3 will populate) */}
        <View style={styles.sectionHeader}>
          <Text variant="h3">{t('home.recentTrophies')}</Text>
          <Text
            variant="body"
            color={colors.primary}
            onPress={() => router.push('/(app)/trophy-room')}
          >
            {t('common.seeAll')}
          </Text>
        </View>
        <View style={styles.trophyRow}>
          {(
            [
              { key: 'home.trophy.daily', icon: 'medal-outline' as const, color: colors.warning },
              { key: 'home.trophy.weekly', icon: 'lock-closed-outline' as const, color: colors.text.tertiary },
              { key: 'home.trophy.monthly', icon: 'lock-closed-outline' as const, color: colors.text.tertiary },
            ]
          ).map(({ key, icon, color }) => (
            <Card key={key} style={styles.trophyCard} padding={space.md}>
              <Ionicons name={icon} size={28} color={color} />
              <Text variant="caption" color={colors.text.secondary} align="center">
                {t(key)}
              </Text>
            </Card>
          ))}
        </View>

        {/* Section 5 — Statistics */}
        <Text variant="h3">{t('home.statistics')}</Text>
        <View style={styles.statsGrid}>
          {(
            [
              { key: 'home.perfectDays',    icon: 'calendar-outline' as const, iconBg: colors.primaryLight, iconColor: colors.primary,  value: stats?.perfectDays    },
              { key: 'home.perfectWeeks',   icon: 'calendar-outline' as const, iconBg: colors.accentLight,  iconColor: colors.accent,   value: stats?.perfectWeeks   },
              { key: 'home.perfectMonths',  icon: 'ribbon-outline'   as const, iconBg: colors.successLight, iconColor: colors.success,  value: stats?.perfectMonths  },
              { key: 'home.challengesDone', icon: 'trophy-outline'   as const, iconBg: colors.warningLight, iconColor: colors.warning,  value: stats?.challengesDone },
            ] as const
          ).map(({ key, icon, iconBg, iconColor, value }) => (
            <Card key={key} style={styles.statCard} padding={space.md}>
              <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
              </View>
              <Text variant="h2" style={styles.statValue}>
                {value !== undefined ? String(value) : '—'}
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                {t(key)}
              </Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  safeHeader: { backgroundColor: colors.background.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.background.card,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },

  // ── Profile card button ────────────────────────────────────────────────────
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  nameBlock: { gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nameText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 20,
  } as import('react-native').TextStyle,

  // ── XP bar with gradient ───────────────────────────────────────────────────
  xpBlock: { flex: 1, gap: 4 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpValue: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.primary,
  } as import('react-native').TextStyle,
  xpTrack: {
    height: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  xpFill: {
    height: 10,
    borderRadius: radius.full,
  },

  // ── Dropdown ──────────────────────────────────────────────────────────────
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dropdown: {
    position: 'absolute',
    left: space.md,
    width: 248,
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    padding: space.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    } as object),
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.xl,
    padding: space.sm,
  },
  dropdownRowSelected: { backgroundColor: colors.primaryLight },
  dropdownInfo: { flex: 1, gap: 1 },
  dropdownName: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.text.primary,
  } as import('react-native').TextStyle,
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleGhost: { width: 24, height: 24 },
  editAvatarBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickerWrap: {
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginTop: space.xs,
    paddingTop: space.sm,
  },
  savingText: { marginTop: space.xs, textAlign: 'center' },

  scroll: { flex: 1 },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },

  // ── Streak ──────────────────────────────────────────────────────────────────
  streakRow: { flexDirection: 'row', gap: space.sm },
  streakPillAccent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.full,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    ...({
      shadowColor: colors.accent,
      shadowOpacity: 0.30,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    } as object),
  },
  streakPillNeutral: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.background.card,
    borderRadius: radius.full,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  streakIconCircleLight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakIconCircleGold: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Challenge card ───────────────────────────────────────────────────────────
  challengeCard: {
    borderRadius: radius['2xl'],
    padding: space.lg,
    gap: space.xs,
    overflow: 'hidden',
    ...({
      shadowColor: '#14532D',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    } as object),
  },
  challengeDecoTR: {
    position: 'absolute',
    top: -32,
    right: -32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  challengeDecoBL: {
    position: 'absolute',
    bottom: -40,
    left: -24,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  challengeStatusBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  xpBadge: {
    backgroundColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  xpBadgeText: {
    color: '#7A2E06',
    fontWeight: '900',
    fontSize: 12,
  } as import('react-native').TextStyle,
  challengeTitle: { marginTop: 2 },

  // ── Trophies ────────────────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trophyRow: { flexDirection: 'row', gap: space.sm },
  trophyCard: { flex: 1, alignItems: 'center', gap: space.xs },

  // ── Stats ───────────────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statCard: { width: '47%' },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  statValue: { marginBottom: 2 },
});
