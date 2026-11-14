import * as Haptics from 'expo-haptics';
import { Switch } from 'react-native';

import { colors } from '@/theme';

/** Fallback (web): the platform files `Toggle.ios.tsx` / `Toggle.android.tsx` render the native switch. */
export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      disabled={disabled}
      trackColor={{ true: colors.cta, false: colors.line }}
      thumbColor={colors.white}
      onValueChange={(next) => {
        void Haptics.selectionAsync();
        onChange(next);
      }}
    />
  );
}
