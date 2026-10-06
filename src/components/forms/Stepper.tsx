import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';

export function Stepper({ step, total }: { step: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityLabel={`Bước ${step} trên ${total}`}>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i < step ? colors.primary : colors.border }]} />
        ))}
      </View>
      <AppText variant="small" color="muted">Bước {step}/{total}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
