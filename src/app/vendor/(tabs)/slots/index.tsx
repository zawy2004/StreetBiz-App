import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { FilterChips } from '@/components/forms/FilterChips';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { SlotLegend, SlotMap } from '@/features/slots/SlotMap';
import { useApplications, useContracts, useSlotMap } from '@/features/slots/use-rentals';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

const CHEAP_LIMIT = 400000;

const TABS = [
  { value: 'map' as const, label: 'Bản đồ' },
  { value: 'mine' as const, label: 'Của tôi' },
];

export default function SlotsTabScreen() {
  const [tab, setTab] = useState<'map' | 'mine'>('map');
  const header = <SegmentedControl value={tab} onChange={setTab} options={TABS} />;
  return tab === 'map' ? <MapTab header={header} /> : <MineTab header={header} />;
}

/** SIDE-01/02: slots on the vendor's streets, free ones first. */
function MapTab({ header }: { header: React.ReactNode }) {
  const map = useSlotMap();
  const [filters, setFilters] = useState<string[]>(['free']);
  const [zoneName, setZoneName] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();

  const zones = map.data ?? [];
  const zone = zones.find((z) => z.name === zoneName) ?? zones[0];
  const slots = zone?.slots ?? [];
  const hiddenIds = slots
    .filter((s) => (filters.includes('free') && s.status !== 'AVAILABLE') || (filters.includes('cheap') && s.priceMonthly >= CHEAP_LIMIT))
    .map((s) => s.id);
  const freeCount = slots.filter((s) => s.status === 'AVAILABLE').length;
  const selected = slots.find((s) => s.id === selectedId);

  const footer = selected ? (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <AppText variant="title">{selected.code}</AppText>
        <StatusChip code={selected.status} />
      </View>
      <AppText variant="small" color="muted">{selected.street} · {selected.sizeLabel}</AppText>
      <AppText variant="money" color="primary">{selected.priceLabel}</AppText>
      <Button label="Xem ô" onPress={() => goTo(`/vendor/slots/${selected.id}`)} />
    </View>
  ) : undefined;

  return (
    <Screen footer={footer} onRefresh={map.refetch} refreshing={map.isRefetching}>
      {header}
      <QueryView query={map} loadingLabel="Đang tải ô vỉa hè…">
        {() =>
          zone ? (
            <>
              {zones.length > 1 ? (
                <FilterChips
                  options={zones.map((z) => ({ value: z.name, label: `${z.name} (${z.slots.length})`, icon: 'road-variant' as const }))}
                  selected={[zone.name]}
                  onToggle={(v) => {
                    setZoneName(v);
                    setSelectedId(undefined);
                  }}
                />
              ) : null}
              <FilterChips
                options={[
                  { value: 'free', label: `Còn trống (${freeCount})` },
                  { value: 'cheap', label: 'Dưới 400.000 đ/tháng' },
                ]}
                selected={filters}
                onToggle={(v) => setFilters((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]))}
              />
              <SlotMap slots={slots} street={zone.name} selectedId={selectedId} hiddenIds={hiddenIds} onSelect={(s) => setSelectedId(s.id)} />
              <SlotLegend />
            </>
          ) : (
            <EmptyState icon="map-marker-off-outline" title="Chưa có ô nào quanh đây" description="Phường chưa mở ô vỉa hè trên tuyến phố gần địa chỉ của bạn." />
          )
        }
      </QueryView>
    </Screen>
  );
}

/** SIDE-04/05: my contracts and rental applications. */
function MineTab({ header }: { header: React.ReactNode }) {
  const contracts = useContracts();
  const applications = useApplications();

  return (
    <Screen
      onRefresh={() => {
        contracts.refetch();
        applications.refetch();
      }}
    >
      {header}
      <Section title="Hợp đồng">
        <QueryView query={contracts}>
          {(list) =>
            list.length ? (
              list.map((c) => (
                <Card key={c.id} onPress={() => goTo(`/vendor/contracts/${c.id}`)} style={styles.card}>
                  <View style={styles.sheetHead}>
                    <AppText variant="headline">{c.slotCode}</AppText>
                    <StatusChip code={c.status} />
                  </View>
                  <AppText variant="small" color="muted">{c.street} · {formatDate(c.startDate)} - {formatDate(c.endDate)}</AppText>
                </Card>
              ))
            ) : (
              <EmptyState icon="file-document-outline" title="Chưa có hợp đồng" />
            )
          }
        </QueryView>
      </Section>
      <Section title="Đơn thuê">
        <QueryView query={applications}>
          {(list) =>
            list.length ? (
              list.map((a) => (
                <Card key={a.id} onPress={() => goTo(`/vendor/applications/${a.id}`)} style={styles.card}>
                  <View style={styles.sheetHead}>
                    <AppText variant="headline">{a.slotLabel}</AppText>
                    <StatusChip code={a.status} />
                  </View>
                  <AppText variant="small" color="muted">{a.typeLabel} · nộp {formatDate(a.submittedAt)}</AppText>
                </Card>
              ))
            ) : (
              <EmptyState icon="clipboard-text-outline" title="Chưa có đơn thuê" />
            )
          }
        </QueryView>
      </Section>
      <Button label="Đề xuất ô mới" variant="outline" icon="map-marker-plus-outline" onPress={() => goTo('/vendor/slots/propose')} />
      <Button label="Chuyển nhượng" variant="ghost" onPress={() => goTo('/vendor/transfers')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  card: { gap: spacing.xs },
});
