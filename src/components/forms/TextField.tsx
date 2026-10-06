import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { layout, radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string;
  icon?: IconName;
  right?: ReactNode;
  readOnly?: boolean;
};

export function TextField({ label, error, icon, right, readOnly, multiline, ...input }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.indigo : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? <AppText variant="labelSm">{label}</AppText> : null}
      <View
        style={[
          styles.box,
          multiline ? styles.multiline : null,
          {
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
            backgroundColor: readOnly ? colors.sunken : colors.card,
          },
        ]}
      >
        {icon ? <Icon name={icon} size={20} color="muted" /> : null}
        <TextInput
          {...input}
          multiline={multiline}
          editable={!readOnly && input.editable !== false}
          placeholderTextColor={colors.muted}
          accessibilityLabel={label ?? input.placeholder}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[typography.bodyLg, styles.input, { color: colors.text }, multiline ? styles.textArea : null]}
        />
        {right}
      </View>
      {error ? <AppText variant="small" color="error">{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: {
    minHeight: layout.input,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: { flex: 1, paddingVertical: 0, minHeight: layout.input - 4, outlineStyle: 'none' as never },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
});
