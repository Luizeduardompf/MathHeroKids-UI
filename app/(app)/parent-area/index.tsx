/**
 * Parent Area — dashboard with account management + children list.
 * PIN verification happens in settings.tsx before navigating here.
 */

import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Card, Text } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { colors, fontFamily, radius, space } from '@/theme';
import type { IoniconsName } from '@/components/ui';

// ─── Account action row ───────────────────────────────────────────────────────

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  destructive = false,
}: {
  icon: IoniconsName;
  label: string;
  sublabel?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.actionRow, pressed && s.actionRowPressed]}>
      <View style={[s.actionIcon, destructive && s.actionIconDestructive]}>
        <Ionicons name={icon} size={20} color={destructive ? colors.error : colors.primary} />
      </View>
      <View style={s.actionTexts}>
        <Text variant="label" color={destructive ? colors.error : colors.text.primary}>{label}</Text>
        {sublabel ? <Text variant="caption" color={colors.text.secondary}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ParentAreaScreen() {
  const { t }    = useTranslation();
  const router   = useRouter();
  const queryClient = useQueryClient();
  const parentId = useAuthStore(selectParentId);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children', parentId],
    queryFn:  () => childService.listChildren(parentId!),
    enabled:  !!parentId,
  });

  useFocusEffect(
    useCallback(() => {
      if (parentId) void queryClient.invalidateQueries({ queryKey: ['children', parentId] });
    }, [parentId, queryClient])
  );

  return (
    <View style={s.root}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerSub}>Math Hero Kids</Text>
            <Text style={s.headerTitle}>{t('parentArea.title')}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>
        <Text style={s.headerSubtitle}>{t('parentArea.subtitle')}</Text>
        </View>
      </LinearGradient>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>

        {/* ── Account section ─────────────────────────────────────── */}
        <Text variant="h3" style={s.sectionTitle}>{t('parentArea.accountSection')}</Text>
        <Card style={s.card}>
          <ActionRow
            icon="person-outline"
            label={t('parentArea.editProfile')}
            sublabel={t('parentArea.editProfileSub')}
            onPress={() => router.push('/(app)/parent-area/edit-profile')}
          />
          <View style={s.divider} />
          <ActionRow
            icon="lock-closed-outline"
            label={t('parentArea.passwordSection')}
            sublabel={t('parentArea.passwordHint')}
            onPress={() => router.push('/(app)/parent-area/change-password')}
          />
          <View style={s.divider} />
          <ActionRow
            icon="keypad-outline"
            label={t('parentArea.pinSection')}
            sublabel={t('parentArea.pinActive')}
            onPress={() => router.push('/(app)/parent-area/pin')}
          />
        </Card>

        {/* ── Children section ────────────────────────────────────── */}
        <Text variant="h3" style={s.sectionTitle}>{t('parentArea.childrenSection')}</Text>

        {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: space.sm }} />}

        {children.map((child) => (
          <Pressable
            key={child.id}
            onPress={() => router.push(`/(app)/parent-area/child/${child.id}`)}
          >
            <Card style={s.childRow}>
              <Avatar avatarId={child.avatar_id} displayName={child.display_name} size="md" />
              <View style={s.childInfo}>
                <Text variant="label">{child.display_name}</Text>
                <Text variant="caption" color={colors.text.secondary}>
                  @{child.username} · {t('common.level', { level: child.level })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
            </Card>
          </Pressable>
        ))}

        {/* Add child */}
        <Pressable
          onPress={() => router.push('/(app)/parent-area/child/new')}
          style={({ pressed }) => [s.addChildBtn, pressed && s.addChildBtnPressed]}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text variant="label" color={colors.primary}>{t('parentArea.addChild')}</Text>
        </Pressable>

        {/* ── Developers (settings técnicos globais) ─────────────────── */}
        <Pressable
          onPress={() => router.push('/(app)/parent-area/developers')}
          style={({ pressed }) => [s.devRow, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="code-slash-outline" size={16} color={colors.text.tertiary} />
          <Text variant="caption" color={colors.text.tertiary}>{t('parentArea.developers.title')}</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background.primary },

  // Header
  header:       { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 } as import('react-native').TextStyle,
  headerTitle:  { fontFamily: fontFamily.extraBold, fontSize: 24, color: '#fff' } as import('react-native').TextStyle,
  headerSubtitle: { fontFamily: fontFamily.regular, fontSize: 13, color: 'rgba(255,255,255,0.70)', textAlign: 'center', marginTop: 4 } as import('react-native').TextStyle,
  iconBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  // Content
  content:      { padding: space.md, gap: space.sm, paddingBottom: space['2xl'] },
  sectionTitle: { marginTop: space.sm, marginBottom: 4 },

  // Account card
  card:         { padding: 0, overflow: 'hidden' },
  divider:      { height: 1, backgroundColor: colors.border.default, marginLeft: 56 },
  actionRow:    { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  actionRowPressed: { backgroundColor: colors.background.cardAlt },
  actionIcon:   { width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  actionIconDestructive: { backgroundColor: `${colors.error}18` },
  actionTexts:  { flex: 1, gap: 2 },

  // Children
  childRow:     { flexDirection: 'row', alignItems: 'center', gap: space.md },
  childInfo:    { flex: 1, gap: 2 },

  // Add child
  addChildBtn:        { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius['2xl'], borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', justifyContent: 'center', marginTop: 4 },
  addChildBtnPressed: { opacity: 0.6 },

  // Developers link
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: space.lg, padding: space.sm },
});
