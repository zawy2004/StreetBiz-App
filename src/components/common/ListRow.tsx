import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { layout, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  testID?: string;
};

export function ListRow({ title, subtitle, icon, trailing, onPress, showChevron = !!onPress, testID }: Props) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: colors.sunken }]}>
          <Icon name={icon} size={22} color="indigo" />
        </View>
      ) : null}
      <View style={styles.body}>
        <AppText variant="label" numberOfLines={2}>{title}</AppText>
        {subtitle ? <AppText variant="small" color="muted" numberOfLines={2}>{subtitle}</AppText> : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevron-right" size={22} color="muted" /> : null}
    </>
  );
  const rowStyle = [styles.row, { borderBottomColor: colors.sunken }];
  if (!onPress) return <View testID={testID} style={rowStyle}>{content}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [rowStyle, pressed ? { backgroundColor: colors.sunken } : null]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.touch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
