import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius } from '@/theme';

/**
 * BR-42: everything an AI produced is labelled "[AI]" where it is shown. It is a suggestion;
 * a person (the vendor, or the ward officer) checks and decides.
 */
export function AiTag({ label = 'Gợi ý', style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityLabel={`[AI] ${label}`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: colors.mangoTint,
        },
        style,
      ]}
    >
      <Icon sf="sparkles" md="auto_awesome" size={11} color={colors.onMango} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.onMango }}>[AI] {label}</Text>
    </View>
  );
}

/** A soft panel for AI output (the web's AiHint: mango, the advisory colour), never styled like an official decision. */
export const aiPanel: ViewStyle = {
  padding: 14,
  gap: 8,
  borderRadius: radius.card,
  borderCurve: 'continuous',
  backgroundColor: '#FFFAEB',
  borderWidth: 1,
  borderColor: '#FFE7A3',
  borderLeftWidth: 5,
  borderLeftColor: colors.mango,
};

