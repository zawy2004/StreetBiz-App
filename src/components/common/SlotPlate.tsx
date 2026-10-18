import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = {
  code: string;
  /** `sm`: the dark street-sign tag on cards and photos; `lg`: the outlined plate on the permit. */
  size?: 'sm' | 'lg';
  style?: StyleProp<ViewStyle>;
};

/** The slot code as a street-sign plate (web `.kerb-tag` / the V19 plate). */
export function SlotPlate({ code, size = 'sm', style }: Props) {
  if (size === 'lg') {
    return (
      <View style={[styles.lg, style]} accessibilityLabel={`Ô ${code}`}>
        <Text style={styles.lgText}>{code}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.sm, style]} accessibilityLabel={`Ô ${code}`}>
      <Text style={styles.smText}>Ô {code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sm: {
    alignSelf: 'flex-start',
    backgroundColor: colors.plate,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  smText: {
    fontFamily: fonts.code,
    fontSize: 13,
    lineHeight: 16,
    color: colors.white,
    letterSpacing: 0.4,
  },
  lg: {
    alignSelf: 'flex-start',
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: colors.plate,
    backgroundColor: colors.white,
  },
  lgText: {
    fontFamily: fonts.code,
    fontSize: 40,
    lineHeight: 46,
    color: colors.plate,
    letterSpacing: 1.2,
  },
});
