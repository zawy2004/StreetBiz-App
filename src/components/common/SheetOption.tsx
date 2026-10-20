import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { colors, fonts, text } from '@/theme';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  icon?: { sf: string; md: string };
  last?: boolean;
};

/** A row in a choice sheet: the inset-grouped look, a checkmark on the current choice. */
export function SheetOption({ title, subtitle, selected, onPress, icon, last }: Props) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: pressed ? colors.pressed : colors.card,
      })}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: selected ? colors.cta : colors.brandTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            sf={icon.sf}
            md={icon.md}
            size={16}
            color={selected ? colors.white : colors.primary}
          />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            text.body,
            { color: colors.ink, fontFamily: selected ? fonts.bold : fonts.medium },
          ]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={[text.footnote, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {selected ? (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="checkmark" md="check" size={14} color={colors.white} weight="bold" />
        </View>
      ) : null}
      {!last ? (
        <View
          style={{
            position: 'absolute',
            left: icon ? 64 : 16,
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: colors.separator,
          }}
        />
      ) : null}
    </Pressable>
  );
}
