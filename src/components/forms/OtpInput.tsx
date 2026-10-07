import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

type Props = { value: string; onChangeText: (value: string) => void; length?: number };

/** Boxes drawn over one hidden numeric input, so the system keypad and paste both work. */
export function OtpInput({ value, onChangeText, length = 6 }: Props) {
  const { colors } = useTheme();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessibilityLabel="Mã xác thực">
      {Array.from({ length }, (_, i) => {
        const active = focused && i === Math.min(value.length, length - 1);
        return (
          <View
            key={i}
            style={[
              styles.box,
              { backgroundColor: colors.card, borderColor: active ? colors.primary : colors.border, borderWidth: active ? 2 : 1 },
            ]}
          >
            <TextInput
              editable={false}
              pointerEvents="none"
              value={value[i] ?? ''}
              style={[typography.title, styles.digit, { color: colors.text }]}
            />
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoFocus
        maxLength={length}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  box: { flex: 1, height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  digit: { textAlign: 'center', width: '100%', padding: 0 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
