import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { radius, spacing, useTheme } from '@/theme';

import type { SlotView } from './use-rentals';

type Props = {
  slots: SlotView[];
  street: string;
  selectedId?: string;
  onSelect?: (slot: SlotView) => void;
  /** Slots that should be dimmed because a filter excludes them. */
  hiddenIds?: string[];
};

const shortCode = (code: string) => code.replace(/^[A-Z]+-/, '');

/** Schematic street: slots drawn along both kerbs of one road. */
export function SlotMap({ slots, street, selectedId, onSelect, hiddenIds = [] }: Props) {
  const { colors } = useTheme();
  const half = Math.ceil(slots.length / 2);
  const top = slots.slice(0, half);
  const bottom = slots.slice(half);

  const renderRow = (row: SlotView[]) => (
    <View style={styles.row}>
      {row.map((slot) => (
        <Tile
          key={slot.id}
          slot={slot}
          selected={slot.id === selectedId}
          dimmed={hiddenIds.includes(slot.id)}
          onPress={() => onSelect?.(slot)}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.map, { backgroundColor: colors.sunken, borderColor: colors.border }]}>
      {renderRow(top)}
      <View style={[styles.road, { backgroundColor: colors.borderStrong }]}>
        <View style={[styles.centerLine, { borderColor: colors.card }]} />
        <View style={[styles.street, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AppText variant="labelSm">{street}</AppText>
        </View>
      </View>
      {renderRow(bottom)}
    </View>
  );
}

function Tile({ slot, selected, dimmed, onPress }: { slot: SlotView; selected: boolean; dimmed: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const free = slot.status === 'AVAILABLE';
  const pending = slot.status === 'PENDING' || slot.status === 'PENDING_APPLICATION';

  const tone = free
    ? { bg: colors.tertiaryBg, border: colors.tertiary, fg: colors.tertiary }
    : pending
      ? { bg: colors.secondaryBg, border: colors.secondary, fg: colors.onSecondary }
      : { bg: colors.card, border: colors.borderStrong, fg: colors.muted };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${slot.code}, ${free ? 'còn trống' : pending ? 'chờ duyệt' : 'đã thuê'}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.tile,
        { backgroundColor: tone.bg, borderColor: selected ? colors.primary : tone.border, borderWidth: selected ? 3 : 1.5, opacity: dimmed ? 0.35 : 1 },
      ]}
    >
      <AppText variant="labelSm" style={{ color: tone.fg }} numberOfLines={1}>{shortCode(slot.code)}</AppText>
      {free ? (
        <AppText variant="badge" style={{ color: tone.fg }}>Trống</AppText>
      ) : (
        <Icon name={pending ? 'clock-outline' : 'lock-outline'} size={18} color={tone.fg} />
      )}
    </Pressable>
  );
}

export function SlotLegend() {
  const { colors } = useTheme();
  const items = [
    { label: 'Trống', color: colors.tertiary },
    { label: 'Chờ duyệt', color: colors.secondary },
    { label: 'Đã thuê', color: colors.muted },
  ];
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: i.color }]} />
          <AppText variant="small">{i.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.card, borderWidth: 1, padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, minWidth: 0, height: 76, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  road: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  centerLine: { position: 'absolute', left: 8, right: 8, borderTopWidth: 2, borderStyle: 'dashed' },
  street: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.control, borderWidth: 1 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
