import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { fonts, statusTones, type StatusTone } from '@/theme';

/** A status always says itself in words and a glyph, never in colour alone. */
export function StatusPill({
  label,
  tone,
  style,
}: {
  label: string;
  tone: StatusTone;
  style?: StyleProp<ViewStyle>;
}) {
  const t = statusTones[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 5,
          borderRadius: 999,
          paddingHorizontal: 9,
          paddingVertical: 4,
          backgroundColor: t.wash,
        },
        style,
      ]}
    >
      <Icon sf={t.sf} md={t.md} size={13} color={t.ink} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, color: t.ink }}>
        {label}
      </Text>
    </View>
  );
}
