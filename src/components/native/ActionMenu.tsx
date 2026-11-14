import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors } from '@/theme';
import { useRowActions, type RowAction } from './RowActions';

export type MenuItem = Omit<RowAction, 'icon'> & {
  icon?: RowAction['icon'];
  /** Checkmark, for a choice inside the menu (sort order, filter). */
  checked?: boolean;
};

/**
 * A screen's secondary actions behind a compact trigger (the header "…", a sort chip), opened
 * on tap (or long press with `longPress`) as the platform's bottom sheet.
 *
 * Why not the drop-in `MenuView` of `@expo/ui`: on Android (Expo Go 57) its host gives the
 * trigger zero height, so the trigger disappears (checked on the emulator, B0). One sheet
 * pattern on both platforms is verified and consistent; iOS may later move to the system menu.
 */
export function ActionMenu({
  items,
  title,
  longPress,
  children,
  style,
  accessibilityLabel,
}: {
  items: MenuItem[];
  title: string;
  longPress?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const menu = useRowActions();
  const open = () =>
    menu.open(
      title,
      items.map((i) => ({
        ...i,
        icon: i.checked ? { sf: 'checkmark', md: 'check' } : (i.icon ?? { sf: 'circle', md: 'radio_button_unchecked' }),
      })),
    );
  return (
    <>
      <Pressable
        onPress={longPress ? undefined : open}
        onLongPress={longPress ? open : undefined}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </Pressable>
      {menu.sheet}
    </>
  );
}

/** "…" in a header or a row: the trigger for an `ActionMenu`. 44 pt, labelled for screen readers. */
export function MoreButton({ label = 'Thêm thao tác', items, title }: { label?: string; items: MenuItem[]; title: string }) {
  return (
    <ActionMenu items={items} title={title} accessibilityLabel={label}>
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf="ellipsis.circle" md="more_vert" size={22} color={colors.primary} />
      </View>
    </ActionMenu>
  );
}
