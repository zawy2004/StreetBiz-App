import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, KeyValueList, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { SlotPlate } from '@/components/common/SlotPlate';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { ContractFinanceCard, InvoiceRow } from '../components/FinanceParts';
import { groupByMonth, ledgerTotals, paymentStats, PROVIDER_LABEL, PURPOSE_LABEL, SOURCE_LABEL } from '../finance-view';
import { invoiceKind, type InvoiceKindFilter } from '../invoice-groups';
import { dueBadge, formatDay, isOwed } from '../schedule-progress';
import { useContractSchedule } from '../useFeeSchedules';
import { useInvoiceDetail, useInvoices, usePaymentHistory, useVendorViolations } from '../useFinance';

const go = (href: string) => router.push(href as Href);

/** V28 Hoá đơn (FEE-03): every invoice by month, fees and fines filterable, with the year's totals. */
export function InvoicesListScreen() {
  const { invoices, isLoading, isError, error, refetch, isRefetching } = useInvoices();
  const [kind, setKind] = useState<InvoiceKindFilter>('ALL');
  const shown = kind === 'ALL' ? invoices : invoices.filter((i) => invoiceKind(i) === kind);
  const totals = ledgerTotals(invoices);
  const months = groupByMonth(shown, (i) => i.issuedAt);
  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Hoá đơn' }} />
      {isLoading ? (
        <ListSkeleton rows={4} height={72} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : invoices.length === 0 ? (
        <StateView icon={{ sf: 'doc.text', md: 'receipt_long' }} tone="neutral" title="Chưa có hoá đơn" body="Hoá đơn được xuất sau khi ví xác nhận thanh toán." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Total label="Tổng đã nộp" value={formatVnd(totals.total)} />
            <Total label="Phí thuê ô" value={formatVnd(totals.fee)} />
            <Total label="Tiền phạt" value={formatVnd(totals.penalty)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                ['ALL', 'Tất cả'],
                ['FEE', 'Phí thuê ô'],
                ['PENALTY', 'Tiền phạt'],
              ] as const
            ).map(([k, l]) => (
              <Chip key={k} label={l} selected={kind === k} onPress={() => setKind(k)} accessibilityRole="radio" />
            ))}
          </View>
          {months.map((m) => (
            <View key={m.key} style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted, marginTop: 4 }}>{m.label.toUpperCase()}</Text>
              {m.items.map((inv) => (
                <InvoiceRow key={inv.invoiceId} invoice={inv} onPress={() => go(`/vendor/finance/invoices/${inv.invoiceId}`)} />
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 12, gap: 2, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.card }}>
      <Text style={[text.caption, { color: colors.muted }]} numberOfLines={1}>{label}</Text>
      <Text style={[{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.ink }, tabular]} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** V29 Chi tiết hoá đơn: the receipt the ward issued, and its PDF to keep or send. */
export function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = Number(id);
  const { invoice, isLoading, isError, error, refetch } = useInvoiceDetail(invoiceId);
  const [downloading, setDownloading] = useState(false);
  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hoá đơn' }} />
        <ListSkeleton rows={1} height={320} />
      </Screen>
    );
  }
  if (isError || !invoice) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hoá đơn' }} />
        <ErrorState error={error ?? new Error('Không tìm thấy hoá đơn.')} onRetry={() => void refetch()} />
      </Screen>
    );
  }
  const penalty = invoice.kind === 'PENALTY';
  const download = async () => {
    setDownloading(true);
    await shareProtectedFile(`/vendor/finance/invoices/${invoiceId}/pdf`, `${invoice.invoiceNumber}.pdf`, 'application/pdf');
    setDownloading(false);
  };
  return (
    <Screen footer={<Button label="Tải hoá đơn (PDF)" size={56} icon={{ sf: 'square.and.arrow.down', md: 'download' }} loading={downloading} onPress={() => void download()} />}>
      <Stack.Screen options={{ title: invoice.invoiceNumber }} />
      <View style={{ borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
        <View style={{ padding: 20, gap: 6, alignItems: 'center', backgroundColor: penalty ? colors.dangerTint : colors.signTint }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: penalty ? colors.onDanger : colors.sign }}>{penalty ? 'BIÊN LAI THU TIỀN PHẠT' : 'BIÊN LAI THU PHÍ THUÊ Ô'}</Text>
          <Text style={{ fontFamily: fonts.code, fontSize: 18, color: colors.ink }}>{invoice.invoiceNumber}</Text>
          <Text style={[{ fontFamily: fonts.heavy, fontSize: 32, lineHeight: 38, color: colors.ink }, tabular]}>{formatVnd(invoice.amount)}</Text>
          {invoice.amountInWords ? <Text style={[text.footnote, { color: colors.ink, textAlign: 'center' }]}>Bằng chữ: {invoice.amountInWords}</Text> : null}
          <Text style={[text.caption, { color: colors.muted }]}>Xuất ngày {formatVietnamDate(invoice.issuedAt)}</Text>
          {invoice.paidAt ? (
            <View style={{ marginTop: 6, transform: [{ rotate: '-6deg' }], borderWidth: 3, borderColor: colors.leaf, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontFamily: fonts.code, fontSize: 15, color: colors.leaf }}>ĐÃ THANH TOÁN</Text>
            </View>
          ) : null}
        </View>
        <View style={{ height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.line }} />
        <View style={{ padding: 16 }}>
          <KeyValueList
            rows={[
              invoice.wardName ? { label: 'Đơn vị thu', value: `UBND ${invoice.wardName}` } : null,
              invoice.payerName ? { label: 'Người nộp', value: invoice.payerName } : null,
              invoice.businessName ? { label: 'Hộ kinh doanh', value: invoice.businessName } : null,
              { label: penalty ? 'Biên bản phạt' : 'Khoản phí', value: (penalty ? invoice.violationLabel : invoice.periodLabel) ?? '—' },
              invoice.slotCode ? { label: 'Ô', value: <SlotPlate code={invoice.slotCode} /> } : null,
              penalty && invoice.decisionNumber ? { label: 'Quyết định xử phạt', value: invoice.decisionNumber } : null,
              invoice.paymentProvider ? { label: 'Thanh toán qua', value: PROVIDER_LABEL[invoice.paymentProvider] ?? invoice.paymentProvider } : null,
              invoice.providerReference ? { label: 'Mã giao dịch', value: invoice.providerReference, mono: true } : null,
              invoice.paidAt ? { label: 'Thanh toán lúc', value: formatVietnamDateTime(invoice.paidAt) } : null,
            ]}
          />
        </View>
      </View>
    </Screen>
  );
}

