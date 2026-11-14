import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Called once all digits are in, so the form can submit without another tap. */
  onComplete?: (code: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
};

/**
 * Six boxes over one hidden input: the OS offers the SMS code (one-time-code autofill),
 * paste works, and backspace goes back, because there is really only one field.
 */
export function OtpField({ value, onChange, onComplete, length = 6, error, autoFocus }: Props) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessibilityRole="none"
      style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}
    >
      {Array.from({ length }, (_, i) => {
        const active = focused && i === Math.min(value.length, length - 1);
        const filled = i < value.length;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              maxWidth: 52,
              height: 58,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: active || error ? 2 : 1,
              borderColor: error ? colors.danger : active ? colors.cta : filled ? colors.ink : colors.line,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.code, fontSize: 26, color: colors.ink }}>
              {digits[i] ?? ''}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const code = t.replace(/\D/g, '').slice(0, length);
          onChange(code);
          if (code.length === length) onComplete?.(code);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        accessibilityLabel={`Mã xác thực ${length} số`}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}
