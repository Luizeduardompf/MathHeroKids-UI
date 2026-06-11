/**
 * Parent Area — children management.
 * PIN verification happens in settings.tsx before navigating here.
 */

import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { colors, space } from '@/theme';

export default function ParentAreaScreen() {
  const { t } = useTranslation();
  const router   = useRouter();
  const parentId = useAuthStore(selectParentId);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children', parentId],
    queryFn:  () => childService.listChildren(parentId!),
    enabled:  !!parentId,
  });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <RNText style={styles.backArrow}>‹</RNText>
          </Pressable>
          <Text variant="h2" color={colors.text.inverse}>
            {t('settings.parentArea')}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="h3">{t('profileSelect.title')}</Text>

        {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: space.lg }} />}

        {children.map((child) => (
          <Pressable
            key={child.id}
            onPress={() => router.push(`/(app)/parent-area/child/${child.id}`)}
          >
            <Card style={styles.childRow}>
              <Avatar avatarId={child.avatar_id} displayName={child.display_name} size="md" />
              <View style={styles.childInfo}>
                <Text variant="label">{child.display_name}</Text>
                <Text variant="caption" color={colors.text.secondary}>
                  @{child.username} · {t('common.level', { level: child.level })}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.background.primary },
  safeHeader: { backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  backBtn:  { padding: 4 },
  backArrow:{ fontSize: 28, color: colors.text.inverse, lineHeight: 32 },
  content:  { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  childInfo:{ flex: 1, gap: 2 },
  chevron:  { fontSize: 22, color: colors.text.tertiary },
});
