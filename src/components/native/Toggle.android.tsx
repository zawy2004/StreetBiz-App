import { Host } from '@expo/ui';
import { Switch } from '@expo/ui/jetpack-compose';
import * as Haptics from 'expo-haptics';

import { colors } from '@/theme';

/**
 * Material 3 switch in the brand orange (the theme's default primary would be a foreign navy):
 * orange track when on, a light track with a grey thumb when off.
 */
export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <Host matchContents>
      <Switch
        value={value}
        enabled={!disabled}
        colors={{
          checkedTrackColor: colors.cta,
          checkedThumbColor: colors.white,
          checkedBorderColor: colors.cta,
          uncheckedTrackColor: colors.sunken,
          uncheckedThumbColor: '#7B8794',
          uncheckedBorderColor: '#7B8794',
        }}
        onCheckedChange={(next) => {
          void Haptics.selectionAsync();
          onChange(next);
        }}
      />
    </Host>
  );
}
