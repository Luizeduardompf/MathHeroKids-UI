import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Alert present at runtime
import { Alert } from 'react-native'; // eslint-disable-line
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';

import { Avatar, Button, Card, Input, ScreenHeader, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useChild } from '@/hooks/use-child';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { colors, radius, space } from '@/theme';
import type { IoniconsName } from '@/components/ui';

const LANG_TO_LOCALE: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

function formatDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return '—';
  const locale = LANG_TO_LOCALE[language] ?? 'en-US';
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string | null | undefined, language: string): string {
  if (!iso) return '—';
  const locale = LANG_TO_LOCALE[language] ?? 'en-US';
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ─── Menu row ───────────────────────────────────────────────────────────────

function ActionRow({
  icon, iconBg, iconColor, label, sublabel, onPress,
}: {
  icon: IoniconsName;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sublabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.actionRow, pressed && s.actionRowPressed]}>
      <View style={[s.actionIcon, iconBg ? { backgroundColor: iconBg } : null]}>
        <Ionicons name={icon} size={20} color={iconColor ?? colors.primary} />
      </View>
      <View style={s.actionTexts}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" color={colors.text.secondary}>{sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChildHubScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parentId = useAuthStore(selectParentId);
  const activeChild = useProfileStore(selectActiveChild);
  const clearActiveChild = useProfileStore((st) => st.clearActiveChild);

  const { child, isLoading, isError } = useChild(id);

  // Delete flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => childService.deleteChild(child!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['children', parentId] });
      if (activeChild?.id === child!.id) clearActiveChild();
      router.back();
    },
    onError: (e) => setDeleteError((e as Error).message),
  });

  function handleDeletePress() {
    if (!child) return;
    Alert.alert(
      t('parentArea.child.deleteBtn'),
      t('parentArea.child.deleteWarning', { name: child.display_name }),
      [
        { text: t('parentArea.child.deleteCancelBtn'), style: 'cancel' },
        {
          text: t('parentArea.child.deleteBtn'),
          style: 'destructive',
          onPress: () => { setDeleteConfirmText(''); setDeleteError(null); setShowDeleteConfirm(true); },
        },
      ],
    );
  }

  function handleDeleteConfirm() {
    if (!child) return;
    if (deleteConfirmText.trim().toLowerCase() !== child.username.toLowerCase()) {
      setDeleteError(t('parentArea.child.deleteMismatch'));
      return;
    }
    setDeleteError(null);
    deleteMutation.mutate();
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !child) {
    return (
      <View style={s.center}>
        <Text variant="body" color={colors.error}>{t('parentArea.child.loadError')}</Text>
        <Button label={t('common.back')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader title={child.display_name} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.content}>
        {/* ── Summary ─────────────────────────────────────────────── */}
        <Card style={s.summaryCard}>
          <Avatar avatarId={child.avatar_id} displayName={child.display_name} size="lg" />
          <View style={{ flex: 1 }}>
            <Text variant="h3">{child.display_name}</Text>
            <Text variant="caption" color={colors.text.secondary}>
              @{child.username} · {t('common.level', { level: child.level })}
            </Text>
            <View style={s.statsRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.text.tertiary} />
              <Text variant="caption" color={colors.text.tertiary}>
                {t('parentArea.child.registeredSince')}: {formatDate(child.created_at, i18n.language)}
              </Text>
            </View>
            <View style={s.statsRow}>
              <Ionicons name="time-outline" size={12} color={colors.text.tertiary} />
              <Text variant="caption" color={colors.text.tertiary}>
                {t('parentArea.child.lastAccess')}: {formatDateTime(child.last_seen_at, i18n.language)}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Menu ────────────────────────────────────────────────── */}
        <Text variant="h3" style={s.sectionTitle}>{t('parentArea.child.settingsSection')}</Text>
        <Card style={s.menuCard}>
          <ActionRow
            icon="person-outline"
            label={t('parentArea.child.menuProfileLabel')}
            sublabel={t('parentArea.child.menuProfileSub')}
            onPress={() => router.push(`/(app)/parent-area/child/${id}/profile`)}
          />
          <View style={s.divider} />
          <ActionRow
            icon="game-controller-outline"
            label={t('parentArea.child.gameSettings')}
            sublabel={t('parentArea.child.menuGameSub')}
            onPress={() => router.push(`/(app)/parent-area/child/${id}/game-settings`)}
          />
          <View style={s.divider} />
          <ActionRow
            icon="logo-whatsapp"
            iconBg="#DCFCE7"
            iconColor="#25D366"
            label={t('parentArea.child.whatsappNotifTitle')}
            sublabel={t('parentArea.child.menuNotificationsSub')}
            onPress={() => router.push(`/(app)/parent-area/child/${id}/notifications`)}
          />
          <View style={s.divider} />
          <ActionRow
            icon="medal-outline"
            iconBg="#FEF3C7"
            iconColor="#B8860B"
            label={t('parentArea.child.tabuadaEnabledLabel')}
            sublabel={t('parentArea.child.menuTabuadaSub')}
            onPress={() => router.push(`/(app)/parent-area/child/${id}/tabuada`)}
          />
          <View style={s.divider} />
          <ActionRow
            icon="stats-chart-outline"
            label={t('parentArea.child.performanceTitle')}
            sublabel={t('parentArea.child.menuPerformanceSub')}
            onPress={() => router.push(`/(app)/parent-area/child/${id}/performance`)}
          />
        </Card>

        {/* ── Danger zone ─────────────────────────────────────────── */}
        <View style={s.dangerZone}>
          <Text variant="label" color={colors.error}>{t('parentArea.child.dangerZoneTitle')}</Text>
          <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.dangerZoneHint')}</Text>

          {!showDeleteConfirm ? (
            <Button
              label={t('parentArea.child.deleteBtn')}
              onPress={handleDeletePress}
              variant="destructive"
              style={s.deleteBtn}
            />
          ) : (
            <View style={s.deleteConfirmBox}>
              <Text variant="bodySmall" color={colors.error}>
                {t('parentArea.child.deleteWarning', { name: child.display_name })}
              </Text>
              <Input
                label={t('parentArea.child.deleteConfirmLabel', { username: child.username })}
                placeholder={t('parentArea.child.deleteConfirmPlaceholder')}
                value={deleteConfirmText}
                onChangeText={(v: string) => { setDeleteConfirmText(v); setDeleteError(null); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {deleteError ? (
                <Text variant="bodySmall" color={colors.error}>{deleteError}</Text>
              ) : null}
              <View style={s.deleteConfirmActions}>
                <Button
                  label={t('parentArea.child.deleteCancelBtn')}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={deleteMutation.isPending}
                  style={s.deleteConfirmActionBtn}
                />
                <Button
                  label={t('parentArea.child.deleteConfirmBtn')}
                  variant="destructive"
                  fullWidth={false}
                  onPress={handleDeleteConfirm}
                  loading={deleteMutation.isPending}
                  style={s.deleteConfirmActionBtn}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  content: { padding: space.md, gap: space.sm, paddingBottom: space['2xl'] },
  sectionTitle: { marginTop: space.sm, marginBottom: 4 },

  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },

  menuCard: { padding: 0, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border.default, marginLeft: 56 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  actionRowPressed: { backgroundColor: colors.background.cardAlt },
  actionIcon: { width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  actionTexts: { flex: 1, gap: 2 },

  dangerZone: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: `${colors.error}40`,
    backgroundColor: `${colors.error}0D`,
    gap: 6,
  },
  deleteBtn: { marginTop: space.sm },
  deleteConfirmBox: { marginTop: space.sm, gap: space.sm },
  deleteConfirmActions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  deleteConfirmActionBtn: { flex: 1 },
});
