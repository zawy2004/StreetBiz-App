import { ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, space, text } from '@/theme';

type Props = { title: string; icon: { sf: string; md: string }; body: string; group: string };

/**
 * A tab or screen that belongs to a later group of screens. It says so plainly instead of
 * pretending to work (Cổng 1 only builds Khám phá and Giấy phép số).
 */
export function ComingSoon({ title, icon, body, group }: Props) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingTop: 64, gap: 16 }}
    >
      <Text style={[text.largeTitle, { color: colors.ink }]}>{title}</Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          borderCurve: 'continuous',
          padding: 20,
          alignItems: 'center',
          gap: 10,
          marginTop: 24,
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: colors.brandTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sf={icon.sf} md={icon.md} size={28} color={colors.primary} />
        </View>
        <Text style={[text.headline, { color: colors.ink, textAlign: 'center' }]}>{body}</Text>
        <Text style={[text.footnote, { color: colors.muted, textAlign: 'center' }]}>
          Thuộc nhóm màn {group}, làm sau Cổng 1.
        </Text>
      </View>
    </ScrollView>
  );
}
