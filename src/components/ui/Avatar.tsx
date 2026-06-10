import React from 'react';
import { StyleSheet, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius } from '@/theme';
import type { AvatarId } from '@/constants/config';
import type { AvatarSize } from '@/types';

// ─── Static image map (Metro requires static paths) ───────────────────────────

const AVATAR_IMAGES: Record<AvatarId, number> = {
  sofia: require('../../../assets/images/avatars/avatar-sofia.png'),
  lucas: require('../../../assets/images/avatars/avatar-lucas.png'),
  luna:  require('../../../assets/images/avatars/avatar-luna.png'),
  mia:   require('../../../assets/images/avatars/avatar-mia.png'),
  pedro: require('../../../assets/images/avatars/avatar-pedro.png'),
  theo:  require('../../../assets/images/avatars/avatar-theo.png'),
};

// ─── Size tokens ──────────────────────────────────────────────────────────────

const sizeMap: Record<AvatarSize, { container: number; fontSize: number }> = {
  xs: { container: 28,  fontSize: 10 },
  sm: { container: 36,  fontSize: 13 },
  md: { container: 48,  fontSize: 17 },
  lg: { container: 64,  fontSize: 22 },
  xl: { container: 80,  fontSize: 28 },
};

// ─── Stable color from display name (initials fallback) ───────────────────────

function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors.avatar[Math.abs(hash) % colors.avatar.length] ?? colors.primary;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AvatarProps {
  avatarId?: AvatarId;
  displayName: string;
  size?: AvatarSize;
  /** Ring color for active/selected state */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({
  avatarId,
  displayName,
  size = 'md',
  ringColor,
  style,
}: AvatarProps) {
  const s   = sizeMap[size];
  const src = avatarId ? AVATAR_IMAGES[avatarId] : null;

  return (
    <View
      style={[
        styles.container,
        {
          width:           s.container,
          height:          s.container,
          borderRadius:    radius.full,
          backgroundColor: src ? colors.background.cardAlt : colorFromString(displayName),
          borderWidth:     ringColor ? 2.5 : 0,
          borderColor:     ringColor ?? undefined,
        },
        style,
      ] as StyleProp<ViewStyle>}
      accessibilityLabel={displayName}
    >
      {src ? (
        <Image
          source={src}
          style={{ width: s.container, height: s.container, borderRadius: radius.full }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ fontSize: s.fontSize, fontWeight: '700', color: colors.text.inverse }}>
          {displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
        </Text>
      )}
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
