import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Segments, SectionHeader } from '@/components/common/Blocks';
import { Icon } from '@/components/common/Icon';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { shareProtectedFile } from '@/components/common/ProtectedFile';
import { Screen } from '@/components/layout/Screen';
import { colors, fonts, radius, text } from '@/theme';
import { groupFees } from '../finance-view';
import { ContractFinanceCard, DebtBoard, FeeRow, InvoiceRow, PenaltyRow } from '../components/FinanceParts';
import { useVendorContracts } from '../useFeeSchedules';
import { useFeeItems, useFinanceSummary, useInvoices, usePenalties } from '../useFinance';

type Tab = 'FEES' | 'PENALTIES' | 'INVOICES';
const PAID_PREVIEW = 3;
const go = (href: string) => router.push(href as Href);

/**
 * V25 Tài chính (FEE-01..05): the debt board first, three shortcuts, then fees (what to pay,
 * what is paid, each contract's schedule), penalty notices and invoices.
 */
export function FinanceHomeScreen() {
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

  const refresh = () => void Promise.all([summary.refetch(), fees.refetch(), penalties.refetch(), invoices.refetch(), contracts.refetch()]);
  const statement = async () => {
    if (downloading) return;
    setDownloading(true);
    await shareProtectedFile(`/vendor/finance/statement?year=${year}`, `sao-ke-phi-${year}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloading(false);
  };

  return (
    <Screen onRefresh={refresh} refreshing={summary.isRefetching} gap={14}>
      <Stack.Screen options={{ title: 'Tài chính' }} />
      <DebtBoard summary={summary.summary} isLoading={summary.isLoading} isError={summary.isError} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Shortcut icon={{ sf: 'clock.arrow.circlepath', md: 'history' }} label="Lịch sử thanh toán" onPress={() => go('/vendor/finance/payments')} />
        <Shortcut icon={{ sf: 'exclamationmark.triangle', md: 'gavel' }} label="Lịch sử vi phạm" onPress={() => go('/vendor/finance/violations')} />
        <Shortcut icon={{ sf: 'tablecells', md: 'table_view' }} label={downloading ? 'Đang tải…' : `Sao kê ${year}`} onPress={() => void statement()} />
      </View>
      <Segments<Tab>
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
          <ListSkeleton rows={3} height={72} />
        ) : fees.isError ? (
          <ErrorState error={fees.error} onRetry={() => void fees.refetch()} />
        ) : fees.feeItems.length === 0 ? (
          <StateView icon={{ sf: 'banknote', md: 'payments' }} tone="neutral" title="Chưa có khoản phí nào" body="Phí thuê ô xuất hiện ở đây khi hợp đồng được lập." />
        ) : (
          <>
            {due.length > 0 ? <SectionHeader title="Cần thanh toán" /> : null}
            {due.map((f) => (
              <FeeRow key={f.feeItemId} fee={f} onPress={() => go(`/vendor/finance/fees/${f.feeItemId}/payment`)} />
            ))}
            {settled.length > 0 ? (
              <SectionHeader
                title="Đã thanh toán"
                action={settled.length > PAID_PREVIEW ? { label: showAllPaid ? 'Thu gọn' : `Xem thêm ${settled.length - PAID_PREVIEW}`, onPress: () => setShowAllPaid((v) => !v) } : undefined}
              />
            ) : null}
            {(showAllPaid ? settled : settled.slice(0, PAID_PREVIEW)).map((f) => (
              <FeeRow key={f.feeItemId} fee={f} onPress={() => go(`/vendor/finance/fees/${f.feeItemId}/payment`)} />
            ))}
            {contracts.contracts.length > 0 ? <SectionHeader title="Lịch đóng phí theo hợp đồng" /> : null}
            {contracts.contracts.map((c) => (
              <ContractFinanceCard key={c.contractId} contract={c} onPress={() => go(`/vendor/finance/contracts/${c.contractId}`)} />
            ))}
          </>
        )
      ) : null}

      {tab === 'PENALTIES' ? (
        penalties.isLoading ? (
          <ListSkeleton rows={3} height={72} />
        ) : penalties.isError ? (
          <ErrorState error={penalties.error} onRetry={() => void penalties.refetch()} />
        ) : penalties.penalties.length === 0 ? (
          <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} title="Không có biên bản phạt" body="Giữ đúng vị trí, giờ bán và vệ sinh để không bị lập biên bản." />
        ) : (
          penalties.penalties.map((p) => (
            <PenaltyRow key={p.penaltyId} penalty={p} onPress={p.penaltyStatus === 'UNPAID' ? () => go(`/vendor/finance/penalties/${p.penaltyId}/payment`) : undefined} />
          ))
        )
      ) : null}

      {tab === 'INVOICES' ? (
        invoices.isLoading ? (
          <ListSkeleton rows={3} height={72} />
        ) : invoices.isError ? (
          <ErrorState error={invoices.error} onRetry={() => void invoices.refetch()} />
        ) : invoices.invoices.length === 0 ? (
          <StateView icon={{ sf: 'doc.text', md: 'receipt_long' }} tone="neutral" title="Chưa có hoá đơn" body="Hoá đơn được xuất sau khi ví xác nhận thanh toán." />
        ) : (
          <>
            {invoices.invoices.slice(0, 5).map((inv) => (
              <InvoiceRow key={inv.invoiceId} invoice={inv} onPress={() => go(`/vendor/finance/invoices/${inv.invoiceId}`)} />
            ))}
            {invoices.invoices.length > 5 ? (
              <Pressable onPress={() => go('/vendor/finance/invoices')} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary }}>Xem tất cả {invoices.invoices.length} hoá đơn</Text>
              </Pressable>
            ) : null}
          </>
        )
      ) : null}
    </Screen>
  );
}

function Shortcut({ icon, label, onPress }: { icon: { sf: string; md: string }; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, minHeight: 76, padding: 10, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, alignItems: 'center', justifyContent: 'center' })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={17} color={colors.primary} />
      </View>
      <Text style={[text.caption, { color: colors.ink, textAlign: 'center' }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
