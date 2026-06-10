/**
 * AvatarPicker — grid selector using real PNG assets.
 * Replaces the emoji-based selector in register/child, add-child, and edit-child.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Avatar } from './Avatar';
import { colors, radius, space } from '@/theme';
import { AVATAR_IDS } from '@/constants/config';
import type { AvatarId } from '@/constants/config';

interface AvatarPickerProps {
  selected: AvatarId;
  onSelect: (id: AvatarId) => void;
  style?: StyleProp<ViewStyle>;
}

export function AvatarPicker({ selected, onSelect, style }: AvatarPickerProps) {
  return (
    <View style={[styles.grid, style] as StyleProp<ViewStyle>}>
      {AVATAR_IDS.map((id) => {
        const isSelected = id === selected;
        return (
          <Pressable
            key={id}
            onPress={() => onSelect(id)}
            style={[
              styles.cell,
              isSelected ? styles.cellSelected : null,
            ] as StyleProp<ViewStyle>}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={id}
          >
            <Avatar
              avatarId={id}
              displayName={id}
              size="lg"
              ringColor={isSelected ? colors.primary : undefined}
            />
            {isSelected && (
              <View style={styles.checkBadge}>
                <View style={styles.checkInner} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  cell: {
    position: 'relative',
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  checkInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});
