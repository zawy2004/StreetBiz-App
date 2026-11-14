import NativeSegmentedControl from '@expo/ui/community/segmented-control';
import * as Haptics from 'expo-haptics';

import { colors } from '@/theme';

export type SegmentOption<T extends string> = { key: T; label: string; count?: number };

/**
 * The platform's own segmented control (UISegmentedControl on iOS, Material 3 segmented
 * buttons on Android) for 2–4 peer choices. A count rides in the label ("Chờ duyệt (3)"),
 * since native segments carry text only. More than four options belong in a menu or sheet.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  /** `null` (or a value not in the list) shows nothing selected yet: a choice the person must make. */
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (key: T) => void;
  disabled?: boolean;
}) {
  const labels = options.map((o) => (o.count ? `${o.label} (${o.count > 99 ? '99+' : o.count})` : o.label));
  return (
    <NativeSegmentedControl
      values={labels}
      selectedIndex={options.findIndex((o) => o.key === value)}
      enabled={!disabled}
      tintColor={colors.brandTint}
      appearance="light"
      onChange={(event) => {
        const next = options[event.nativeEvent.selectedSegmentIndex];
        if (!next || next.key === value) return;
        void Haptics.selectionAsync();
        onChange(next.key);
      }}
    />
  );
}
