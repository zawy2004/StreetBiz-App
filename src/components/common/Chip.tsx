import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { colors, fonts } from '@/theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: { sf: string; md: string };
  /** Shown after the label for a chip that opens a choice (sort). */
  trailingChevron?: boolean;
  leading?: ReactNode;
  accessibilityRole?: 'button' | 'switch' | 'radio';
};

/**
 * A filter capsule. Selection ticks with a selection haptic; the colour change is instant,
 * because filters are toggled many times a session (no animation for frequent actions).
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  trailingChevron,
  leading,
  accessibilityRole = 'button',
}: Props) {
  const fg = selected ? colors.white : colors.ink;
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={
        accessibilityRole === 'switch' ? { checked: !!selected } : { selected: !!selected }
      }
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingLeft: leading ? 4 : 14,
        paddingRight: 14,
        borderRadius: 19,
        borderCurve: 'continuous',
        backgroundColor: selected ? colors.cta : pressed ? colors.sunken : colors.card,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.line,
      })}
    >
      {leading}
      {icon ? (
        <Icon
          sf={icon.sf}
          md={icon.md}
          size={15}
          color={selected ? colors.white : colors.primary}
        />
      ) : null}
      <Text style={{ fontFamily: selected ? fonts.bold : fonts.semibold, fontSize: 14, color: fg }}>
        {label}
      </Text>
      {trailingChevron ? <Icon sf="chevron.down" md="expand_more" size={12} color={fg} /> : null}
    </Pressable>
  );
}
