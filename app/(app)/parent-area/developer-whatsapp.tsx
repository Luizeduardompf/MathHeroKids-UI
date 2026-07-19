/**
 * Developer > Integração WhatsApp — configuração/teste da Evolution API.
 * Só acessível através do hub Developers (PIN 120380) — ver docs/WHATSAPP_INTEGRATION_ROADMAP.md.
 *
 * Mostra o estado da instância ('mathhero-main'), QR code para emparelhar quando
 * desconectada, botão de reset (apaga e recria a instância) e um envio de teste manual.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, Text, Input, Button } from '@/components/ui';
import { evolutionService } from '@/services/evolution.service';
import { colors, fontFamily, radius, space } from '@/theme';

function qrUri(base64: string): string {
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

export default function DeveloperWhatsAppScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: status, isLoading, isFetching } = useQuery({
    queryKey: ['evolution-status'],
    queryFn: () => evolutionService.getStatus(),
    refetchInterval: (query) => (query.state.data?.state === 'open' ? false : 5000),
  });

  const resetMutation = useMutation({
    mutationFn: () => evolutionService.resetInstance(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['evolution-status'] }),
  });

  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState(t('parentArea.developers.whatsappTestDefaultMessage'));
  const testMutation = useMutation({
    mutationFn: () => evolutionService.sendTestMessage(testNumber.replace(/\D/g, ''), testMessage),
  });

  const notConfigured = status?.error === 'EVOLUTION_NOT_CONFIGURED';

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
                <Text style={s.headerTitle}>{t('parentArea.developers.whatsappLinkLabel')}</Text>
              </View>
              <View style={{ width: 42 }} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} /> : null}

        {!isLoading && notConfigured ? (
          <Card border shadow="sm">
            <View style={s.statusRow}>
              <Ionicons name="cloud-offline-outline" size={22} color={colors.error} />
              <Text variant="label" color={colors.error}>{t('parentArea.developers.whatsappNotConfigured')}</Text>
            </View>
            <Text variant="caption" color={colors.text.secondary}>{t('parentArea.developers.whatsappNotConfiguredHint')}</Text>
          </Card>
        ) : null}

        {!isLoading && !notConfigured && status ? (
          <Card border shadow="sm">
            <View style={s.statusRow}>
              <Ionicons
                name={status.state === 'open' ? 'checkmark-circle' : 'time-outline'}
                size={22}
                color={status.state === 'open' ? colors.success : colors.text.secondary}
              />
              <Text variant="label">
                {status.state === 'open' ? t('parentArea.developers.whatsappStatusConnected') : t('parentArea.developers.whatsappStatusConnecting')}
              </Text>
              {isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>

            {status.state !== 'open' && status.qr ? (
              <View style={s.qrWrap}>
                <Image source={{ uri: qrUri(status.qr.base64) }} style={s.qrImage} resizeMode="contain" />
                <Text variant="caption" color={colors.text.secondary} style={{ textAlign: 'center' }}>
                  {t('parentArea.developers.whatsappScanHint')}
                </Text>
              </View>
            ) : null}

            <View style={s.actionsRow}>
              <Button
                label={t('parentArea.developers.whatsappRefreshBtn')}
                variant="secondary"
                onPress={() => queryClient.invalidateQueries({ queryKey: ['evolution-status'] })}
                style={{ flex: 1 }}
              />
              <Button
                label={t('parentArea.developers.whatsappResetBtn')}
                variant="destructive"
                onPress={() => resetMutation.mutate()}
                loading={resetMutation.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        {!isLoading && !notConfigured ? (
          <Card border shadow="sm" style={{ marginTop: space.md, gap: space.md }}>
            <Text variant="label">{t('parentArea.developers.whatsappTestSectionTitle')}</Text>
            <Input
              label={t('parentArea.developers.whatsappTestNumberLabel')}
              placeholder="351912345678"
              hint={t('parentArea.developers.whatsappTestNumberHint')}
              value={testNumber}
              onChangeText={(v: string) => setTestNumber(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            <Input
              label={t('parentArea.developers.whatsappTestMessageLabel')}
              value={testMessage}
              onChangeText={setTestMessage}
              multiline
            />
            {testMutation.isSuccess && testMutation.data?.ok ? (
              <Text variant="bodySmall" color={colors.success}>{t('parentArea.developers.whatsappTestSent')}</Text>
            ) : null}
            {(testMutation.isSuccess && !testMutation.data?.ok) || testMutation.isError ? (
              <Text variant="bodySmall" color={colors.error}>{t('parentArea.developers.whatsappTestFailed')}</Text>
            ) : null}
            <Button
              label={t('parentArea.developers.whatsappTestSendBtn')}
              onPress={() => testMutation.mutate()}
              loading={testMutation.isPending}
              disabled={testNumber.length < 8 || !testMessage.trim()}
              fullWidth
            />
          </Card>
        ) : null}
      </ScrollView>
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

  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  qrWrap: { alignItems: 'center', gap: space.sm, marginVertical: space.md },
  qrImage: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: '#fff' },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
