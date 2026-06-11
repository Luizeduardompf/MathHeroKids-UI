/**
 * AvatarPicker — grid selector using real PNG assets.
 * Selected state: double blue ring + checkmark badge (exact match to design).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from './Avatar';
import { colors, space } from '@/theme';
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
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={id}
            style={styles.cell}
          >
            {isSelected ? (
              // Double ring: outer semi-transparent + inner solid (exact design)
              <View style={styles.outerRing}>
                <View style={styles.innerRing}>
                  <Avatar avatarId={id} displayName={id} size="lg" />
                </View>
                {/* Check badge — bottom right */}
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                </View>
              </View>
            ) : (
              <Avatar avatarId={id} displayName={id} size="lg" />
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
    justifyContent: 'center',
  },
  cell: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Outer ring: semi-transparent blue circle (the "halo")
  outerRing: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(43, 82, 229, 0.35)',
    backgroundColor: 'rgba(43, 82, 229, 0.08)',
    position: 'relative',
  },
  // Inner ring: solid blue border directly around the avatar
  innerRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  // Checkmark badge — bottom right corner, blue circle with ✓
  checkBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
  },
});
