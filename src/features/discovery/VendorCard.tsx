import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Thumb } from '@/components/common/Thumb';
import { StatusChip } from '@/components/status/StatusChip';
import { radius, spacing, useTheme } from '@/theme';

import type { VendorListItem } from './use-discovery';
import { formatDistance, formatRating } from './useActiveVendors';

function Meta({ item, compact }: { item: VendorListItem; compact?: boolean }) {
  const parts = [item.ratingCount ? `(${item.ratingCount})` : null, item.distanceM !== null ? formatDistance(item.distanceM) : null].filter(Boolean);
  return (
    <View style={styles.meta}>
      <Icon name="star" size={compact ? 14 : 15} color="secondary" />
      <AppText variant={compact ? 'caption' : 'labelSm'}>{item.rating !== null ? formatRating(item.rating) : 'Mới'}</AppText>
      {parts.length ? <AppText variant={compact ? 'caption' : 'small'} color="muted">{parts.join(' · ')}</AppText> : null}
    </View>
  );
}

/** List row for a licensed vendor: who, how good, how far, and whether it is open now. */
export function VendorCard({ item, onPress }: { item: VendorListItem; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={styles.row}>
      <Thumb size={76} seed={item.vendorId + item.slotCode} icon="storefront-outline" />
      <View style={styles.body}>
        <AppText variant="headline" numberOfLines={1}>{item.name}</AppText>
        <Meta item={item} />
        <View style={styles.meta}>
          {item.isOpen !== undefined ? <StatusChip code={item.isOpen ? 'OPEN' : 'CLOSED'} /> : null}
          <View style={[styles.licensed, { backgroundColor: colors.tertiaryBg }]}>
            <Icon name="check-decagram" size={13} color="tertiary" />
            <AppText variant="badge" style={{ color: colors.tertiary }}>Có giấy phép</AppText>
          </View>
        </View>
        <AppText variant="caption" color="muted" numberOfLines={1}>{item.slotCode} · {item.street}</AppText>
      </View>
    </Card>
  );
}

/** Compact card for the horizontal "Đang mở gần bạn" strip on Explore. */
export function VendorTile({ item, onPress }: { item: VendorListItem; onPress: () => void }) {
  return (
    <Card onPress={onPress} padded={false} style={styles.tile}>
      <View style={styles.tileArt}>
        <Thumb size={64} seed={item.vendorId + item.slotCode} icon="storefront-outline" rounded />
      </View>
      <View style={styles.tileBody}>
        <AppText variant="label" numberOfLines={1}>{item.name}</AppText>
        <Meta item={item} compact />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  body: { flex: 1, gap: 5, minWidth: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  licensed: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  tile: { width: 168 },
  tileArt: { height: 92, alignItems: 'center', justifyContent: 'center' },
  tileBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 4 },
});
