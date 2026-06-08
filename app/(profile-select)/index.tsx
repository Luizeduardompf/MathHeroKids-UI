import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Avatar, Card, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import type { ChildProfile } from '@/types';
import { Icons } from '@/constants/icons';
import { colors, radius, space } from '@/theme';

export default function ProfileSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const parentId = useAuthStore(selectParentId);
  const setActiveChild = useProfileStore((s) => s.setActiveChild);

  const { data: children, isLoading, error } = useQuery({
    queryKey: ['children', parentId],
    queryFn: () => childService.listChildren(parentId!),
    enabled: !!parentId,
    staleTime: 60_000, // 1 min
  });

  function handleSelectChild(child: ChildProfile) {
    setActiveChild(child);
    router.replace('/(app)/(tabs)/');
  }

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text variant="caption" color="rgba(255,255,255,0.7)">Math Hero Kids</Text>
          <Text variant="h1" color={colors.text.inverse}>{t('profileSelect.title')}</Text>
          <Text variant="body" color="rgba(255,255,255,0.8)">{t('profileSelect.subtitle')}</Text>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text.inverse} size="large" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text variant="body" color={colors.text.inverse} align="center">
              {t('errors.generic')}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {(children ?? []).map((child) => (
              <Pressable
                key={child.id}
                onPress={() => handleSelectChild(child)}
                style={({ pressed }) => pressed ? styles.pressed : undefined}
              >
                <Card style={styles.childCard} shadow="md">
                  <Avatar
                    displayName={child.display_name}
                    avatarId={child.avatar_id}
                    size="lg"
                    ringColor={colors.primary}
                  />
                  <View style={styles.childInfo}>
                    <View style={styles.childNameRow}>
                      <Text variant="h3">{child.display_name}</Text>
                      <Text variant="body" color={colors.text.secondary}>
                        {Icons.star} {t('common.level', { level: child.level })}
                      </Text>
                    </View>
                    <Text variant="label" color={colors.primary}>
                      {Icons.xp} {child.xp_total.toLocaleString()} XP
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}

            {/* Empty state — no children yet */}
            {(children ?? []).length === 0 && (
              <Text variant="body" color="rgba(255,255,255,0.8)" align="center" style={styles.emptyText}>
                Nenhuma criança cadastrada ainda.{'\n'}Adicione a primeira abaixo!
              </Text>
            )}

            <Pressable
              style={styles.addChild}
              onPress={() => router.push('/(auth)/register/child')}
            >
              <Text variant="body" color="rgba(255,255,255,0.8)">
                ＋ {t('profileSelect.addChild')}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  safeArea: { flex: 1 },
  header: { paddingTop: space.lg, paddingHorizontal: space.md, paddingBottom: space.lg, gap: space.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.md, paddingBottom: space['2xl'], gap: space.sm },
  childCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.xl },
  childInfo: { flex: 1, gap: space.xs },
  childNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pressed: { opacity: 0.85 },
  emptyText: { marginVertical: space.xl },
  addChild: { alignItems: 'center', paddingVertical: space.md },
});
