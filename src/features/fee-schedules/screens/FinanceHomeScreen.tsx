import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { shareProtectedFile } from '@/components/common/ProtectedFile';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { SegmentedControl } from '@/components/native/SegmentedControl';
import { StatusPill } from '@/components/status/StatusPill';
import type { FeeItemDto } from '@/core/api';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, Plate, Section, Signboard, useLightStatusBar } from '@/ui';
import { formatVnd } from '@/utils/format';
import { feeUrgency, groupFees } from '../finance-view';
import { ContractFinanceCard, DebtBoard, FeeRow, InvoiceRow, PenaltyRow, RowGroup } from '../components/FinanceParts';
import { formatDay } from '../schedule-progress';
import { useVendorContracts } from '../useFeeSchedules';
import { useFeeItems, useFinanceSummary, useInvoices, usePenalties } from '../useFinance';

type Tab = 'FEES' | 'PENALTIES' | 'INVOICES';
const PAID_PREVIEW = 3;
const go = (href: string) => router.push(href as Href);

/** The fee to pay first (overdue, else the nearest due date), as a slip lying across the sign's edge. */
function UrgentFee({ fee, onPress }: { fee: FeeItemDto; onPress: () => void }) {
  const urgency = feeUrgency(fee);
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`Khoản cần trả trước: ô ${fee.slotCode}, ${fee.periodLabel}, ${formatVnd(fee.amount)}${urgency ? `, ${urgency.text}` : ''}. Mở để thanh toán`}>
      <Pass
        accent={urgency?.tone === 'danger' ? colors.danger : colors.brand}
        head={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Khoản cần trả trước</Text>
              {urgency ? <StatusPill label={urgency.text} tone={urgency.tone === 'danger' ? 'danger' : urgency.tone === 'pending' ? 'pending' : 'neutral'} /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Plate code={fee.slotCode} prefix="Ô" />
              <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{fee.periodLabel}</Text>
            </View>
          </View>
        }
        stub={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { color: colors.ink }, tabular]}>{formatVnd(fee.amount)}</Text>
              <Text style={[text.footnote, { color: colors.muted }, tabular]}>Hạn {formatDay(fee.dueDate)}</Text>
            </View>
            <View style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: radius.full, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.glow }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 15.5, color: colors.white }}>Thanh toán</Text>
            </View>
          </View>
        }
      />
    </PressableScale>
  );
}

/**
 * V25 Tài chính (FEE-01..05), v5 (screens/v5/vendor-commerce.md): the orange sign says what is
 * owed in sign figures (leaf green once everything is paid); the fee to pay first lies across its
 * edge as a slip; then three shortcuts, and fees (to pay, paid, each contract's schedule), penalty
 * notices and invoices.
 */
