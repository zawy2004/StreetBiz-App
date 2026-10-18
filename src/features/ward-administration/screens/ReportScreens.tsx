import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Card, KeyValueList, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { shareProtectedFile } from '@/components/common/ProtectedFile';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatShortMoney, formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { useCollectionPerformance, useCollectionReport, useCollectionTrend, useMarkRefunded, useReceivables, useRemindDebtor, useReportSummary, useWardDebtors, useWardRefunds, type ReportPeriod } from '../useWardReports';

type Preset = 'thisMonth' | 'lastMonth' | 'd30' | 'year';
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
  { key: 'd30', label: '30 ngày' },
  { key: 'year', label: 'Năm nay' },
];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodOf(p: Preset): ReportPeriod {
  const now = new Date();
  if (p === 'thisMonth') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
  if (p === 'lastMonth') return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
  if (p === 'd30') {
    const f = new Date(now);
    f.setDate(f.getDate() - 30);
    return { from: ymd(f), to: ymd(now) };
  }
  return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(now) };
}
const TONE = {
  ATTENTION: { wash: colors.mangoTint, ink: colors.onMango, sf: 'exclamationmark.circle.fill', md: 'error', label: 'Cần chú ý' },
  NEUTRAL: { wash: colors.sunken, ink: colors.ink, sf: 'info.circle.fill', md: 'info', label: 'Ghi nhận' },
  POSITIVE: { wash: colors.leafTint, ink: colors.onLeaf, sf: 'checkmark.circle.fill', md: 'check_circle', label: 'Tốt' },
} as const;

