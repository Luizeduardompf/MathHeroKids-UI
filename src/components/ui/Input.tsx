import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { TextInputProps, StyleProp, ViewStyle } from 'react-native';

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
  const [isSecure, setIsSecure] = useState(isPassword);
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);
  const borderColor = hasError
    ? colors.border.error
    : isFocused
      ? colors.border.focus
      : colors.border.default;

  return (
    <View style={[styles.container, containerStyle]}>
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
            leftIcon ? { paddingLeft: 0 } : undefined,
          ]}
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
            accessibilityLabel={isSecure ? 'Show password' : 'Hide password'}
          >
            <Text variant="bodySmall" color={colors.text.tertiary}>
              {isSecure ? '👁' : '🙈'}
            </Text>
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
    borderRadius: radius.md,
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
