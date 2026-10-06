import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';

export function SuccessView({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { backgroundColor: colors.tertiary }]}>
        <Icon name="check" size={44} color="#FFFFFF" />
      </View>
      <AppText variant="display" align="center">{title}</AppText>
      {subtitle ? <AppText color="muted" align="center">{subtitle}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  circle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
});
