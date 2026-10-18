import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius, text } from '@/theme';
import { formatDate } from '@/utils/format';

/** `YYYY-MM-DD` ⇄ Date at local midnight (calendar dates, no time-zone shift). */
const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * A calendar date with the platform's own picker (Material dialog on Android, the compact
 * wheel on iPhone). Value and change are `YYYY-MM-DD`, the format the backend takes.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  minimumDate,
  maximumDate,
  optional,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  hint?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = value ? toDate(value) : (maximumDate ?? new Date());
  const ios = Platform.OS === 'ios';

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>
        {label}
        {optional ? <Text style={{ fontFamily: fonts.regular, color: colors.muted }}> (không bắt buộc)</Text> : null}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'chưa chọn'}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 52,
          paddingHorizontal: 14,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          borderWidth: error ? 1.5 : 1,
          borderColor: error ? colors.danger : colors.line,
          backgroundColor: colors.card,
        }}
      >
        <Icon sf="calendar" md="calendar_month" size={18} color={colors.muted} />
        {ios ? (
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <DateTimePicker
              value={current}
              mode="date"
              display="compact"
              locale="vi-VN"
              accentColor={colors.cta}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={(e, d) => {
                if (e.type === 'set' && d) onChange(toIso(d));
              }}
            />
          </View>
        ) : (
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: value ? colors.ink : colors.muted }}>
            {value ? formatDate(value) : 'Chọn ngày'}
          </Text>
        )}
      </Pressable>
      {!ios && open ? (
        <DateTimePicker
          value={current}
          mode="date"
          presentation="dialog"
          accentColor={colors.cta}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          positiveButton={{ label: 'Chọn' }}
          negativeButton={{ label: 'Huỷ' }}
          onChange={(e, d) => {
            setOpen(false);
            if (e.type === 'set' && d) onChange(toIso(d));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
      {error ? (
        <Text style={[text.footnote, { color: colors.onDanger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[text.footnote, { color: colors.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}