export function FinanceHomeScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const [tab, setTab] = useState<Tab>('FEES');
  const [showAllPaid, setShowAllPaid] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const summary = useFinanceSummary();
  const fees = useFeeItems();
  const penalties = usePenalties();
  const invoices = useInvoices();
  const contracts = useVendorContracts();
  const { due, settled } = groupFees(fees.feeItems);
  const unpaidPenalties = penalties.penalties.filter((p) => p.penaltyStatus === 'UNPAID').length;
  const year = new Date().getFullYear();
  const clear = !summary.isLoading && !summary.isError && !!summary.summary && summary.summary.totalDue === 0;
  const urgent = due[0];

  const refresh = () => void Promise.all([summary.refetch(), fees.refetch(), penalties.refetch(), invoices.refetch(), contracts.refetch()]);
  const statement = async () => {
    if (downloading) return;
    setDownloading(true);
    await shareProtectedFile(`/vendor/finance/statement?year=${year}`, `sao-ke-phi-${year}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false, title: 'Tài chính' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40, gap: 24 }}
        refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={refresh} tintColor={colors.cta} colors={[colors.cta]} progressViewOffset={insets.top} />}
      >
        <Signboard
          color={clear ? colors.leaf : colors.brand}
          kerb={!clear}
          line2Color={clear ? colors.white : colors.plate}
          line1="Tài chính"
          line2={clear ? 'đã nộp đủ' : 'cần trả'}
          overlap={urgent ? <UrgentFee fee={urgent} onPress={() => go(`/vendor/finance/fees/${urgent.feeItemId}/payment`)} /> : undefined}
        >
          <DebtBoard summary={summary.summary} isLoading={summary.isLoading} isError={summary.isError} />
        </Signboard>

        <View style={{ paddingHorizontal: 16, gap: 22 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Shortcut icon={{ sf: 'clock.arrow.circlepath', md: 'history' }} label="Lịch sử thanh toán" onPress={() => go('/vendor/finance/payments')} />
            <Shortcut icon={{ sf: 'exclamationmark.triangle', md: 'gavel' }} label="Lịch sử vi phạm" onPress={() => go('/vendor/finance/violations')} />
            <Shortcut icon={{ sf: 'tablecells', md: 'table_view' }} label={downloading ? 'Đang tải…' : `Sao kê ${year}`} onPress={() => void statement()} />
          </View>
          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { key: 'FEES', label: 'Phí thuê ô', count: due.length },
              { key: 'PENALTIES', label: 'Phạt', count: unpaidPenalties },
              { key: 'INVOICES', label: 'Hoá đơn' },
            ]}
          />

          {tab === 'FEES' ? (
            fees.isLoading ? (
              <ListBlockSkeleton />
            ) : fees.isError ? (
              <ErrorState error={fees.error} onRetry={() => void fees.refetch()} />
            ) : fees.feeItems.length === 0 ? (
              <StateView icon={{ sf: 'banknote', md: 'payments' }} tone="neutral" title="Chưa có khoản phí nào" body="Phí thuê ô xuất hiện ở đây khi hợp đồng được lập." />
            ) : (
              <>
                {due.length > 0 ? (
                  <Section title="Cần thanh toán" inset={0}>
                    <RowGroup>
                      {due.map((f) => (
                        <FeeRow key={f.feeItemId} fee={f} onPress={() => go(`/vendor/finance/fees/${f.feeItemId}/payment`)} />
                      ))}
                    </RowGroup>
                  </Section>
                ) : null}
                {settled.length > 0 ? (
                  <Section
                    title="Đã thanh toán"
                    inset={0}
                    action={settled.length > PAID_PREVIEW ? { label: showAllPaid ? 'Thu gọn' : `Xem thêm ${settled.length - PAID_PREVIEW}`, onPress: () => setShowAllPaid((v) => !v) } : undefined}
                  >
                    <RowGroup>
                      {(showAllPaid ? settled : settled.slice(0, PAID_PREVIEW)).map((f) => (
                        <FeeRow key={f.feeItemId} fee={f} onPress={() => go(`/vendor/finance/fees/${f.feeItemId}/payment`)} />
                      ))}
                    </RowGroup>
                  </Section>
                ) : null}
                {contracts.contracts.length > 0 ? (
                  <Section title="Lịch đóng phí theo hợp đồng" inset={0}>
                    <View style={{ gap: 12 }}>
                      {contracts.contracts.map((c) => (
                        <ContractFinanceCard key={c.contractId} contract={c} onPress={() => go(`/vendor/finance/contracts/${c.contractId}`)} />
                      ))}
                    </View>
                  </Section>
                ) : null}
              </>
            )
          ) : null}

          {tab === 'PENALTIES' ? (
            penalties.isLoading ? (
              <ListBlockSkeleton />
            ) : penalties.isError ? (
              <ErrorState error={penalties.error} onRetry={() => void penalties.refetch()} />
            ) : penalties.penalties.length === 0 ? (
              <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} title="Không có biên bản phạt" body="Giữ đúng vị trí, giờ bán và vệ sinh để không bị lập biên bản." />
            ) : (
              <RowGroup>
                {penalties.penalties.map((p) => (
                  <PenaltyRow key={p.penaltyId} penalty={p} onPress={p.penaltyStatus === 'UNPAID' ? () => go(`/vendor/finance/penalties/${p.penaltyId}/payment`) : undefined} />
                ))}
              </RowGroup>
            )
          ) : null}

          {tab === 'INVOICES' ? (
            invoices.isLoading ? (
              <ListBlockSkeleton />
            ) : invoices.isError ? (
              <ErrorState error={invoices.error} onRetry={() => void invoices.refetch()} />
            ) : invoices.invoices.length === 0 ? (
              <StateView icon={{ sf: 'doc.text', md: 'receipt_long' }} tone="neutral" title="Chưa có hoá đơn" body="Hoá đơn được xuất sau khi ví xác nhận thanh toán." />
            ) : (
              <View style={{ gap: 12 }}>
                <RowGroup>
                  {invoices.invoices.slice(0, 5).map((inv) => (
                    <InvoiceRow key={inv.invoiceId} invoice={inv} onPress={() => go(`/vendor/finance/invoices/${inv.invoiceId}`)} />
                  ))}
                </RowGroup>
                {invoices.invoices.length > 5 ? (
                  <Pressable onPress={() => go('/vendor/finance/invoices')} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 18, borderRadius: radius.full, backgroundColor: pressed ? colors.brandTint : 'transparent' })}>
                    <Text style={[{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.primary }, tabular]}>Xem tất cả {invoices.invoices.length} hoá đơn</Text>
                    <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            )
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Loading rows in the shape of the white list block. */
function ListBlockSkeleton() {
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, padding: 16, gap: 18 }} accessibilityLabel="Đang tải">
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="40%" />
          </View>
          <Skeleton width={70} height={18} />
        </View>
      ))}
    </View>
  );
}

function Shortcut({ icon, label, onPress }: { icon: { sf: string; md: string }; label: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={{ flex: 1, minHeight: 96, paddingVertical: 14, paddingHorizontal: 8, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={19} color={colors.primary} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: colors.ink, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}
