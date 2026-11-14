import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { Screen } from '@/components/layout/Screen';
import { SegmentedControl } from '@/components/native/SegmentedControl';
import { StatusPill } from '@/components/status/StatusPill';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, Plate } from '@/ui';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { ContractFinanceCard, InvoiceRow, RowGroup } from '../components/FinanceParts';
import { groupByMonth, ledgerTotals, paymentStats, PROVIDER_LABEL, PURPOSE_LABEL, SOURCE_LABEL } from '../finance-view';
import { invoiceKind, type InvoiceKindFilter } from '../invoice-groups';
import { dueBadge, formatDay, isOwed } from '../schedule-progress';
import { useContractSchedule } from '../useFeeSchedules';
import { useInvoiceDetail, useInvoices, usePaymentHistory, useVendorViolations } from '../useFinance';

const go = (href: string) => router.push(href as Href);

/** A month's heading in a ledger: plain words, heavy, never shouted in capitals. */
function MonthTitle({ label }: { label: string }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.ink, marginTop: 6 }}>
      {label}
    </Text>
  );
}

/** The ledger's figures: the big one in sign lettering, the others beside it. */
function LedgerTotals({ lead, rest }: { lead: { label: string; value: string }; rest: { label: string; value: string }[] }) {
  return (
    <View style={{ padding: 18, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.brandTint }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{lead.label}</Text>
        <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, { color: colors.ink }, tabular]}>{lead.value}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {rest.map((r) => (
          <View key={r.label} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.white }}>
            <Text style={[text.caption, { color: colors.muted }]} numberOfLines={2}>{r.label}</Text>
            <Text maxFontSizeMultiplier={1.4} adjustsFontSizeToFit numberOfLines={1} style={[sign.price, { color: colors.ink }, tabular]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** V28 Hoá đơn (FEE-03): every invoice by month, fees and fines filterable, with the year's totals. */
export function InvoicesListScreen() {
  const { invoices, isLoading, isError, error, refetch, isRefetching } = useInvoices();
  const [kind, setKind] = useState<InvoiceKindFilter>('ALL');
  const shown = kind === 'ALL' ? invoices : invoices.filter((i) => invoiceKind(i) === kind);
  const totals = ledgerTotals(invoices);
  const months = groupByMonth(shown, (i) => i.issuedAt);
  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching} gap={14}>
      <Stack.Screen options={{ title: 'Hoá đơn' }} />
      {isLoading ? (
        <>
          <Skeleton height={150} radius={radius.card} />
          <ListSkeleton rows={3} height={72} />
        </>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : invoices.length === 0 ? (
        <StateView icon={{ sf: 'doc.text', md: 'receipt_long' }} tone="neutral" title="Chưa có hoá đơn" body="Hoá đơn được xuất sau khi ví xác nhận thanh toán." />
      ) : (
        <>
          <LedgerTotals
            lead={{ label: 'Tổng đã nộp', value: formatVnd(totals.total) }}
            rest={[
              { label: 'Phí thuê ô', value: formatVnd(totals.fee) },
              { label: 'Tiền phạt', value: formatVnd(totals.penalty) },
            ]}
          />
          <SegmentedControl<InvoiceKindFilter>
            value={kind}
            onChange={setKind}
            options={[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'FEE', label: 'Phí thuê ô' },
              { key: 'PENALTY', label: 'Tiền phạt' },
            ]}
          />
          {months.map((m) => (
            <View key={m.key} style={{ gap: 10 }}>
              <MonthTitle label={m.label} />
              <RowGroup>
                {m.items.map((inv) => (
                  <InvoiceRow key={inv.invoiceId} invoice={inv} onPress={() => go(`/vendor/finance/invoices/${inv.invoiceId}`)} />
                ))}
              </RowGroup>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

/** A round rubber stamp, pressed on askew: what the receipt certifies. */
function PaidStamp({ date }: { date?: string | null }) {
  return (
    <View accessibilityLabel="Đã thanh toán" style={{ minWidth: 104, minHeight: 104, borderRadius: radius.full, borderWidth: 3, borderColor: colors.leaf, alignItems: 'center', justifyContent: 'center', padding: 6, transform: [{ rotate: '-10deg' }] }}>
      <View style={{ position: 'absolute', left: 5, right: 5, top: 5, bottom: 5, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.leaf }} />
      <Icon sf="checkmark" md="check" size={20} color={colors.leaf} weight="bold" />
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.code, fontSize: 14, lineHeight: 17, color: colors.leaf, textAlign: 'center' }}>Đã thanh toán</Text>
      {date ? <Text maxFontSizeMultiplier={1.2} style={[{ fontFamily: fonts.code, fontSize: 11, lineHeight: 14, color: colors.leaf }, tabular]}>{formatVietnamDate(date)}</Text> : null}
    </View>
  );
}

/** V29 Chi tiết hoá đơn: the receipt the ward issued, as a torn-off slip, and its PDF to keep or send. */
export function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = Number(id);
  const { invoice, isLoading, isError, error, refetch } = useInvoiceDetail(invoiceId);
  const [downloading, setDownloading] = useState(false);
  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hoá đơn' }} />
        <Skeleton height={420} radius={radius.pass} />
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
      <Pass
        accent={penalty ? colors.danger : colors.brand}
        head={
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 15, lineHeight: 20, color: penalty ? colors.onDanger : colors.primary }}>{penalty ? 'Biên lai thu tiền phạt' : 'Biên lai thu phí thuê ô'}</Text>
                <Text selectable style={[{ fontFamily: fonts.code, fontSize: 18, lineHeight: 22, color: colors.ink }, tabular]}>{invoice.invoiceNumber}</Text>
              </View>
              {invoice.paidAt ? <PaidStamp date={invoice.paidAt} /> : null}
            </View>
            <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, { color: colors.ink, marginTop: 4 }, tabular]}>{formatVnd(invoice.amount)}</Text>
            {invoice.amountInWords ? <Text style={[text.footnote, { color: colors.ink }]}>Bằng chữ: {invoice.amountInWords}</Text> : null}
            <Text style={[text.footnote, { color: colors.muted }, tabular]}>Xuất ngày {formatVietnamDate(invoice.issuedAt)}</Text>
          </View>
        }
        stub={
          <KeyValueList
            rows={[
              invoice.wardName ? { label: 'Đơn vị thu', value: `UBND ${invoice.wardName}` } : null,
              invoice.payerName ? { label: 'Người nộp', value: invoice.payerName } : null,
              invoice.businessName ? { label: 'Hộ kinh doanh', value: invoice.businessName } : null,
              { label: penalty ? 'Biên bản phạt' : 'Khoản phí', value: (penalty ? invoice.violationLabel : invoice.periodLabel) ?? '—' },
              invoice.slotCode ? { label: 'Ô', value: <Plate code={invoice.slotCode} prefix="Ô" /> } : null,
              penalty && invoice.decisionNumber ? { label: 'Quyết định xử phạt', value: invoice.decisionNumber } : null,
              invoice.paymentProvider ? { label: 'Thanh toán qua', value: PROVIDER_LABEL[invoice.paymentProvider] ?? invoice.paymentProvider } : null,
              invoice.providerReference ? { label: 'Mã giao dịch', value: invoice.providerReference, mono: true } : null,
              invoice.paidAt ? { label: 'Thanh toán lúc', value: formatVietnamDateTime(invoice.paidAt) } : null,
            ]}
          />
        }
      />
    </Screen>
  );
}

