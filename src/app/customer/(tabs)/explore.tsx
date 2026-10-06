import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/feedback/States';
import { Icon } from '@/components/common/Icon';
import { Thumb } from '@/components/common/Thumb';
import { FilterChips } from '@/components/forms/FilterChips';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { VendorCard } from '@/features/discovery/VendorCard';
import { VendorMap } from '@/features/discovery/VendorMap';
import { formatDistance, formatRating, useActiveVendors } from '@/features/discovery/useActiveVendors';
import { radius, spacing, useTheme } from '@/theme';

export default function ExploreScreen() {
  const { colors } = useTheme();
  const all = useActiveVendors();
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>();

  const toggle = (v: string) => setFilters((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]));
  let list = [...all];
  if (filters.includes('open')) list = list.filter((v) => v.storefront?.availability_status === 'OPEN');
  if (filters.includes('top')) list = list.filter((v) => v.rating >= 4.7);
  if (filters.includes('near')) list.sort((a, b) => a.distanceM - b.distanceM);

  const selected = list.find((v) => v.vendor.id === selectedId);

  const footer =
    mode === 'map' && selected ? (
      <View style={styles.sheet}>
        <View style={styles.sheetTop}>
          <Thumb size={56} />
          <View style={styles.sheetBody}>
            <AppText variant="headline">{selected.storefront?.name ?? selected.vendor.business_name}</AppText>
            <StatusChip code="VALID" />
            <AppText variant="small" color="muted">
              {selected.slot.slot_code} · ★ {formatRating(selected.rating)} · {formatDistance(selected.distanceM)}
            </AppText>
          </View>
        </View>
        <View style={styles.sheetActions}>
          <View style={styles.half}>
            <Button
              label="Chỉ đường"
              variant="outline"
              icon="directions"
              onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selected.slot.lat},${selected.slot.lng}`)}
            />
          </View>
          <View style={styles.half}>
            <Button label="Xem hồ sơ" onPress={() => goTo(`/customer/vendors/${selected.vendor.id}`)} />
          </View>
        </View>
      </View>
    ) : undefined;

  return (
    <Screen footer={footer}>
      <AppText variant="display">Hôm nay ăn gì trên phố?</AppText>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Tìm món, quán hoặc tuyến phố"
        onPress={() => goTo('/customer/search')}
        style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Icon name="magnify" size={22} color="muted" />
        <AppText color="muted">Tìm món, quán hoặc tuyến phố</AppText>
      </Pressable>

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: 'Quán ăn', icon: 'silverware-fork-knife' },
          { value: 'map', label: 'Trên bản đồ', icon: 'map-outline' },
        ]}
      />

      {mode === 'list' ? (
        <>
          <FilterChips
            options={[
              { value: 'near', label: 'Gần tôi' },
              { value: 'open', label: 'Đang mở' },
              { value: 'top', label: 'Đánh giá cao' },
            ]}
            selected={filters}
            onToggle={toggle}
          />
          {list.length ? (
            list.map((v) => <VendorCard key={v.vendor.id} item={v} onPress={() => goTo(`/customer/vendors/${v.vendor.id}`)} />)
          ) : (
            <EmptyState icon="storefront-outline" title="Không có quán phù hợp" />
          )}
        </>
      ) : (
        <VendorMap vendors={list} selectedId={selectedId} onSelect={setSelectedId} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.card },
  sheet: { gap: spacing.md },
  sheetTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  sheetBody: { flex: 1, gap: spacing.xs },
  sheetActions: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
