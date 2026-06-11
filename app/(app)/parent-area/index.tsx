/**
 * Parent Area — children management.
 * PIN verification happens in settings.tsx before navigating here.
 */

import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Card, Text } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { colors, fontFamily, space } from '@/theme';

export default function ParentAreaScreen() {
  const { t } = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const parentId = useAuthStore(selectParentId);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children', parentId],
    queryFn:  () => childService.listChildren(parentId!),
    enabled:  !!parentId,
  });

  return (
    <View style={styles.root}>
      {/* ── Header (gradient, same pattern as all screens) ─────────── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSub}>Math Hero Kids</Text>
            <Text style={styles.headerTitle}>{t('parentArea.title')}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>
      </LinearGradient>

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
              <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background.primary },
  header:      { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerSub:   { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 },
  headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 24, color: '#fff' },
  iconBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  content:     { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  childRow:    { flexDirection: 'row', alignItems: 'center', gap: space.md },
  childInfo:   { flex: 1, gap: 2 },
});
