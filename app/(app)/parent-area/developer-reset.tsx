/**
 * Developer > Resetar progresso — apaga XP, desafios, troféus, mastery e Tabuada Semanal
 * de uma criança à escolha, de qualquer conta (não só a do parent autenticado — ferramenta
 * "para nós", ver list_all_children/reset_child_progress). Identidade e settings da
 * criança ficam intactos. Só acessível através do hub Developers (PIN 120380).
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Avatar, Card, ConfirmDialog, Text } from '@/components/ui';
import { adminService, type AdminChildSummary } from '@/services/admin.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import { colors, fontFamily, space } from '@/theme';

export default function DeveloperResetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const parentId = useAuthStore(selectParentId);

  const { data: parents = [], isLoading, isError } = useQuery({
    queryKey: ['admin-all-children'],
    queryFn: () => adminService.listAllChildren(),
  });

  const [target, setTarget] = useState<AdminChildSummary | null>(null);
  const [justReset, setJustReset] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: (childId: string) => adminService.resetChildProgress(childId),
    onSuccess: (_data, childId) => {
      setTarget(null);
      setJustReset(childId);

      // Se a criança resetada é a activeChild deste dispositivo, o snapshot persistido em
      // profileStore fica desactualizado (home screen lê xp/level dali, não de uma query) —
      // sincroniza já os mesmos campos que a EF zera, sem esperar por um novo login.
      const { activeChild, setActiveChild } = useProfileStore.getState();
      if (activeChild?.id === childId) {
        setActiveChild({
          ...activeChild,
          xp_total: 0,
          level: 1,
          current_streak: 0,
          best_streak: 0,
          last_challenge_date: null,
        });
      }

      void queryClient.invalidateQueries({ queryKey: ['admin-all-children'] });
      if (parentId) void queryClient.invalidateQueries({ queryKey: ['children', parentId] });
    },
  });

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.header}>
            <View style={s.headerRow}>
              <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              <View style={s.headerCenter}>
                <Text style={s.headerSub}>Math Hero Kids</Text>
                <Text style={s.headerTitle}>{t('parentArea.developers.resetLinkLabel')}</Text>
              </View>
              <View style={{ width: 42 }} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        <Text variant="caption" color={colors.text.secondary}>
          {t('parentArea.developers.resetHint')}
        </Text>

        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: space.lg }} /> : null}

        {isError ? (
          <Text color={colors.error} style={{ marginTop: space.md }}>
            {t('parentArea.developers.resetLoadError')}
          </Text>
        ) : null}

        {!isLoading && !isError && parents.length === 0 ? (
          <Text color={colors.text.secondary} style={{ marginTop: space.md }}>
            {t('parentArea.developers.resetEmpty')}
          </Text>
        ) : null}

        {parents.map((group) => (
          <View key={group.parent_id} style={{ gap: space.xs }}>
            <Text variant="label" color={colors.text.secondary} style={s.parentName}>
              {group.parent_name || group.parent_id}
            </Text>
            {group.children.map((child) => (
              <Pressable
                key={child.id}
                onPress={() => setTarget(child)}
                disabled={resetMutation.isPending}
              >
                <Card style={s.childRow}>
                  <Avatar avatarId={child.avatar_id} displayName={child.display_name} size="md" />
                  <View style={s.childInfo}>
                    <Text variant="label">{child.display_name}</Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      @{child.username} · {t('common.level', { level: child.level })} · {child.xp_total} XP
                    </Text>
                  </View>
                  {justReset === child.id ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={colors.error} />
                  )}
                </Card>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <ConfirmDialog
        visible={!!target}
        title={t('parentArea.developers.resetConfirmTitle')}
        message={target ? t('parentArea.developers.resetConfirmMessage', { name: target.display_name }) : undefined}
        primaryLabel={t('common.cancel')}
        onPrimary={() => setTarget(null)}
        confirmLabel={t('parentArea.developers.resetConfirmBtn')}
        confirmVariant="destructive"
        onConfirm={() => target && resetMutation.mutate(target.id)}
        layout="row"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background.primary },
  header:       { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 } as import('react-native').TextStyle,
  headerTitle:  { fontFamily: fontFamily.extraBold, fontSize: 20, color: '#fff' } as import('react-native').TextStyle,
  iconBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  content:      { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  parentName:   { marginTop: space.sm, textTransform: 'uppercase' },

  childRow:     { flexDirection: 'row', alignItems: 'center', gap: space.md },
  childInfo:    { flex: 1, gap: 2 },
});
