import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { spacing } from '@/theme';

import { AppText } from '../common/AppText';

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <AppText variant="headline">{title}</AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
