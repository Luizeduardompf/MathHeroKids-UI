import { Ionicons } from '@expo/vector-icons';
import type React from 'react';

export type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IoniconsName;
  size?: number;
  color?: string;
}

/**
 * Thin wrapper over Ionicons.
 * Use this everywhere you need a vector icon so the underlying library
 * can be swapped in one place (Phase 2: custom SVG set).
 */
export function Icon({ name, size = 20, color }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
