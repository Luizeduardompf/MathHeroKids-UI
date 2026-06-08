import React from 'react';
import { Text as RNText } from 'react-native';
import type { TextStyle } from 'react-native';

import { textVariants, colors } from '@/theme';
import type { TextVariant } from '@/theme/typography';

/**
 * Semantic text component.
 *
 * Exposes every RNText prop explicitly so the component works correctly
 * even when @types/react-native has type-resolution issues in certain envs.
 */
export interface TextProps {
  variant?: TextVariant;
  /** Override computed color */
  color?: string;
  /** Shorthand for textAlign */
  align?: 'left' | 'center' | 'right' | 'justify';
  /** React 19: children must be declared explicitly */
  children?: React.ReactNode;
  // ─── Common RNText passthrough props ───────────────────────────────────────
  style?: TextStyle | TextStyle[] | null | false | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPress?: (...args: any[]) => void;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  selectable?: boolean;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  testID?: string;
  allowFontScaling?: boolean;
}

export function Text({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const variantStyle = textVariants[variant];

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <RNText
      style={[
        variantStyle as TextStyle,
        { color: color ?? colors.text.primary },
        align ? { textAlign: align } : null,
        style as TextStyle,
      ] as unknown as TextStyle}
      {...(rest as object)}
    >
      {children}
    </RNText>
  );
}

export type { TextVariant };
