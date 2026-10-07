import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { radius, spacing, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Card({ children, onPress, padded = true, style, testID }: Props) {
  const { colors } = useTheme();
  const base = [
    styles.card,
    { backgroundColor: colors.card, borderColor: colors.border },
    padded ? styles.padded : null,
    style,
  ];
  if (!onPress) return <View testID={testID} style={base}>{children}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed ? { backgroundColor: colors.sunken } : null]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  padded: { padding: spacing.lg },
});
