import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError } from '@/components/feedback/Toast';
import { RadioRow } from '@/components/forms/Choices';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { env, isDev, isLiveApi } from '@/core/config/env';
import { goReplace } from '@/core/navigation/go';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

import { useConfirmSandboxPayment, useFees, usePenalties, useStartPayment, useSyncFinancePayment, type CheckoutResult } from './use-finance';

const METHODS = [
  { value: 'MOMO' as const, label: 'MoMo' },
  { value: 'ZALOPAY' as const, label: 'ZaloPay' },
];

/**
 * FEE-01/FEE-04. The demo marks the item paid at once. Live, the backend
 * opens a payment with the provider; it only counts as paid once the backend
 * sees the provider's confirmation (or the Development sandbox).
 */
export function PaymentScreen({ kind }: { kind: 'fee' | 'penalty' }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fees = useFees();
  const penalties = usePenalties();
  const start = useStartPayment(kind);
  const sandbox = useConfirmSandboxPayment();
  const sync = useSyncFinancePayment();
  const [method, setMethod] = useState<'MOMO' | 'ZALOPAY'>('MOMO');
  const [checkout, setCheckout] = useState<CheckoutResult>();

  const source: { data: unknown[] | undefined; error: unknown; refetch: () => void } = kind === 'fee' ? fees : penalties;
  const fee = fees.data?.find((f) => f.id === id);
  const penalty = penalties.data?.find((p) => p.id === id);
  const title = kind === 'fee' ? (fee ? `Phí thuê ô ${fee.period}` : '') : (penalty?.reason ?? '');
  const amount = (kind === 'fee' ? fee?.amount : penalty?.amount) ?? 0;
  const slotCode = kind === 'fee' ? fee?.slotCode : penalty?.slotCode;
  const showSandbox = isLiveApi && isDev && env.enablePaymentSandbox;

  const finish = (code: string) => {
    const q = new URLSearchParams({ amount: String(amount), label: title, code });
    goReplace(`/vendor/finance/success?${q.toString()}`);
  };

  // Back from the payment app: ask the backend whether the provider confirmed it.
  const syncing = useRef(false);
  const syncNow = sync.mutateAsync;
  useEffect(() => {
    if (!checkout || !isLiveApi) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || syncing.current) return;
      syncing.current = true;
      syncNow(checkout.transactionId)
        .then((status) => (status === 'SUCCESS' ? finish(checkout.code) : undefined))
        .catch(() => undefined)
        .finally(() => {
          syncing.current = false;
        });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `finish` only reads render values
  }, [checkout, syncNow]);

  async function pay() {
    try {
      const result = await start.mutateAsync({ id: id!, provider: method });
      if (!isLiveApi) return finish(result.code);
      setCheckout(result);
      if (result.paymentUrl && !showSandbox) await Linking.openURL(result.paymentUrl);
    } catch (e) {
      showError(e);
    }
  }

  async function check() {
    if (!checkout) return;
    try {
      const status = await sync.mutateAsync(checkout.transactionId);
      if (status === 'SUCCESS') finish(checkout.code);
      else showError(new Error(status === 'FAILED' ? 'Thanh toán không thành công.' : 'Cổng thanh toán chưa xác nhận, thử lại sau ít phút.'));
    } catch (e) {
      showError(e);
    }
  }

  async function sandboxPay() {
    if (!checkout) return;
    try {
      await sandbox.mutateAsync(checkout.transactionId);
      finish(checkout.code);
    } catch (e) {
      showError(e);
    }
  }

  const footer = checkout ? (
    <>
      {showSandbox ? <Button label="Thanh toán thử (thành công)" loading={sandbox.isPending} onPress={() => void sandboxPay()} /> : null}
      {checkout.paymentUrl ? <Button label="Mở lại trang thanh toán" variant={showSandbox ? 'outline' : 'primary'} icon="open-in-new" onPress={() => void Linking.openURL(checkout.paymentUrl!)} /> : null}
      <Button label="Kiểm tra lại" variant="ghost" icon="refresh" loading={sync.isPending} onPress={() => void check()} />
    </>
  ) : (
    <Button label={`Thanh toán ${formatVnd(amount)}`} icon="lock-outline" loading={start.isPending} disabled={!amount} onPress={() => void pay()} />
  );

  return (
    <>
      <StackHeader title="Thanh toán" />
      <Screen footer={footer}>
        <QueryView query={source}>
          {() =>
            !amount ? (
              <EmptyState title="Không tìm thấy khoản thanh toán" description="Khoản này có thể đã được thanh toán." />
            ) : (
              <>
                <Card style={styles.summary}>
                  <AppText variant="label">{title}</AppText>
                  {slotCode ? <AppText variant="small" color="muted">{slotCode}</AppText> : null}
                  <Money amountVnd={amount} size="lg" color="primary" />
                </Card>
                {checkout ? (
                  <Card style={styles.summary}>
                    <AppText variant="headline">Đang chờ cổng thanh toán xác nhận</AppText>
                    <AppText color="muted">
                      {showSandbox
                        ? 'Môi trường thử nghiệm: bấm "Thanh toán thử" để hoàn tất.'
                        : 'Thanh toán trên trang của cổng thanh toán rồi quay lại đây; ứng dụng sẽ tự kiểm tra kết quả.'}
                    </AppText>
                  </Card>
                ) : (
                  <View style={styles.methods}>
                    <AppText variant="labelSm">Phương thức</AppText>
                    {METHODS.map((m) => (
                      <RadioRow key={m.value} label={m.label} selected={m.value === method} onPress={() => setMethod(m.value)} />
                    ))}
                  </View>
                )}
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  methods: { gap: spacing.sm },
});
