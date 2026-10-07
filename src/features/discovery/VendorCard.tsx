import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Thumb } from '@/components/common/Thumb';
import { StatusChip } from '@/components/status/StatusChip';
import { spacing } from '@/theme';

import { formatDistance, formatRating, type ActiveVendor } from './useActiveVendors';

export function VendorCard({ item, onPress }: { item: ActiveVendor; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.row}>
      <Thumb size={72} />
      <View style={styles.body}>
        <AppText variant="headline">{item.storefront?.name ?? item.vendor.business_name}</AppText>
        <StatusChip code="VALID" />
        <AppText variant="small" color="muted">
          {item.slot.slot_code} · {formatDistance(item.distanceM)} · ★ {formatRating(item.rating)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});
