import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius, text } from '@/theme';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Shown under the field in red, next to a warning glyph; replaces the hint. */
  error?: string;
  /** Persistent help under the field (not a placeholder: it stays while typing). */
  hint?: string;
  icon?: { sf: string; md: string };
  /** Anything after the input: a unit ("đ"), a show/hide button. */
  trailing?: ReactNode;
  /** Optional marker after the label. */
  optional?: boolean;
};

/**
 * The one text field of the app: a visible label above, a filled 56 pt box that turns white
 * with an orange rim when focused and red with a message below when wrong. Errors sit next to the field they are
 * about, never only at the top of the form.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, icon, trailing, optional, editable = true, multiline, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const border = error ? colors.danger : focused ? colors.cta : colors.line;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>
        {label}
        {optional ? (
          <Text style={{ fontFamily: fonts.regular, color: colors.muted }}> (không bắt buộc)</Text>
        ) : null}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: multiline ? 108 : 56,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          // v5: a filled field that lights up white with an orange rim and glow when typed in.
          borderWidth: 1.5,
          borderColor: focused || error ? border : 'transparent',
          backgroundColor: !editable ? colors.sunken : focused ? colors.card : error ? colors.dangerTint : colors.sunken,
          boxShadow: focused && !error ? '0 0 0 4px rgba(238, 85, 0, 0.14)' : undefined,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 12 : 0,
          gap: 10,
        }}
      >
        {icon ? (
          <Icon
            sf={icon.sf}
            md={icon.md}
            size={18}
            color={focused ? colors.cta : error ? colors.danger : colors.muted}
            style={multiline ? { marginTop: 2 } : undefined}
          />
        ) : null}
        <TextInput
          ref={ref}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          selectionColor={colors.cta}
          cursorColor={colors.cta}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={{
            flex: 1,
            minHeight: multiline ? 84 : 52,
            fontFamily: fonts.semibold,
            fontSize: 16,
            color: colors.ink,
            paddingVertical: multiline ? 0 : 0,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {trailing}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Icon
            sf="exclamationmark.circle.fill"
            md="error"
            size={14}
            color={colors.danger}
            style={{ marginTop: 2 }}
          />
          <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[text.footnote, { color: colors.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

/** Phone number, the account identifier everywhere in StreetBiz (0905 123 456). */
export const PhoneField = forwardRef<TextInput, Omit<TextFieldProps, 'label'> & { label?: string }>(
  function PhoneField({ label = 'Số điện thoại', ...props }, ref) {
    return (
      <TextField
        ref={ref}
        label={label}
        icon={{ sf: 'phone.fill', md: 'call' }}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="0905 123 456"
        maxLength={13}
        returnKeyType="next"
        {...props}
      />
    );
  },
);

/** Password with a show/hide eye; `isNew` tells the OS to offer a strong password. */
export const PasswordField = forwardRef<
  TextInput,
  Omit<TextFieldProps, 'label'> & { label?: string; isNew?: boolean }
>(function PasswordField({ label = 'Mật khẩu', isNew, ...props }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      ref={ref}
      label={label}
      icon={{ sf: 'lock.fill', md: 'lock' }}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType={isNew ? 'newPassword' : 'password'}
      autoComplete={isNew ? 'new-password' : 'current-password'}
      trailing={
        <Pressable
          onPress={() => setShown((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon
            sf={shown ? 'eye.slash.fill' : 'eye.fill'}
            md={shown ? 'visibility_off' : 'visibility'}
            size={18}
            color={colors.muted}
          />
        </Pressable>
      }
      {...props}
    />
  );
});
