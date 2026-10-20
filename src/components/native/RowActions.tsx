import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { Sheet } from '@/components/common/Sheet';
import { colors, fonts } from '@/theme';

export type RowAction = {
  id: string;
  title: string;
  icon: { sf: string; md: string };
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * A row's own actions on long press, in the platform's bottom sheet (Material modal bottom
 * sheet on Android, sheet on iOS) with a tick of haptics as it opens. Row menus are not built on
 * the drop-in `MenuView`: on Android its host sizes the trigger to its content and a full-width
 * row collapses to nothing. Every action here must also be reachable on the row's detail screen.
 *
 * `const rows = useRowActions();` then `onLongPress={() => rows.open('Ô NVL-17', actions)}` and
 * render `{rows.sheet}` once in the screen.
 */
export function useRowActions(): { open: (title: string, actions: RowAction[]) => void; sheet: ReactNode } {
  const [state, setState] = useState<{ title: string; actions: RowAction[] } | null>(null);
  const close = () => setState(null);
  const open = (title: string, actions: RowAction[]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState({ title, actions });
  };
  const sheet = (
    <Sheet visible={state != null} onClose={close} title={state?.title ?? ''}>
      <View style={{ gap: 2 }}>
        {(state?.actions ?? []).map((a) => (
          <Pressable
            key={a.id}
            disabled={a.disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: a.disabled }}
            onPress={() => {
              close();
              a.onPress();
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 8, borderRadius: 12, backgroundColor: pressed ? colors.pressed : 'transparent', opacity: a.disabled ? 0.45 : 1 })}
          >
            <Icon sf={a.icon.sf} md={a.icon.md} size={20} color={a.destructive ? colors.danger : colors.ink} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: a.destructive ? colors.danger : colors.ink }}>{a.title}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
  return { open, sheet };
}
