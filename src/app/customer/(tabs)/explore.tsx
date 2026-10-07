import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Icon, type IconName } from '@/components/common/Icon';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { FilterChips } from '@/components/forms/FilterChips';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { VendorCard, VendorTile } from '@/features/discovery/VendorCard';
import { VendorMap } from '@/features/discovery/VendorMap';
import { useCategories, useVendorList, type VendorListItem } from '@/features/discovery/use-discovery';
import { formatDistance, formatRating } from '@/features/discovery/useActiveVendors';
import { useAuthStore } from '@/store/auth-store';
import { accentTone, layout, radius, spacing, useTheme, type AccentTone } from '@/theme';

/** Icon per category, matched on its name (ids differ between the demo data and the backend). */
function categoryLook(name: string): { icon: IconName; tone: AccentTone } {
  const n = name.toLowerCase();
  if (n.includes('bánh mì')) return { icon: 'baguette', tone: 'secondary' };
  if (n.includes('cà phê') || n.includes('trà')) return { icon: 'coffee-outline', tone: 'indigo' };
  if (n.includes('nước') || n.includes('sinh tố')) return { icon: 'cup-outline', tone: 'tertiary' };
  if (n.includes('xôi') || n.includes('cơm')) return { icon: 'rice', tone: 'secondary' };
  if (n.includes('bún') || n.includes('phở') || n.includes('mì')) return { icon: 'noodles', tone: 'primary' };
  if (n.includes('ăn vặt') || n.includes('bánh')) return { icon: 'food-hot-dog', tone: 'primary' };
  return { icon: 'food', tone: 'indigo' };
}

/** "Cà phê / Trà" -> "Cà phê", "Ăn vặt (Bánh tráng…)" -> "Ăn vặt". */
const shortName = (name: string) => name.split(' (')[0]!.split(' / ')[0]!;

const byDistance = (a: VendorListItem, b: VendorListItem) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity);

export default function ExploreScreen() {
  const { colors, shadow } = useTheme();
  const user = useAuthStore((s) => s.user);
  const vendors = useVendorList();
  const categories = useCategories().data ?? [];
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState<string[]>([]);
  const [category, setCategory] = useState<string>();
  const [selectedKey, setSelectedKey] = useState<string>();

  const all = vendors.data ?? [];
  const toggle = (v: string) => setFilters((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]));
  let list = [...all];
  if (category) list = list.filter((v) => v.categories.includes(category));
  if (filters.includes('open')) list = list.filter((v) => v.isOpen);
  if (filters.includes('top')) list = list.filter((v) => (v.rating ?? 0) >= 4.5);
  if (filters.includes('near')) list.sort(byDistance);

  const openNow = all.filter((v) => v.isOpen).sort(byDistance);
  const selected = list.find((v) => v.key === selectedKey);
  const firstName = user?.fullName.trim().split(/\s+/).slice(-1)[0];
  const open = (v: VendorListItem) => goTo(`/customer/vendors/${v.vendorId}`);

  const footer =
    mode === 'map' && selected ? (
      <View style={styles.sheet}>
        <View style={styles.sheetTop}>
          <Thumb size={56} seed={selected.vendorId + selected.slotCode} icon="storefront-outline" />
          <View style={styles.sheetBody}>
            <AppText variant="headline">{selected.name}</AppText>
            <StatusChip code="VALID" />
            <AppText variant="small" color="muted">
              {[selected.slotCode, selected.rating !== null ? `★ ${formatRating(selected.rating)}` : null, selected.distanceM !== null ? formatDistance(selected.distanceM) : null]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
        </View>
        <View style={styles.sheetActions}>
          <View style={styles.half}>
            <Button
              label="Chỉ đường"
              variant="outline"
              icon="directions"
              onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`)}
            />
          </View>
          <View style={styles.half}>
            <Button label="Xem quán" onPress={() => open(selected)} />
          </View>
        </View>
      </View>
    ) : undefined;

  return (
    <Screen footer={footer} onRefresh={vendors.refetch} refreshing={vendors.isRefetching}>
      <View style={styles.greeting}>
        <View style={styles.place}>
          <Icon name="map-marker" size={16} color="primary" />
          <AppText variant="labelSm" color="muted">Đà Nẵng · quán có giấy phép vỉa hè</AppText>
        </View>
        <AppText variant="display">{firstName ? `Chào ${firstName}, hôm nay ăn gì?` : 'Hôm nay ăn gì trên phố?'}</AppText>
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Tìm món, quán hoặc tuyến phố"
        onPress={() => goTo('/customer/search')}
        style={({ pressed }) => [styles.search, shadow.card, { backgroundColor: pressed ? colors.sunken : colors.card, borderColor: colors.border }]}
      >
        <Icon name="magnify" size={22} color="muted" />
        <AppText color="muted" style={styles.searchText}>Tìm món, quán hoặc tuyến phố</AppText>
        <View style={[styles.searchAction, { backgroundColor: colors.primary }]}>
          <Icon name="tune-variant" size={18} color="onPrimary" />
        </View>
      </Pressable>

      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.categories}>
          {categories.map((c) => {
            const look = categoryLook(c.name);
            const tone = accentTone(colors, look.tone);
            const on = category === c.name;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.name}
                onPress={() => setCategory(on ? undefined : c.name)}
                style={styles.category}
              >
                <View style={[styles.categoryIcon, { backgroundColor: on ? colors.primary : tone.bg }]}>
                  <Icon name={look.icon} size={26} color={on ? colors.onPrimary : tone.fg} />
                </View>
                <AppText variant="caption" color={on ? 'primary' : 'text'} numberOfLines={1}>{shortName(c.name)}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!category && openNow.length ? (
        <Section title="Đang mở bán" subtitle="Đặt món trước, tới quầy là lấy">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.strip}>
            {openNow.map((v) => (
              <VendorTile key={v.key} item={v} onPress={() => open(v)} />
            ))}
          </ScrollView>
        </Section>
      ) : null}

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: 'Danh sách', icon: 'format-list-bulleted' },
          { value: 'map', label: 'Bản đồ', icon: 'map-outline' },
        ]}
      />

      <QueryView query={vendors} loadingLabel="Đang tải quán quanh đây…">
        {() =>
          mode === 'list' ? (
            <>
              <FilterChips
                options={[
                  { value: 'near', label: 'Gần tôi', icon: 'near-me' },
                  { value: 'open', label: 'Đang mở', icon: 'clock-outline' },
                  { value: 'top', label: 'Đánh giá cao', icon: 'star-outline' },
                ]}
                selected={filters}
                onToggle={toggle}
              />
              {list.length ? (
                list.map((v) => <VendorCard key={v.key} item={v} onPress={() => open(v)} />)
              ) : (
                <EmptyState icon="storefront-outline" title="Không có quán phù hợp" description="Thử bỏ bớt bộ lọc hoặc chọn danh mục khác." />
              )}
            </>
          ) : (
            <VendorMap vendors={list} selectedId={selectedKey} onSelect={setSelectedKey} />
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: spacing.xs },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  search: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.full,
  },
  searchText: { flex: 1 },
  searchAction: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  bleed: { marginHorizontal: -layout.screenMargin, flexGrow: 0 },
  categories: { gap: spacing.md, paddingHorizontal: layout.screenMargin },
  category: { width: 68, alignItems: 'center', gap: 6 },
  categoryIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  strip: { gap: spacing.md, paddingHorizontal: layout.screenMargin, paddingBottom: 4 },
  sheet: { gap: spacing.md },
  sheetTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  sheetBody: { flex: 1, gap: spacing.xs },
  sheetActions: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
