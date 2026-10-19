import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { shareProtectedFile } from '@/components/common/ProtectedFile';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { ApiError, errorMessage, financeApi, type FinanceCheckoutDto, type PaymentProvider } from '@/core/api';
import { uuid } from '@/core/utils/uuid';
import { isSandboxPaymentUrl, redirectToPayment } from '@/features/orders/payment-redirect';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { feeUrgency } from '../finance-view';
import { ReturnCheck, SafePaySteps, WalletPicker } from '../components/FinanceParts';
import { rememberFinancePayment, useFinancePaymentReturn } from '../payment-return';
import { formatDay, paidShare } from '../schedule-progress';
import { useFeeItemDetail } from '../useFeeSchedules';
import { usePayFeeCheckout, usePayPenaltyCheckout, usePenalties } from '../useFinance';

/**
 * The checkout both payment screens share. One idempotency key per attempt (BR-37), reused if
 * the same tap is retried after a lost response; a real MoMo page opens outside the app and the
 * backend checks it on return; with only the development sandbox, the backend confirms here.
 * Only the server's authenticated callback marks anything paid (BR-32).
 *
 * A new attempt gets a new key: after the wallet reports the payment FAILED (the screen stays
 * mounted, unlike the web's full-page redirect, so the old key would replay the failed
 * transaction), and when the vendor switches wallet (the server refuses a key reused for
 * another provider).
 */
