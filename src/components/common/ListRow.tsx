import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { accentTone, layout, radius, spacing, useTheme, type AccentTone } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: AccentTone;
  trailing?: ReactNode;
  /** Shown under the subtitle, e.g. a status chip. */
  meta?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  /** Hides the bottom divider, for the last row of a card. */
  last?: boolean;
  testID?: string;
};

export function ListRow({ title, subtitle, icon, iconTone = 'indigo', trailing, meta, onPress, showChevron = !!onPress, last, testID }: Props) {
  const { colors } = useTheme();
  const tone = accentTone(colors, iconTone);
  const content = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Icon name={icon} size={21} color={tone.fg} />
        </View>
      ) : null}
      <View style={styles.body}>
        <AppText variant="label" numberOfLines={2}>{title}</AppText>
        {subtitle ? <AppText variant="small" color="muted" numberOfLines={2}>{subtitle}</AppText> : null}
        {meta}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevron-right" size={22} color="muted" /> : null}
    </>
  );
  const rowStyle = [styles.row, { borderBottomColor: last ? 'transparent' : colors.border }];
  if (!onPress) return <View testID={testID} style={rowStyle}>{content}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [rowStyle, pressed ? { backgroundColor: colors.sunken } : null]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.touch + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
