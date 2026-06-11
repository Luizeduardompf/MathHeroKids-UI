import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { colors, radius, space, textVariants } from '@/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  /** Show password toggle button */
  isPassword?: boolean;
  /** Leading icon rendered inside the field */
  leftIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  hint,
  error,
  isPassword = false,
  leftIcon,
  containerStyle,
  ...rest
}: InputProps) {
  const { t } = useTranslation();
  const [isSecure, setIsSecure] = useState(isPassword);
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);
  const borderColor = hasError
    ? colors.border.error
    : isFocused
      ? colors.border.focus
      : colors.border.default;

  return (
    <View style={[styles.container, containerStyle] as StyleProp<ViewStyle>}>
      {label ? (
        <Text variant="label" color={colors.text.primary} style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View style={[styles.field, { borderColor }]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

        <TextInput
          style={[
            styles.input,
            textVariants.body,
            { color: colors.text.primary },
            leftIcon ? { paddingLeft: 0 } : null,
          ] as import('react-native').StyleProp<import('react-native').TextStyle>}
          placeholderTextColor={colors.text.tertiary}
          secureTextEntry={isSecure}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />

        {isPassword ? (
          <Pressable
            style={styles.eyeButton}
            onPress={() => setIsSecure((v) => !v)}
            accessibilityLabel={isSecure ? t('common.showPassword') : t('common.hidePassword')}
          >
            <Ionicons
              name={isSecure ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.text.tertiary}
            />
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <Text variant="bodySmall" color={colors.error} style={styles.hint}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="bodySmall" color={colors.text.tertiary} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs },
  label: { marginBottom: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    height: 56,
    gap: space.sm,
  },
  leftIcon: { justifyContent: 'center' },
  input: { flex: 1, height: '100%' },
  eyeButton: { padding: space.xs },
  hint: { marginTop: 2 },
});
