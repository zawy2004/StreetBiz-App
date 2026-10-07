import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme, type ColorTokens } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = { name: IconName; size?: number; color?: keyof ColorTokens | string };

export function Icon({ name, size = 22, color = 'text' }: Props) {
  const { colors } = useTheme();
  const resolved = color in colors ? colors[color as keyof ColorTokens] : color;
  return <MaterialCommunityIcons name={name} size={size} color={resolved} />;
}
