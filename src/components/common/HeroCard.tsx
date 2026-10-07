import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { brandGlow, radius, spacing, useTheme } from '@/theme';

import { Glow } from './Glow';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /** Accent of the glow: brand orange (default), amber, or green for "all good" states. */
  accent?: 'brand' | 'amber' | 'green';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const GLOW = { brand: brandGlow.from, amber: brandGlow.to, green: '#0B8A4B' } as const;

/** Dark "night street" card for the one thing that matters most on a screen. */
export function HeroCard({ children, onPress, accent = 'brand', style, testID }: Props) {
  const { colors, shadow } = useTheme();
  const body = (
    <>
      <Glow cx={0.05} cy={0} r={0.95} color={GLOW[accent]} opacity={0.42} />
      <Glow cx={1} cy={1} r={0.7} color={brandGlow.to} opacity={0.16} />
      <View style={styles.content}>{children}</View>
    </>
  );
  const base = [styles.card, shadow.raised, { backgroundColor: colors.hero, borderColor: colors.heroLine }, style];

  if (!onPress) return <View testID={testID} style={base}>{body}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed ? styles.pressed : null]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, borderWidth: 1, overflow: 'hidden' },
  content: { padding: spacing.xl - 4, gap: spacing.md },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
