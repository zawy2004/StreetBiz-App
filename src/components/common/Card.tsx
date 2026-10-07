import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { radius, spacing, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  /** `sunken` for secondary panels that sit inside or beside a regular card. */
  tone?: 'default' | 'sunken';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Card({ children, onPress, padded = true, tone = 'default', style, testID }: Props) {
  const { colors, shadow } = useTheme();
  const sunken = tone === 'sunken';
  const base = [
    styles.card,
    sunken ? null : shadow.card,
    { backgroundColor: sunken ? colors.sunken : colors.card, borderColor: sunken ? colors.sunken : colors.border },
    padded ? styles.padded : null,
    style,
  ];
  if (!onPress) return <View testID={testID} style={base}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, pressed ? { backgroundColor: colors.sunken, transform: [{ scale: 0.99 }] } : null]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2 },
  padded: { padding: spacing.lg },
});
