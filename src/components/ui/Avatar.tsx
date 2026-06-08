import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius } from '@/theme';
import type { AvatarId } from '@/constants/config';
import type { AvatarSize } from '@/types';

const sizeMap: Record<AvatarSize, { container: number; fontSize: number; borderRadius: number }> = {
  xs: { container: 28, fontSize: 10, borderRadius: radius.full },
  sm: { container: 36, fontSize: 13, borderRadius: radius.full },
  md: { container: 48, fontSize: 17, borderRadius: radius.full },
  lg: { container: 64, fontSize: 22, borderRadius: radius.full },
  xl: { container: 80, fontSize: 28, borderRadius: radius.full },
};

/** Stable color derived from username — same user always gets same color */
function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.avatar.length;
  return colors.avatar[index] ?? colors.primary;
}

interface AvatarProps {
  /** Predefined avatar ID (maps to an image asset in Phase 2) */
  avatarId?: AvatarId;
  /** Fallback display name — used to generate initials */
  displayName: string;
  size?: AvatarSize;
  /** Ring color for active/selected state */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({
  avatarId: _avatarId,
  displayName,
  size = 'md',
  ringColor,
  style,
}: AvatarProps) {
  const s = sizeMap[size];
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const bgColor = colorFromString(displayName);

  // TODO Phase 2: render Image from avatarId asset when avatar images are added
  return (
    <View
      style={[
        styles.container,
        {
          width: s.container,
          height: s.container,
          borderRadius: s.borderRadius,
          backgroundColor: bgColor,
          borderWidth: ringColor ? 2.5 : 0,
          borderColor: ringColor ?? undefined,
        },
        style,
      ] as StyleProp<ViewStyle>}
      accessibilityLabel={displayName}
    >
      <Text
        style={{ fontSize: s.fontSize, fontWeight: '700', color: colors.text.inverse }}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
