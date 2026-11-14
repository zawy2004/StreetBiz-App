import { Host, Switch } from '@expo/ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';

import { colors } from '@/theme';

/** SwiftUI toggle tinted with the brand orange; the row around it carries the label. */
export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <Host matchContents>
      <Switch
        value={value}
        disabled={disabled}
        modifiers={[tint(colors.cta)]}
        onValueChange={(next) => {
          void Haptics.selectionAsync();
          onChange(next);
        }}
      />
    </Host>
  );
}
