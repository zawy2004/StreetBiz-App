import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';

type Option = { value: string; label: string };

type Props = {
  label: string;
  value?: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
};

/** Field that opens a bottom sheet list (native dropdowns look different on every platform). */
export function SelectField({ label, value, options, onChange, placeholder = 'Chọn', error }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      <AppText variant="labelSm">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.box, { backgroundColor: colors.card, borderColor: error ? colors.error : colors.border }]}
      >
        <AppText variant="bodyLg" color={current ? 'text' : 'muted'} style={styles.text}>
          {current?.label ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size={22} color="muted" />
      </Pressable>
      {error ? <AppText variant="small" color="error">{error}</AppText> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <AppText variant="headline" style={styles.sheetTitle}>{label}</AppText>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={[styles.option, { borderTopColor: colors.border }]}
                >
                  <AppText variant="bodyLg" style={styles.text}>{o.label}</AppText>
                  {o.value === value ? <Icon name="check" size={22} color="primary" /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { minHeight: layout.input, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  text: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: radius.chip, borderTopRightRadius: radius.chip, paddingBottom: spacing.xl },
  sheetTitle: { padding: spacing.lg },
  option: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, borderTopWidth: 1 },
});
