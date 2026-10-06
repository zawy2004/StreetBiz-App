import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { FilterChips } from '@/components/forms/FilterChips';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { SlotLegend, SlotMap } from '@/features/slots/SlotMap';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { formatDate } from '@/utils/format';
import { spacing } from '@/theme';

const CHEAP_LIMIT = 400000;

export default function SlotsTabScreen() {
  const [tab, setTab] = useState<'map' | 'mine'>('map');
  return tab === 'map' ? (
    <MapTab header={<SegmentedControl value={tab} onChange={setTab} options={TABS} />} />
  ) : (
    <MineTab header={<SegmentedControl value={tab} onChange={setTab} options={TABS} />} />
  );
}

const TABS = [
  { value: 'map' as const, label: 'Bản đồ' },
  { value: 'mine' as const, label: 'Của tôi' },
];

function MapTab({ header }: { header: React.ReactNode }) {
  const allSlots = useMockDb((s) => s.slots);
  const slots = useMemo(
    () => allSlots.filter((s) => !s.proposal_review_status || s.proposal_review_status === 'APPROVED'),
    [allSlots],
  );
  const [filters, setFilters] = useState<string[]>(['free']);
  const [selectedId, setSelectedId] = useState<string>();

  const hiddenIds = slots
    .filter((s) => (filters.includes('free') && s.slot_status !== 'AVAILABLE') || (filters.includes('cheap') && s.price_monthly >= CHEAP_LIMIT))
    .map((s) => s.id);
  const freeCount = slots.filter((s) => s.slot_status === 'AVAILABLE').length;
  const selected = slots.find((s) => s.id === selectedId);
  const street = slots[0]?.street ?? '';

  const footer = selected ? (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <AppText variant="title">{selected.slot_code}</AppText>
        <StatusChip code={selected.slot_status} />
      </View>
      <AppText variant="small" color="muted">{selected.street} · {selected.size_m2} m²</AppText>
      <View style={styles.sheetPrice}>
        <Money amountVnd={selected.price_monthly} />
        <AppText variant="small" color="muted">/tháng</AppText>
      </View>
      <Button label="Xem ô" onPress={() => goTo(`/vendor/slots/${selected.id}`)} />
    </View>
  ) : undefined;

  return (
    <Screen footer={footer}>
      {header}
      <FilterChips
        options={[
          { value: 'free', label: `Còn trống (${freeCount})` },
          { value: 'cheap', label: 'Dưới 400.000 đ' },
        ]}
        selected={filters}
        onToggle={(v) => setFilters((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]))}
      />
      {slots.length ? (
        <>
          <SlotMap slots={slots} street={street} selectedId={selectedId} hiddenIds={hiddenIds} onSelect={(s) => setSelectedId(s.id)} />
          <SlotLegend />
        </>
      ) : (
        <EmptyState title="Chưa có ô nào" />
      )}
    </Screen>
  );
}

function MineTab({ header }: { header: React.ReactNode }) {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const contracts = useMockDb((s) => s.contracts).filter((c) => c.vendorId === vendorId);
  const applications = useMockDb((s) => s.applications).filter((a) => a.vendorId === vendorId);
  const slots = useMockDb((s) => s.slots);
  const slotOf = (id: string) => slots.find((s) => s.id === id);

  return (
    <Screen>
      {header}
      <Section title="Hợp đồng">
        {contracts.length ? (
          contracts.map((c) => (
            <Card key={c.id} onPress={() => goTo(`/vendor/contracts/${c.id}`)} style={styles.card}>
              <View style={styles.sheetHead}>
                <AppText variant="headline">{slotOf(c.slotId)?.slot_code}</AppText>
                <StatusChip code={c.contract_status} />
              </View>
              <AppText variant="small" color="muted">{formatDate(c.start_date)} - {formatDate(c.end_date)}</AppText>
            </Card>
          ))
        ) : (
          <EmptyState icon="file-document-outline" title="Chưa có hợp đồng" />
        )}
      </Section>
      <Section title="Đơn thuê">
        {applications.length ? (
          applications.map((a) => (
            <Card key={a.id} onPress={() => goTo(`/vendor/applications/${a.id}`)} style={styles.card}>
              <View style={styles.sheetHead}>
                <AppText variant="headline">{a.slotIds.map((id) => slotOf(id)?.slot_code).join(', ')}</AppText>
                <StatusChip code={a.application_status} />
              </View>
              <AppText variant="small" color="muted">Nộp {formatDate(a.submitted_at)}</AppText>
            </Card>
          ))
        ) : (
          <EmptyState icon="clipboard-text-outline" title="Chưa có đơn thuê" />
        )}
      </Section>
      <Button label="Đề xuất ô mới" variant="outline" icon="map-marker-plus-outline" onPress={() => goTo('/vendor/slots/propose')} />
      <Button label="Chuyển nhượng" variant="ghost" onPress={() => goTo('/vendor/transfers')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetPrice: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  card: { gap: spacing.xs },
});
