import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { radius, useTheme } from '@/theme';

import type { VendorListItem } from './use-discovery';

type Props = {
  vendors: VendorListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  height?: number;
};

/** Schematic street map with one pin per vendor (no tiles, so it works offline and on web). */
export function VendorMap({ vendors, selectedId, onSelect, height = 340 }: Props) {
  const { colors, scheme } = useTheme();
  const line = colors.card;

  return (
    <View style={[styles.map, { height, backgroundColor: colors.sunken, borderColor: colors.border }]}>
      <View style={[styles.river, { backgroundColor: scheme === 'dark' ? '#173247' : '#CFE6F7' }]} />
      <View style={[styles.road, styles.roadH1, { backgroundColor: line }]} />
      <View style={[styles.road, styles.roadH2, { backgroundColor: line }]} />
      <View style={[styles.road, styles.roadV1, { backgroundColor: line }]} />
      <View style={[styles.road, styles.roadV2, { backgroundColor: line }]} />
      <AppText variant="badge" color="muted" style={styles.label1}>Nguyễn Văn Linh</AppText>
      <AppText variant="badge" color="muted" style={styles.label2}>Sông Hàn</AppText>

      {vendors.map((v) => {
        const selected = v.key === selectedId;
        return (
          <Pressable
            key={v.key}
            accessibilityRole="button"
            accessibilityLabel={v.name}
            accessibilityState={{ selected }}
            onPress={() => onSelect(v.key)}
            style={[
              styles.pin,
              {
                left: `${v.pin.x * 100}%`,
                top: `${v.pin.y * 100}%`,
                width: selected ? 48 : 40,
                height: selected ? 48 : 40,
                backgroundColor: selected ? colors.indigo : colors.primary,
                borderColor: colors.card,
              },
            ]}
          >
            <Icon name="silverware-fork-knife" size={selected ? 24 : 20} color={selected ? 'onIndigo' : 'onPrimary'} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  river: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '16%' },
  road: { position: 'absolute' },
  roadH1: { left: 0, right: 0, top: '40%', height: 14 },
  roadH2: { left: 0, right: 0, top: '72%', height: 10 },
  roadV1: { top: 0, bottom: 0, left: '34%', width: 12 },
  roadV2: { top: 0, bottom: 0, left: '72%', width: 10 },
  label1: { position: 'absolute', left: 8, top: '43%' },
  label2: { position: 'absolute', right: 6, top: 8 },
  pin: {
    position: 'absolute',
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