/** V30 Lịch sử thanh toán (FEE-05): every attempt, its outcome, and the month's paid total. */
export function PaymentHistoryScreen() {
  const { payments, isLoading, isError, error, refetch, isRefetching } = usePaymentHistory();
  const stats = paymentStats(payments);
  const months = groupByMonth(payments, (p) => p.createdAt);
  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching} gap={14}>
      <Stack.Screen options={{ title: 'Lịch sử thanh toán' }} />
      {isLoading ? (
        <>
          <Skeleton height={150} radius={radius.card} />
          <ListSkeleton rows={3} height={64} />
        </>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : payments.length === 0 ? (
        <StateView icon={{ sf: 'clock.arrow.circlepath', md: 'history' }} tone="neutral" title="Chưa có giao dịch" body="Các lần thanh toán phí và tiền phạt hiện ở đây." />
      ) : (
        <>
          <LedgerTotals
            lead={{ label: 'Đã thanh toán', value: formatVnd(stats.successTotal) }}
            rest={[
              { label: 'Thành công', value: String(stats.success) },
              { label: 'Thất bại / chờ', value: `${stats.failed} / ${stats.pending}` },
            ]}
          />
          {months.map((m) => (
            <View key={m.key} style={{ gap: 10 }}>
              <MonthTitle label={m.label} />
              <RowGroup>
                {m.items.map((p) => {
                  const s = statusLabel(p.transactionStatus);
                  const fine = p.purpose === 'PENALTY';
                  return (
                    <View key={p.transactionId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 14, paddingHorizontal: 16 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: fine ? colors.dangerTint : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon sf={fine ? 'exclamationmark.octagon.fill' : 'calendar'} md={fine ? 'report' : 'calendar_month'} size={19} color={fine ? colors.danger : colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }} numberOfLines={2}>{p.referenceLabel || PURPOSE_LABEL[p.purpose] || p.purpose}</Text>
                        <Text style={[text.footnote, { color: colors.muted }, tabular]} numberOfLines={2}>
                          {[PROVIDER_LABEL[p.provider] ?? p.provider, p.slotCode ? `Ô ${p.slotCode}` : null, formatVietnamDateTime(p.createdAt)].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.ink }, tabular]}>{formatVnd(p.amount)}</Text>
                        <StatusPill label={s.label} tone={s.tone} />
                      </View>
                    </View>
                  );
                })}
              </RowGroup>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

/** V31 Lịch sử vi phạm: each record as the notice it is, who recorded it (on site or a resident's report), the fine and its state. */
export function VendorViolationsScreen() {
  const { violations, isLoading, isError, error, refetch, isRefetching } = useVendorViolations();
  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching} gap={18}>
      <Stack.Screen options={{ title: 'Lịch sử vi phạm' }} />
      {isLoading ? (
        <>
          <Skeleton height={200} radius={radius.pass} />
          <Skeleton height={200} radius={radius.pass} />
        </>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : violations.length === 0 ? (
        <StateView icon={{ sf: 'checkmark.seal.fill', md: 'verified' }} title="Chưa có vi phạm nào" body="Giữ đúng vị trí, giờ bán và vệ sinh để hồ sơ luôn sạch." />
      ) : (
        violations.map((v) => {
          const s = v.penaltyStatus ? statusLabel(v.penaltyStatus) : null;
          return (
            <Pass
              key={v.violationId}
              accent={colors.danger}
              head={
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {v.slotCode ? <Plate code={v.slotCode} prefix="Ô" /> : null}
                    <Text style={[text.footnote, { flexShrink: 1, color: colors.muted }, tabular]}>
                      {SOURCE_LABEL[v.source] ?? v.source}, {formatVietnamDateTime(v.recordedAt)}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.ink }}>{v.violationLabel}</Text>
                  {v.description ? <Text style={[text.callout, { color: colors.ink }]}>{v.description}</Text> : null}
                  {v.evidenceUrl ? (
                    <View style={{ flexDirection: 'row' }}>
                      <ProtectedFileTile fileUrl={v.evidenceUrl} label="Ảnh hiện trường" />
                    </View>
                  ) : null}
                </View>
              }
              stub={
                v.penaltyAmount != null || s ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <Text maxFontSizeMultiplier={1.4} style={[v.penaltyAmount != null ? sign.price : text.headline, { color: colors.ink }, tabular]}>{v.penaltyAmount != null ? formatVnd(v.penaltyAmount) : 'Không phạt tiền'}</Text>
                    {s ? <StatusPill label={s.label} tone={s.tone} /> : null}
                  </View>
                ) : undefined
              }
            />
          );
        })
      )}
    </Screen>
  );
}

