// @ts-expect-error RN 0.85 quirk — Modal present at runtime
import { Modal } from 'react-native'; // eslint-disable-line
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, shadows, space } from '@/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'destructive' | 'neutral';

/**
 * layout="stack"  → botões empilhados verticalmente (ex: sair do desafio)
 * layout="row"    → botões lado a lado (ex: confirmar logout)
 *
 * primaryVariant  → estilo do botão primário (ação recomendada / cancelar)
 * confirmVariant  → estilo do botão de confirmação (ação perigosa)
 *   "primary"     = verde preenchido
 *   "destructive" = fundo neutro + texto vermelho
 *   "neutral"     = fundo neutro + texto cinza
 */
export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;

  // Botão primário — ação segura/recomendada (verde por padrão)
  primaryLabel: string;
  primaryVariant?: ButtonVariant;
  onPrimary: () => void;

  // Botão de confirmação — ação sendo confirmada
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;

  layout?: 'stack' | 'row';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  visible,
  title,
  message,
  primaryLabel,
  primaryVariant = 'primary',
  onPrimary,
  confirmLabel,
  confirmVariant = 'neutral',
  onConfirm,
  layout = 'stack',
}: ConfirmDialogProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text variant="h2" align="center" style={styles.title}>
            {title}
          </Text>

          {message ? (
            <Text
              variant="body"
              color={colors.text.secondary}
              align="center"
              style={styles.message}
            >
              {message}
            </Text>
          ) : null}

          <View
            style={[
              styles.actions,
              layout === 'row' ? styles.actionsRow : styles.actionsStack,
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                layout === 'row' ? styles.btnFlex : styles.btnFull,
                variantStyle(primaryVariant),
                pressed && styles.pressed,
              ]}
              onPress={onPrimary}
              accessibilityRole="button"
            >
              <Text variant="button" color={variantTextColor(primaryVariant)}>
                {primaryLabel}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                layout === 'row' ? styles.btnFlex : styles.btnFull,
                variantStyle(confirmVariant),
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text variant="button" color={variantTextColor(confirmVariant)}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Variant helpers ──────────────────────────────────────────────────────────

function variantStyle(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':     return styles.bgPrimary;
    case 'destructive': return styles.bgNeutral;
    case 'neutral':     return styles.bgNeutral;
  }
}

function variantTextColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':     return colors.text.inverse;
    case 'destructive': return colors.error;
    case 'neutral':     return colors.text.secondary;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
    ...shadows.lg,
  },
  title:   { marginBottom: space.xs },
  message: { lineHeight: 22, maxWidth: 280 },

  actions:      { width: '100%', marginTop: space.sm, gap: space.sm },
  actionsStack: { flexDirection: 'column' },
  actionsRow:   { flexDirection: 'row' },

  btn: {
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { width: '100%' },
  btnFlex: { flex: 1 },

  bgPrimary: { backgroundColor: colors.success },
  bgNeutral: { backgroundColor: colors.background.cardAlt ?? '#F3F4F6' },

  pressed: { opacity: 0.75 },
});
