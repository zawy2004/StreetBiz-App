import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts } from '@/theme';

/** Required on every screen running on mock data (Master Prompt App §5). */
export function MockBadge({
  style,
  label = 'Dữ liệu minh họa',
}: {
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 5,
          backgroundColor: colors.mangoTint,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        style,
      ]}
      accessibilityLabel={label}
    >
      <Icon sf="flask.fill" md="science" size={12} color={colors.onMango} />
      <Text
        style={{ fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.onMango }}
      >
        {label}
      </Text>
    </View>
  );
}

/** "Ảnh minh họa" on a photo that is not the stall's own. */
export function StockTag({ style, compact }: { style?: StyleProp<ViewStyle>; compact?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          backgroundColor: 'rgba(17,28,43,0.55)',
          borderRadius: 999,
          paddingHorizontal: 7,
          paddingVertical: 2,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fonts.medium,
          fontSize: 10.5,
          lineHeight: 14,
          color: 'rgba(255,255,255,0.95)',
        }}
      >
        {compact ? 'Minh họa' : 'Ảnh minh họa'}
      </Text>
    </View>
  );
}