/** W20 Báo cáo thu (WARD-14): totals for a period, the automatic summary, on-time rate, months, zones, receivables. */
export function CollectionReportScreen() {
  const [preset, setPreset] = useState<Preset>('thisMonth');
  const period = useMemo(() => periodOf(preset), [preset]);
  const report = useCollectionReport(period);
  const { summary } = useReportSummary(period);
  const performance = useCollectionPerformance(period);
  const trend = useCollectionTrend(6);
  const [exporting, setExporting] = useState(false);
  const r = report.data;
  const max = Math.max(1, ...(trend.data ?? []).map((m) => m.feeCollected + m.penaltyCollected));
  const exportXlsx = async () => {
    setExporting(true);
    await shareProtectedFile(`/ward/reports/collection/export?from=${period.from}&to=${period.to}`, `bao-cao-thu-phi_${period.from.replace(/-/g, '')}-${period.to.replace(/-/g, '')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setExporting(false);
  };

  return (
    <Screen onRefresh={() => void Promise.all([report.refetch(), performance.refetch(), trend.refetch()])} refreshing={report.isRefetching}>
      <Stack.Screen options={{ title: 'Báo cáo thu' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {PRESETS.map((p) => (
          <Chip key={p.key} label={p.label} selected={preset === p.key} onPress={() => setPreset(p.key)} accessibilityRole="radio" />
        ))}
      </ScrollView>
      <Text style={[text.caption, { color: colors.muted }]}>{formatVietnamDate(period.from)} – {formatVietnamDate(period.to)}</Text>
      {report.isPending ? (
        <ListSkeleton rows={2} height={120} />
      ) : report.isError || !r ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <View style={{ padding: 18, gap: 4, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.onLeaf }}>Đã thu trong kỳ</Text>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 30, color: colors.onLeaf }, tabular]} adjustsFontSizeToFit numberOfLines={1}>{formatVnd(r.feeCollected + r.penaltyCollected)}</Text>
            <Text style={[text.footnote, { color: colors.onLeaf }]}>Phí {formatVnd(r.feeCollected)} · Phạt {formatVnd(r.penaltyCollected)} · {r.invoiceCount} hoá đơn</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tile label="Phí chờ thu" value={r.feePending} wash={colors.sunken} ink={colors.ink} />
            <Tile label="Phí quá hạn" value={r.feeOverdue} wash={r.feeOverdue ? colors.dangerTint : colors.sunken} ink={r.feeOverdue ? colors.onDanger : colors.muted} />
            <Tile label="Phạt chưa nộp" value={r.penaltyPending} wash={r.penaltyPending ? colors.mangoTint : colors.sunken} ink={r.penaltyPending ? colors.onMango : colors.muted} />
          </View>
        </>
      )}
      {summary ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon sf="text.alignleft" md="summarize" size={16} color={colors.sign} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.sign }}>Tóm tắt tự động</Text>
          </View>
          <Text style={[text.callout, { color: colors.ink, fontFamily: fonts.semibold }]}>{summary.headline}</Text>
          {[...summary.points].sort((a, b) => (a.tone === 'ATTENTION' ? -1 : 0) - (b.tone === 'ATTENTION' ? -1 : 0)).map((p, i) => {
            const t = TONE[p.tone];
            return (
              <View key={`${p.topic}-${i}`} style={{ flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, backgroundColor: t.wash }}>
                <Icon sf={t.sf} md={t.md} size={16} color={t.ink} />
                <Text style={[text.footnote, { flex: 1, color: t.ink }]}>{p.text}</Text>
              </View>
            );
          })}
          <Text style={[text.caption, { color: colors.muted }]}>{summary.basis}</Text>
        </Card>
      ) : null}
      {performance.data ? (
        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Nộp phí đúng hạn</Text>
          <Text style={[{ fontFamily: fonts.code, fontSize: 32, color: colors.primary }, tabular]}>{performance.data.onTimeRate == null ? '—' : `${Math.round(performance.data.onTimeRate * 1000) / 10}`.replace('.', ',') + '%'}</Text>
          <Text style={[text.footnote, { color: colors.muted }, tabular]}>{performance.data.paidOnTimeCount} đúng hạn · {performance.data.paidLateCount} trễ · {performance.data.unpaidCount} chưa nộp / {performance.data.dueCount} kỳ đến hạn</Text>
          {performance.data.byZone.length ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              {performance.data.byZone.map((z) => (
                <View key={z.zoneId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[text.footnote, { flex: 1, color: colors.ink }]} numberOfLines={1}>{z.zoneName} · {z.rentedSlots}/{z.slotCount} ô</Text>
                  <Text style={[text.footnote, { color: z.outstanding ? colors.primary : colors.onLeaf }, tabular]}>{formatVnd(z.feeCollected)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}
      {trend.data && trend.data.length ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Thu theo tháng</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150 }}>
            {trend.data.map((m) => {
              const total = m.feeCollected + m.penaltyCollected;
              return (
                <View key={`${m.year}-${m.month}`} accessible accessibilityLabel={`Tháng ${m.month}/${m.year}: ${formatVnd(total)}`} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Text style={[{ fontFamily: fonts.semibold, fontSize: 9.5, color: colors.muted }, tabular]}>{total ? formatShortMoney(total) : ''}</Text>
                  <View style={{ width: '70%', height: Math.max(4, (total / max) * 100), borderRadius: 6, backgroundColor: colors.brand }} />
                  <Text style={[{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.muted }, tabular]}>T{m.month}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
      <ReceivablesBlock />
      {r && r.recentViolations.length ? (
        <>
          <SectionHeader title="Vi phạm gần đây" action={{ label: 'Tất cả', onPress: () => router.push('/ward/patrol/violations' as Href) }} />
          {r.recentViolations.slice(0, 6).map((v) => (
            <Pressable key={v.violationId} onPress={() => v.violationId && router.push(`/ward/patrol/violations/${v.violationId}` as Href)} style={{ padding: 12, gap: 4, borderRadius: radius.card, backgroundColor: colors.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {v.slotCode ? <SlotPlate code={v.slotCode} /> : null}
                <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>{v.vendorName ?? 'Hộ kinh doanh'}</Text>
              </View>
              <Text style={[text.footnote, { color: colors.ink }]}>{v.violationLabel}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{formatVietnamDateTime(v.recordedAt)}{v.penaltyAmount != null ? ` · ${formatVnd(v.penaltyAmount)}` : ''}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
      <Button label="Xuất Excel" variant="secondary" icon={{ sf: 'tablecells', md: 'table_view' }} loading={exporting} onPress={() => void exportXlsx()} />
    </Screen>
  );
}

function Tile({ label, value, wash, ink }: { label: string; value: number; wash: string; ink: string }) {
  return (
    <View style={{ flex: 1, padding: 12, gap: 2, borderRadius: 16, borderCurve: 'continuous', backgroundColor: wash }}>
      <Text style={[text.caption, { color: ink }]} numberOfLines={1}>{label}</Text>
      <Text style={[{ fontFamily: fonts.heavy, fontSize: 14.5, color: ink }, tabular]} adjustsFontSizeToFit numberOfLines={1}>{formatVnd(value)}</Text>
    </View>
  );
}

/** Overdue fees by age, what falls due next, and payments owed back to vendors (paid twice). */
function ReceivablesBlock() {
  const rec = useReceivables();
  const refunds = useWardRefunds();
  const mark = useMarkRefunded();
  if (!rec.data) return null;
  const d = rec.data;
  const owed = (refunds.data ?? []).filter((x) => x.status === 'REFUND_REQUIRED');
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Công nợ</Text>
      <KeyValueList rows={[{ label: 'Quá hạn', value: formatVnd(d.overdueAmount), emphasis: d.overdueAmount > 0 }, { label: '30 ngày tới', value: `${d.dueNext30Count} kỳ · ${formatVnd(d.dueNext30Amount)}` }]} />
      {d.aging.map((b) => (
        <View key={b.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[text.footnote, { color: colors.ink }]}>{b.label} · {b.households} hộ</Text>
          <Text style={[text.footnote, { color: b.amount ? colors.onDanger : colors.muted }, tabular]}>{formatVnd(b.amount)}</Text>
        </View>
      ))}
      {owed.length ? (
        <View style={{ gap: 8 }}>
          <Banner tone="warning" title={`${owed.length} khoản cần hoàn cho hộ (nộp trùng)`}>Hoàn tiền xong thì đánh dấu để sổ khớp.</Banner>
          {owed.map((x) => (
            <View key={x.transactionId} style={{ gap: 6, padding: 10, borderRadius: 12, backgroundColor: colors.sunken }}>
              <Text style={[text.footnote, { color: colors.ink }]}>{x.vendorName}{x.slotCode ? ` · ô ${x.slotCode}` : ''} · {x.label}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{formatVnd(x.amount)} qua {x.provider}{x.providerReference ? ` · ${x.providerReference}` : ''}</Text>
              <Button
                label="Đã hoàn tiền"
                variant="secondary"
                loading={mark.isPending && mark.variables === x.transactionId}
                onPress={() =>
                  Alert.alert('Đánh dấu đã hoàn?', `${formatVnd(x.amount)} cho ${x.vendorName}.`, [
                    { text: 'Quay lại', style: 'cancel' },
                    { text: 'Đã hoàn', onPress: () => mark.mutate(x.transactionId, { onError: (e) => showToast(errorMessage(e), 'error') }) },
                  ])
                }
              />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** W21 Hộ còn nợ phí: most overdue first; one in-app reminder per household per day. */
export function WardDebtorsScreen() {
  const debtors = useWardDebtors();
  const remind = useRemindDebtor();
  const today = new Date().toDateString();
  return (
    <Screen onRefresh={() => void debtors.refetch()} refreshing={debtors.isRefetching} gap={10}>
      <Stack.Screen options={{ title: 'Hộ còn nợ phí' }} />
      {debtors.isPending ? (
        <ListSkeleton rows={4} height={110} />
      ) : debtors.isError ? (
        <ErrorState error={debtors.error} onRetry={() => void debtors.refetch()} />
      ) : debtors.data.length === 0 ? (
        <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} title="Không có hộ nợ quá hạn" body="Mọi kỳ phí đến hạn đã được nộp." />
      ) : (
        debtors.data.map((d) => {
          const remindedToday = d.lastRemindedAt ? new Date(d.lastRemindedAt).toDateString() === today : false;
          return (
            <Card key={d.contractId} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SlotPlate code={d.slotCode} />
                <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>{d.businessName ?? d.vendorName}</Text>
                <StatusPill label={`Quá hạn ${d.daysOverdue} ngày`} tone="danger" />
              </View>
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 17, color: colors.onDanger }, tabular]}>{formatVnd(d.overdueAmount)} · {d.overdueCount} kỳ</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{d.zoneName} · kỳ cũ nhất {formatVietnamDate(d.oldestDueDate)}{d.upcomingAmount ? ` · sắp tới ${formatVnd(d.upcomingAmount)}` : ''}</Text>
              {d.lastRemindedAt ? <Text style={[text.caption, { color: colors.sign }]}>Đã nhắc {formatVietnamDateTime(d.lastRemindedAt)}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {d.vendorPhone ? <Button label="Gọi" variant="secondary" icon={{ sf: 'phone.fill', md: 'call' }} onPress={() => void Linking.openURL(`tel:${d.vendorPhone}`)} style={{ flex: 1 }} /> : null}
                <Button
                  label={remindedToday ? 'Đã nhắc hôm nay' : 'Nhắc nợ'}
                  icon={{ sf: 'bell.badge.fill', md: 'notifications_active' }}
                  disabled={remindedToday}
                  loading={remind.isPending && remind.variables === d.contractId}
                  onPress={() => remind.mutate(d.contractId, { onSuccess: () => showToast('Đã gửi nhắc nợ trong ứng dụng'), onError: (e) => showToast(errorMessage(e), 'error') })}
                  style={{ flex: 1.4 }}
                />
              </View>
              <Pressable onPress={() => router.push(`/ward/more/finance/${d.contractId}` as Href)} hitSlop={6}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>Mở lịch phí của hộ</Text>
              </Pressable>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
