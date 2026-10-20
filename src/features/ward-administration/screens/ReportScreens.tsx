import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { shareProtectedFile } from '@/components/common/ProtectedFile';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
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

/** A heading inside a long screen, with an optional action on the right. */
function Heading({ title, note, action }: { title: string; note?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
        {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.primary }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A white surface. */
function Panel({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <View style={{ padding: 16, gap, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>{children}</View>;
}

/** The on-time rate as a ring: the share paid on time in leaf green, the rest in the track. */
function Ring({ share, size = 112 }: { share: number | null; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.sunken} strokeWidth={stroke} fill="none" />
        {share != null && share > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.leaf} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * share} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </Svg>
      <Text maxFontSizeMultiplier={1.2} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, tabular, { color: colors.ink, paddingHorizontal: 16 }]}>
        {share == null ? '—' : `${Math.round(share * 1000) / 10}`.replace('.', ',') + '%'}
      </Text>
    </View>
  );
}

/**
 * W20 Báo cáo thu (WARD-14), v5 (screens/v5/ward-ops.md): the period's takings in sign figures
 * with the split between fees and fines as a bar, then what is pending, the automatic summary,
 * the on-time rate as a ring, money by month as bars (the latest month lit), receivables by age.
 */
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
  const collected = r ? r.feeCollected + r.penaltyCollected : 0;
  const feeShare = r && collected > 0 ? r.feeCollected / collected : 0;

  return (
    <Screen onRefresh={() => void Promise.all([report.refetch(), performance.refetch(), trend.refetch()])} refreshing={report.isRefetching}>
      <Stack.Screen options={{ title: 'Báo cáo thu' }} />
      <Segments<Preset> value={preset} onChange={setPreset} options={PRESETS} />
      {report.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={200} radius={radius.card} />
          <Skeleton height={80} radius={radius.control} />
        </View>
      ) : report.isError || !r ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          {/* The period's takings: one figure, the fee/fine split as a bar, the invoices behind it */}
          <View accessible accessibilityLabel={`Đã thu trong kỳ ${formatVnd(collected)}: phí ${formatVnd(r.feeCollected)}, phạt ${formatVnd(r.penaltyCollected)}, ${r.invoiceCount} hoá đơn`} style={{ padding: 20, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.muted }}>Đã thu trong kỳ</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: colors.onLeaf }]}>{formatVnd(collected)}</Text>
              <Text style={[text.footnote, tabular, { color: colors.muted }]}>{`${formatVietnamDate(period.from)} – ${formatVietnamDate(period.to)}`}</Text>
            </View>
            <View style={{ height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.sunken }}>
              {collected > 0 ? (
                <>
                  <View style={{ flex: feeShare, backgroundColor: colors.brand }} />
                  <View style={{ flex: 1 - feeShare, backgroundColor: colors.sticker }} />
                </>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              <Legend color={colors.brand} label="Phí" value={formatVnd(r.feeCollected)} />
              <Legend color={colors.sticker} label="Phạt" value={formatVnd(r.penaltyCollected)} />
              <Legend color={colors.line} label="Hoá đơn" value={String(r.invoiceCount)} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tile label="Phí chờ thu" value={r.feePending} wash={colors.card} ink={colors.ink} />
            <Tile label="Phí quá hạn" value={r.feeOverdue} wash={r.feeOverdue ? colors.dangerTint : colors.card} ink={r.feeOverdue ? colors.onDanger : colors.muted} />
            <Tile label="Phạt chưa nộp" value={r.penaltyPending} wash={r.penaltyPending ? colors.mangoTint : colors.card} ink={r.penaltyPending ? colors.onMango : colors.muted} />
          </View>
        </>
      )}
      {summary ? (
        <Panel gap={10}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="text.alignleft" md="summarize" size={16} color={colors.sign} />
            </View>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.sign }}>Tóm tắt tự động</Text>
          </View>
          <Text style={[text.callout, { color: colors.ink, fontFamily: fonts.semibold }]}>{summary.headline}</Text>
          {[...summary.points].sort((a, b) => (a.tone === 'ATTENTION' ? -1 : 0) - (b.tone === 'ATTENTION' ? -1 : 0)).map((p, i) => {
            const t = TONE[p.tone];
            return (
              <View key={`${p.topic}-${i}`} style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: t.wash }}>
                <Icon sf={t.sf} md={t.md} size={17} color={t.ink} />
                <Text style={[text.footnote, { flex: 1, color: t.ink }]}>{p.text}</Text>
              </View>
            );
          })}
          <Text style={[text.caption, { color: colors.muted }]}>{summary.basis}</Text>
        </Panel>
      ) : null}
      {performance.data ? (
        <>
          <Heading title="Nộp phí đúng hạn" />
          <Panel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ring share={performance.data.onTimeRate} />
              <View style={{ flex: 1, gap: 6 }}>
                <Legend color={colors.leaf} label="Đúng hạn" value={String(performance.data.paidOnTimeCount)} />
                <Legend color={colors.sticker} label="Trễ" value={String(performance.data.paidLateCount)} />
                <Legend color={colors.danger} label="Chưa nộp" value={String(performance.data.unpaidCount)} />
                <Text style={[text.caption, tabular, { color: colors.muted }]}>{`${performance.data.dueCount} kỳ đến hạn`}</Text>
              </View>
            </View>
            {performance.data.byZone.length ? (
              <View style={{ gap: 12, marginTop: 4 }}>
                {performance.data.byZone.map((z) => (
                  <View key={z.zoneId} style={{ gap: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={[text.footnote, { flex: 1, fontFamily: fonts.semibold, color: colors.ink }]} numberOfLines={1}>{z.zoneName}</Text>
                      <Text style={[text.footnote, tabular, { fontFamily: fonts.bold, color: z.outstanding ? colors.primary : colors.onLeaf }]}>{formatVnd(z.feeCollected)}</Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.sunken, overflow: 'hidden' }}>
                      <View style={{ width: `${z.slotCount ? Math.round((z.rentedSlots / z.slotCount) * 100) : 0}%`, height: 6, borderRadius: 3, backgroundColor: colors.brand }} />
                    </View>
                    <Text style={[text.caption, tabular, { color: colors.muted }]}>{`${z.rentedSlots}/${z.slotCount} ô đang thuê`}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Panel>
        </>
      ) : null}
      {trend.data && trend.data.length ? (
        <>
          <Heading title="Thu theo tháng" note="6 tháng gần nhất, gồm phí và phạt." />
          <Panel>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 170 }}>
              {trend.data.map((m, i, all) => {
                const total = m.feeCollected + m.penaltyCollected;
                const last = i === all.length - 1;
                return (
                  <View key={`${m.year}-${m.month}`} accessible accessibilityLabel={`Tháng ${m.month}/${m.year}: ${formatVnd(total)}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[{ fontFamily: last ? fonts.heavy : fonts.semibold, fontSize: 11, color: last ? colors.primary : colors.muted }, tabular]}>{total ? formatShortMoney(total) : ''}</Text>
                    <View style={{ width: '72%', height: Math.max(6, (total / max) * 118), borderRadius: radius.plate, backgroundColor: last ? colors.cta : colors.brandTint }} />
                    <Text style={[{ fontFamily: last ? fonts.heavy : fonts.medium, fontSize: 12, color: last ? colors.ink : colors.muted }, tabular]}>{`T${m.month}`}</Text>
                  </View>
                );
              })}
            </View>
          </Panel>
        </>
      ) : null}
      <ReceivablesBlock />
      {r && r.recentViolations.length ? (
        <>
          <Heading title="Vi phạm gần đây" action={{ label: 'Tất cả', onPress: () => router.push('/ward/patrol/violations' as Href) }} />
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
            {r.recentViolations.slice(0, 6).map((v, i) => (
              <Pressable key={v.violationId} onPress={() => v.violationId && router.push(`/ward/patrol/violations/${v.violationId}` as Href)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 72, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator, backgroundColor: pressed ? colors.pressed : colors.card })}>
                {v.slotCode ? <Plate code={v.slotCode} /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }} numberOfLines={1}>{v.vendorName ?? 'Hộ kinh doanh'}</Text>
                  <Text style={[text.footnote, { color: colors.onDanger }]}>{v.violationLabel}</Text>
                  <Text style={[text.caption, tabular, { color: colors.muted }]}>{[formatVietnamDateTime(v.recordedAt), v.penaltyAmount != null ? formatVnd(v.penaltyAmount) : null].filter(Boolean).join(', ')}</Text>
                </View>
                <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <Button label="Xuất Excel" variant="secondary" icon={{ sf: 'tablecells', md: 'table_view' }} loading={exporting} onPress={() => void exportXlsx()} />
    </Screen>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={[text.footnote, tabular, { color: colors.ink }]}>
        {label} <Text style={{ fontFamily: fonts.bold }}>{value}</Text>
      </Text>
    </View>
  );
}

function Tile({ label, value, wash, ink }: { label: string; value: number; wash: string; ink: string }) {
  return (
    <View style={{ flex: 1, padding: 12, gap: 4, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: wash, boxShadow: wash === colors.card ? shadow.card : undefined }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: ink }} numberOfLines={2}>{label}</Text>
      <Text style={[sign.price, tabular, { color: ink }]} adjustsFontSizeToFit numberOfLines={1} maxFontSizeMultiplier={1.4}>{formatVnd(value)}</Text>
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
  const top = Math.max(1, ...d.aging.map((b) => b.amount));
  return (
    <>
      <Heading title="Công nợ" />
      <Panel>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted }}>Quá hạn</Text>
            <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, tabular, { color: d.overdueAmount > 0 ? colors.onDanger : colors.onLeaf }]}>{formatVnd(d.overdueAmount)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted }}>30 ngày tới</Text>
            <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, tabular, { color: colors.ink }]}>{formatVnd(d.dueNext30Amount)}</Text>
            <Text style={[text.caption, tabular, { color: colors.muted }]}>{`${d.dueNext30Count} kỳ`}</Text>
          </View>
        </View>
        {d.aging.map((b) => (
          <View key={b.key} style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={[text.footnote, tabular, { flex: 1, color: colors.ink }]}>{`${b.label}, ${b.households} hộ`}</Text>
              <Text style={[text.footnote, tabular, { fontFamily: fonts.bold, color: b.amount ? colors.onDanger : colors.muted }]}>{formatVnd(b.amount)}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.sunken, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round((b.amount / top) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.danger }} />
            </View>
          </View>
        ))}
        {owed.length ? (
          <View style={{ gap: 10 }}>
            <Banner tone="warning" title={`${owed.length} khoản cần hoàn cho hộ (nộp trùng)`}>Hoàn tiền xong thì đánh dấu để sổ khớp.</Banner>
            {owed.map((x) => (
              <View key={x.transactionId} style={{ gap: 8, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.sunken }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {x.slotCode ? <Plate code={x.slotCode} /> : null}
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }} numberOfLines={2}>{x.vendorName}</Text>
                </View>
                <Text style={[text.footnote, { color: colors.ink }]}>{x.label}</Text>
                <Text style={[text.caption, tabular, { color: colors.muted }]}>{`${formatVnd(x.amount)} qua ${x.provider}${x.providerReference ? `, mã ${x.providerReference}` : ''}`}</Text>
                <Button
                  label="Đã hoàn tiền"
                  variant="sign"
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
      </Panel>
    </>
  );
}

/**
 * W21 Hộ còn nợ phí, v5: how many households owe and how much, in sign figures (summed from the
 * list), then each household most overdue first — plate, the overdue sum large, the days late —
 * with Gọi and Nhắc nợ in thumb reach. One in-app reminder per household per day.
 */
export function WardDebtorsScreen() {
  const debtors = useWardDebtors();
  const remind = useRemindDebtor();
  const today = new Date().toDateString();
  const total = (debtors.data ?? []).reduce((n, d) => n + d.overdueAmount, 0);
  return (
    <Screen onRefresh={() => void debtors.refetch()} refreshing={debtors.isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Hộ còn nợ phí' }} />
      {debtors.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={120} radius={radius.card} />
          <ListSkeleton rows={3} height={170} />
        </View>
      ) : debtors.isError ? (
        <ErrorState error={debtors.error} onRetry={() => void debtors.refetch()} />
      ) : debtors.data.length === 0 ? (
        <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} title="Không có hộ nợ quá hạn" body="Mọi kỳ phí đến hạn đã được nộp." />
      ) : (
        <>
          <View accessible accessibilityLabel={`${debtors.data.length} hộ nợ quá hạn, tổng ${formatVnd(total)}`} style={{ flexDirection: 'row', gap: 16, padding: 20, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <View style={{ gap: 2 }}>
              <Text maxFontSizeMultiplier={1.3} style={[sign.figure, tabular, { color: colors.onDanger }]}>{debtors.data.length}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>hộ quá hạn</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: colors.ink }]}>{formatShortMoney(total)}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>{`tổng nợ quá hạn (${formatVnd(total)})`}</Text>
            </View>
          </View>
          {debtors.data.map((d) => {
            const remindedToday = d.lastRemindedAt ? new Date(d.lastRemindedAt).toDateString() === today : false;
            return (
              <View key={d.contractId} style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Plate code={d.slotCode} />
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }} numberOfLines={2}>{d.businessName ?? d.vendorName}</Text>
                  <StatusPill label={`Quá hạn ${d.daysOverdue} ngày`} tone="danger" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 8 }}>
                  <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: colors.onDanger }]}>{formatVnd(d.overdueAmount)}</Text>
                  <Text style={[{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 30, color: colors.onDanger }, tabular]}>{`${d.overdueCount} kỳ`}</Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={[text.footnote, { color: colors.muted }]}>{d.zoneName}</Text>
                  <Text style={[text.footnote, tabular, { color: colors.muted }]}>{`Kỳ cũ nhất ${formatVietnamDate(d.oldestDueDate)}${d.upcomingAmount ? `, sắp tới ${formatVnd(d.upcomingAmount)}` : ''}`}</Text>
                  {d.lastRemindedAt ? <Text style={[text.footnote, { color: colors.sign }]}>Đã nhắc {formatVietnamDateTime(d.lastRemindedAt)}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {d.vendorPhone ? <Button label="Gọi" variant="secondary" icon={{ sf: 'phone.fill', md: 'call' }} onPress={() => void Linking.openURL(`tel:${d.vendorPhone}`)} style={{ flex: 1 }} /> : null}
                  <Button
                    label={remindedToday ? 'Đã nhắc hôm nay' : 'Nhắc nợ'}
                    variant="sign"
                    icon={{ sf: 'bell.badge.fill', md: 'notifications_active' }}
                    disabled={remindedToday}
                    loading={remind.isPending && remind.variables === d.contractId}
                    onPress={() => remind.mutate(d.contractId, { onSuccess: () => showToast('Đã gửi nhắc nợ trong ứng dụng'), onError: (e) => showToast(errorMessage(e), 'error') })}
                    style={{ flex: 1.4 }}
                  />
                </View>
                <Pressable onPress={() => router.push(`/ward/more/finance/${d.contractId}` as Href)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' }}>
                  <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: colors.primary }}>Mở lịch phí của hộ</Text>
                  <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