function useCheckoutFlow(run: (key: string) => Promise<FinanceCheckoutDto>, onPaid: () => Promise<void>, provider: PaymentProvider) {
  const queryClient = useQueryClient();
  const key = useRef<string | null>(null);
  const keyProvider = useRef<PaymentProvider>(provider);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const refreshAll = async () => {
    await queryClient.cancelQueries({ queryKey: ['finance'] });
    await queryClient.invalidateQueries({ queryKey: ['finance'] });
  };
  const momo = useFinancePaymentReturn(async () => {
    await refreshAll();
    showToast('Ví đã xác nhận thanh toán');
    await onPaid();
  }, () => {
    key.current = null;
  });

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    if (keyProvider.current !== provider) {
      key.current = null;
      keyProvider.current = provider;
    }
    key.current ??= uuid();
    try {
      const result = await run(key.current);
      if (!isSandboxPaymentUrl(result.paymentUrl)) {
        rememberFinancePayment(result.transactionId);
        showToast('Đang mở ví để thanh toán', 'info');
        redirectToPayment(result.paymentUrl);
        return;
      }
      try {
        await financeApi.sandboxConfirmPayment(result.transactionId);
        await refreshAll();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Thanh toán thành công');
        key.current = null;
        await onPaid();
      } catch (err) {
        await refreshAll();
        setError(err instanceof ApiError && err.status === 404 ? 'Cổng thanh toán chưa sẵn sàng trên máy chủ này.' : errorMessage(err));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { pay, busy, error, momo, refreshAll };
}

/** V26 Thanh toán phí thuê ô (FEE-01): the instalment as a slip, the contract's progress, the wallet, pay. */
export function FeePaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const feeItemId = Number(id);
  const detail = useFeeItemDetail(feeItemId);
  const checkout = usePayFeeCheckout();
  const [provider, setProvider] = useState<PaymentProvider>('MOMO');
  const flow = useCheckoutFlow(
    (idempotencyKey) => checkout.mutateAsync({ feeItemId, provider, idempotencyKey }),
    async () => {
      await detail.refetch();
    },
    provider,
  );

  if (detail.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán phí' }} />
        <ListSkeleton rows={1} height={190} />
        <ListSkeleton rows={2} height={64} />
      </Screen>
    );
  }
  if (detail.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán phí' }} />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  const { item, contract } = detail.data;
  if (item.itemStatus === 'PAID') return <FeeReceipt detail={detail.data} />;
  const payable = item.itemStatus === 'PENDING' || item.itemStatus === 'OVERDUE';
  const urgency = feeUrgency(item);

  return (
    <Screen
      onRefresh={() => void detail.refetch()}
      refreshing={detail.isRefetching}
      footer={
        payable ? (
          <PayBar amount={item.amount}>
            <Button label={flow.busy ? 'Đang khởi tạo…' : 'Thanh toán'} size={56} icon={{ sf: 'lock.fill', md: 'lock' }} loading={flow.busy} onPress={() => void flow.pay()} style={{ flex: 1 }} />
          </PayBar>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Thanh toán phí' }} />
      <ReturnCheck state={flow.momo.state} onRetry={flow.momo.retry} />
      <Slip
        caption="PHÍ THUÊ Ô VỈA HÈ"
        title={item.periodLabel}
        amount={item.amount}
        rows={[
          { label: 'Ô', value: <SlotPlate code={contract.slotCode} /> },
          { label: 'Tuyến', value: contract.zoneName ?? '—' },
          { label: 'Hạn nộp', value: formatDay(item.dueDate) },
          { label: 'Kỳ', value: `${item.ordinal}/${item.ofCount}` },
        ]}
        pill={urgency ? { label: urgency.text, tone: urgency.tone === 'danger' ? 'danger' : urgency.tone === 'pending' ? 'pending' : 'neutral' } : null}
      />
      <View style={{ padding: 16, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[text.footnote, { color: colors.ink }, tabular]}>Đã nộp {contract.paidCount}/{contract.instalmentCount} kỳ</Text>
          <Text style={[text.footnote, { color: colors.primary, fontFamily: fonts.bold }, tabular]}>Còn {formatVnd(contract.outstandingAmount)}</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sunken, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(paidShare(contract) * 100)}%`, height: '100%', backgroundColor: colors.leaf }} />
        </View>
      </View>
      {payable ? <WalletPicker value={provider} onChange={setProvider} disabled={flow.busy} /> : <Banner tone="neutral">Khoản phí này không còn cần thanh toán.</Banner>}
      {flow.error ? <Banner tone="danger">{flow.error}</Banner> : null}
      {payable ? <SafePaySteps /> : null}
    </Screen>
  );
}

/** After paying: the receipt and its invoice, not a bounce back to the list. */
function FeeReceipt({ detail }: { detail: NonNullable<ReturnType<typeof useFeeItemDetail>['data']> }) {
  const { item, contract } = detail;
  const [downloading, setDownloading] = useState(false);
  return (
    <Screen footer={<Button label="Về Tài chính" variant="secondary" size={56} onPress={() => router.dismissTo('/vendor/finance' as Href)} />}>
      <Stack.Screen options={{ title: 'Đã thanh toán' }} />
      <View style={{ padding: 22, gap: 14, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.leafTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="checkmark.seal.fill" md="verified" size={34} color={colors.leaf} />
        </View>
        <Text style={[text.title3, { color: colors.ink }]}>Thanh toán thành công</Text>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 32, color: colors.ink }, tabular]}>{formatVnd(item.amount)}</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <KeyValueList
            rows={[
              { label: 'Kỳ phí', value: item.periodLabel },
              { label: 'Ô', value: <SlotPlate code={contract.slotCode} /> },
              item.paidAt ? { label: 'Thanh toán lúc', value: formatVietnamDateTime(item.paidAt) } : null,
              item.invoiceNumber ? { label: 'Hoá đơn', value: item.invoiceNumber, mono: true } : null,
            ]}
          />
        </View>
        {item.invoiceId && item.invoiceNumber ? (
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Button label="Xem hoá đơn" icon={{ sf: 'doc.text', md: 'receipt_long' }} onPress={() => router.push(`/vendor/finance/invoices/${item.invoiceId}` as Href)} style={{ flex: 1 }} />
            <Button
              label="PDF"
              variant="secondary"
              icon={{ sf: 'square.and.arrow.down', md: 'download' }}
              loading={downloading}
              onPress={async () => {
                setDownloading(true);
                await shareProtectedFile(`/vendor/finance/invoices/${item.invoiceId}/pdf`, `${item.invoiceNumber}.pdf`, 'application/pdf');
                setDownloading(false);
              }}
            />
          </View>
        ) : (
          <Text style={[text.footnote, { color: colors.muted }]}>Hoá đơn đang được phát hành…</Text>
        )}
      </View>
      {contract.nextDue ? (
        <Pressable onPress={() => router.push(`/vendor/finance/contracts/${contract.contractId}` as Href)} accessibilityRole="button">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
            <Icon sf="calendar" md="calendar_month" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: colors.muted }]}>Kỳ tiếp theo</Text>
              <Text style={[text.subhead, { color: colors.ink }]}>{contract.nextDue.periodLabel} · hạn {formatDay(contract.nextDue.dueDate)}</Text>
            </View>
            <Text style={[{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }, tabular]}>{formatVnd(contract.nextDue.amount)}</Text>
          </View>
        </Pressable>
      ) : null}
    </Screen>
  );
}

/** V27 Nộp phạt (FEE-04): the notice, who decided it, the wallet, pay. */
export function PenaltyPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const penaltyId = Number(id);
  const { penalties, isLoading, isError, error, refetch } = usePenalties();
  const checkout = usePayPenaltyCheckout();
  const [provider, setProvider] = useState<PaymentProvider>('MOMO');
  const flow = useCheckoutFlow(
    (idempotencyKey) => checkout.mutateAsync({ penaltyId, provider, idempotencyKey }),
    async () => {
      router.back();
    },
    provider,
  );
  const penalty = penalties.find((p) => p.penaltyId === penaltyId);

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Nộp phạt' }} />
        <ListSkeleton rows={1} height={190} />
      </Screen>
    );
  }
  if (isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Nộp phạt' }} />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }
  if (!penalty) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Nộp phạt' }} />
        <StateView icon={{ sf: 'doc.questionmark', md: 'help' }} tone="neutral" title="Không tìm thấy biên bản" body="Biên bản có thể đã được nộp hoặc huỷ." />
      </Screen>
    );
  }
  const unpaid = penalty.penaltyStatus === 'UNPAID';

  return (
    <Screen
      footer={
        unpaid ? (
          <PayBar amount={penalty.amount}>
            <Button label={flow.busy ? 'Đang khởi tạo…' : 'Nộp phạt'} size={56} icon={{ sf: 'lock.fill', md: 'lock' }} loading={flow.busy} onPress={() => void flow.pay()} style={{ flex: 1 }} />
          </PayBar>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Nộp phạt' }} />
      <ReturnCheck state={flow.momo.state} onRetry={flow.momo.retry} />
      <Slip
        caption="BIÊN BẢN XỬ PHẠT"
        title={penalty.violationLabel}
        amount={penalty.amount}
        danger
        rows={[
          penalty.slotCode ? { label: 'Ô', value: <SlotPlate code={penalty.slotCode} /> } : null,
          { label: 'Lập ngày', value: formatVietnamDate(penalty.issuedAt) },
          { label: 'Mã biên bản', value: `#${penalty.penaltyId}` },
        ]}
        pill={unpaid ? { label: 'Chưa nộp', tone: 'danger' } : { label: 'Đã nộp', tone: 'ok' }}
      />
      <Banner tone="neutral" title="Về biên bản này">
        Mức phạt do cán bộ Phường quyết định theo khung quy định. Biên bản chuyển sang đã nộp khi ví xác nhận giao dịch.
      </Banner>
      {unpaid ? <WalletPicker value={provider} onChange={setProvider} disabled={flow.busy} /> : null}
      {flow.error ? <Banner tone="danger">{flow.error}</Banner> : null}
      {unpaid ? <SafePaySteps /> : null}
    </Screen>
  );
}

/** A paper slip: caption, what it is for, the amount large, the facts under a dashed tear line. */
function Slip({
  caption,
  title,
  amount,
  rows,
  pill,
  danger,
}: {
  caption: string;
  title: string;
  amount: number;
  rows: Parameters<typeof KeyValueList>[0]['rows'];
  pill: { label: string; tone: 'ok' | 'pending' | 'danger' | 'neutral' } | null;
  danger?: boolean;
}) {
  return (
    <View style={{ borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
      <View style={{ padding: 18, gap: 8, backgroundColor: danger ? colors.dangerTint : colors.brandTint }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: danger ? colors.onDanger : colors.primary }}>{caption}</Text>
          {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
        </View>
        <Text style={[text.headline, { color: colors.ink }]}>{title}</Text>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 32, lineHeight: 38, color: colors.ink }, tabular]} adjustsFontSizeToFit numberOfLines={1}>
          {formatVnd(amount)}
        </Text>
      </View>
      <View style={{ height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.line }} />
      <View style={{ padding: 16 }}>
        <KeyValueList rows={rows} />
      </View>
    </View>
  );
}

function PayBar({ amount, children }: { amount: number; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View>
        <Text style={[text.caption, { color: colors.muted }]}>Số tiền</Text>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink }, tabular]}>{formatVnd(amount)}</Text>
      </View>
      {children}
    </View>
  );
}