/** V38 Lịch đóng phí của một hợp đồng: every instalment on one line of stops, what is paid, what is next, what is late. */
export function ContractScheduleScreen() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const { schedule, isLoading, isError, error, refetch } = useContractSchedule(Number(contractId));
  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Lịch phí' }} />
        <Skeleton height={150} radius={radius.card} />
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
    <Screen onRefresh={() => void refetch()} gap={16}>
      <Stack.Screen options={{ title: `Lịch phí ô ${contract.slotCode}` }} />
      <ContractFinanceCard contract={contract} onPress={() => go(`/vendor/slots/contracts/${contract.contractId}`)} />
      {contract.address ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Icon sf="mappin.and.ellipse" md="location_on" size={15} color={colors.muted} />
          <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>{contract.address}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink, marginTop: 6 }}>{items.length} kỳ phí</Text>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, paddingHorizontal: 16, paddingVertical: 8 }}>
        {items.map((item, i) => {
          const badge = dueBadge(item);
          const owed = isOwed(item.itemStatus);
          const paid = item.itemStatus === 'PAID';
          const last = i === items.length - 1;
          return (
            <View key={item.feeItemId} style={{ flexDirection: 'row', gap: 14 }}>
              {/* The stop on the line: its ordinal in sign figures */}
              <View style={{ alignItems: 'center', width: 40 }}>
                <View style={{ width: 2, height: 12, backgroundColor: i === 0 ? 'transparent' : paid ? colors.leaf : colors.line }} />
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: paid ? colors.leaf : owed ? colors.cta : colors.sunken, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, boxShadow: owed ? shadow.glow : undefined }}>
                  {paid ? (
                    <Icon sf="checkmark" md="check" size={17} color={colors.white} weight="bold" />
                  ) : (
                    <Text maxFontSizeMultiplier={1.3} style={[{ fontFamily: fonts.code, fontSize: 17, color: owed ? colors.white : colors.muted }, tabular]}>{item.ordinal}</Text>
                  )}
                </View>
                {!last ? <View style={{ flex: 1, width: 2, minHeight: 12, backgroundColor: paid ? colors.leaf : colors.line }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 10, paddingTop: 12, paddingBottom: last ? 12 : 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{item.periodLabel}</Text>
                    <Text style={[text.footnote, { color: colors.muted }, tabular]}>{item.paidAt ? `Đã trả ${formatVietnamDate(item.paidAt)}` : `Hạn ${formatDay(item.dueDate)}`}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.ink }, tabular]}>{formatVnd(item.amount)}</Text>
                    <StatusPill label={badge.label} tone={badge.tone} />
                  </View>
                </View>
                {owed && item.payableNow !== false ? (
                  <Button label="Thanh toán kỳ này" icon={{ sf: 'creditcard.fill', md: 'credit_card' }} onPress={() => go(`/vendor/finance/fees/${item.feeItemId}/payment`)} />
                ) : item.invoiceId ? (
                  <Button label="Xem hoá đơn" variant="secondary" icon={{ sf: 'doc.text', md: 'receipt_long' }} onPress={() => go(`/vendor/finance/invoices/${item.invoiceId}`)} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