/** V30 Lịch sử thanh toán (FEE-05): every attempt, its outcome, and the month's paid total. */
export function PaymentHistoryScreen() {
  const { payments, isLoading, isError, error, refetch, isRefetching } = usePaymentHistory();
  const stats = paymentStats(payments);
  const months = groupByMonth(payments, (p) => p.createdAt);
  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Lịch sử thanh toán' }} />
      {isLoading ? (
        <ListSkeleton rows={4} height={64} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : payments.length === 0 ? (
        <StateView icon={{ sf: 'clock.arrow.circlepath', md: 'history' }} tone="neutral" title="Chưa có giao dịch" body="Các lần thanh toán phí và tiền phạt hiện ở đây." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Total label="Đã thanh toán" value={formatVnd(stats.successTotal)} />
            <Total label="Thành công" value={String(stats.success)} />
            <Total label="Thất bại / chờ" value={`${stats.failed} / ${stats.pending}`} />
          </View>
          {months.map((m) => (
            <View key={m.key} style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted, marginTop: 4 }}>{m.label.toUpperCase()}</Text>
              <Card padded={false}>
                {m.items.map((p, i) => {
                  const s = statusLabel(p.transactionStatus);
                  return (
                    <View key={p.transactionId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderColor: colors.separator }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: p.purpose === 'PENALTY' ? colors.dangerTint : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon sf={p.purpose === 'PENALTY' ? 'exclamationmark.octagon.fill' : 'calendar'} md={p.purpose === 'PENALTY' ? 'report' : 'calendar_month'} size={17} color={p.purpose === 'PENALTY' ? colors.danger : colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={1}>{p.referenceLabel || PURPOSE_LABEL[p.purpose] || p.purpose}</Text>
                        <Text style={[text.caption, { color: colors.muted }]} numberOfLines={1}>
                          {[PROVIDER_LABEL[p.provider] ?? p.provider, p.slotCode ? `Ô ${p.slotCode}` : null, formatVietnamDateTime(p.createdAt)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={[{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }, tabular]}>{formatVnd(p.amount)}</Text>
                        <StatusPill label={s.label} tone={s.tone} />
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

/** V31 Lịch sử vi phạm: what was recorded, by whom (on site or a resident's report), the fine and its state. */
export function VendorViolationsScreen() {
  const { violations, isLoading, isError, error, refetch, isRefetching } = useVendorViolations();
  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Lịch sử vi phạm' }} />
      {isLoading ? (
        <ListSkeleton rows={3} height={110} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : violations.length === 0 ? (
        <StateView icon={{ sf: 'checkmark.seal.fill', md: 'verified' }} title="Chưa có vi phạm nào" body="Giữ đúng vị trí, giờ bán và vệ sinh để hồ sơ luôn sạch." />
      ) : (
        violations.map((v) => {
          const s = v.penaltyStatus ? statusLabel(v.penaltyStatus) : null;
          return (
            <Card key={v.violationId} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {v.slotCode ? <SlotPlate code={v.slotCode} /> : null}
                <Text style={[text.caption, { color: colors.muted }]}>{SOURCE_LABEL[v.source] ?? v.source} · {formatVietnamDateTime(v.recordedAt)}</Text>
              </View>
              <Text style={[text.headline, { color: colors.ink }]}>{v.violationLabel}</Text>
              {v.description ? <Text style={[text.footnote, { color: colors.ink }]}>{v.description}</Text> : null}
              {v.evidenceUrl ? (
                <View style={{ flexDirection: 'row' }}>
                  <ProtectedFileTile fileUrl={v.evidenceUrl} label="Ảnh hiện trường" />
                </View>
              ) : null}
              {v.penaltyAmount != null || s ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderColor: colors.separator }}>
                  <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }, tabular]}>{v.penaltyAmount != null ? formatVnd(v.penaltyAmount) : 'Không phạt tiền'}</Text>
                  {s ? <StatusPill label={s.label} tone={s.tone} /> : null}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

/** V38 Lịch đóng phí của một hợp đồng: every instalment in order, what is paid, what is next, what is late. */
export function ContractScheduleScreen() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const { schedule, isLoading, isError, error, refetch } = useContractSchedule(Number(contractId));
  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Lịch phí' }} />
        <ListSkeleton rows={4} height={64} />
      </Screen>
    );
  }
  if (isError || !schedule) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Lịch phí' }} />
        <ErrorState error={error ?? new Error('Không tìm thấy hợp đồng thuê.')} onRetry={() => void refetch()} />
      </Screen>
    );
  }
  const { contract, items } = schedule;
  return (
    <Screen onRefresh={() => void refetch()} gap={12}>
      <Stack.Screen options={{ title: `Lịch phí ô ${contract.slotCode}` }} />
      <ContractFinanceCard contract={contract} onPress={() => go(`/vendor/slots/contracts/${contract.contractId}`)} />
      {contract.address ? <Text style={[text.footnote, { color: colors.muted }]}>{contract.address}</Text> : null}
      <SectionHeader title={`${items.length} kỳ phí`} />
      <Card padded={false}>
        {items.map((item, i) => {
          const badge = dueBadge(item);
          const owed = isOwed(item.itemStatus);
          return (
            <View key={item.feeItemId} style={{ padding: 14, gap: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.separator }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: item.itemStatus === 'PAID' ? colors.leafTint : owed ? colors.brandTint : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[{ fontFamily: fonts.code, fontSize: 15, color: item.itemStatus === 'PAID' ? colors.onLeaf : owed ? colors.primary : colors.muted }, tabular]}>{item.ordinal}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[text.subhead, { color: colors.ink }]}>{item.periodLabel}</Text>
                  <Text style={[text.caption, { color: colors.muted }]}>{item.paidAt ? `Đã trả ${formatVietnamDate(item.paidAt)}` : `Hạn ${formatDay(item.dueDate)}`}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }, tabular]}>{formatVnd(item.amount)}</Text>
                  <StatusPill label={badge.label} tone={badge.tone} />
                </View>
              </View>
              {owed && item.payableNow !== false ? (
                <Button label="Thanh toán kỳ này" icon={{ sf: 'creditcard.fill', md: 'credit_card' }} onPress={() => go(`/vendor/finance/fees/${item.feeItemId}/payment`)} />
              ) : item.invoiceId ? (
                <Button label="Xem hoá đơn" variant="secondary" icon={{ sf: 'doc.text', md: 'receipt_long' }} onPress={() => go(`/vendor/finance/invoices/${item.invoiceId}`)} />
              ) : null}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
