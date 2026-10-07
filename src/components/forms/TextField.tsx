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

/** Filled field: sunken at rest, lifts to the card colour with a primary ring while focused. */
export function TextField({ label, error, icon, right, readOnly, multiline, ...input }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.primary : colors.sunken;
  const backgroundColor = readOnly ? colors.sunken : focused || error ? colors.card : colors.sunken;

  return (
    <View style={styles.wrap}>
      {label ? <AppText variant="labelSm">{label}</AppText> : null}
      <View style={[styles.box, multiline ? styles.multiline : null, { borderColor, backgroundColor }]}>
        {icon ? <Icon name={icon} size={20} color={focused ? 'primary' : 'muted'} /> : null}
        <TextInput
          {...input}
          multiline={multiline}
          editable={!readOnly && input.editable !== false}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          accessibilityLabel={label ?? input.placeholder}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[typography.bodyLg, styles.input, { color: readOnly ? colors.muted : colors.text }, multiline ? styles.textArea : null]}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.error}>
          <Icon name="alert-circle-outline" size={15} color="error" />
          <AppText variant="small" color="error" style={styles.errorText}>{error}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: {
    minHeight: layout.input + 4,
    borderRadius: radius.control + 2,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: { flex: 1, paddingVertical: 0, minHeight: layout.input - 4, outlineStyle: 'none' as never },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorText: { flex: 1 },
});
