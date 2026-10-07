import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Money } from '@/components/common/Money';
import { TextField } from '@/components/forms/TextField';
import { StackHeader } from '@/components/layout/StackHeader';
import { errorMessage } from '@/core/api/problem';
import { usePickupHandover, type OrderView } from '@/features/orders/use-orders';
import { QrScanner } from '@/services/qr/QrScanner';
import { layout, spacing } from '@/theme';

type Result = { order?: OrderView; error?: string };

/**
 * ORD-06: hand an order over by scanning the buyer's code. The code itself
 * identifies the order, so a code from another stall is refused by the backend.
 */
export default function PickupScanScreen() {
  const handover = usePickupHandover();
  const [result, setResult] = useState<Result>();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');

  async function confirm(input: { token?: string; code?: string }) {
    if (handover.isPending) return;
    try {
      setResult({ order: await handover.mutateAsync(input) });
    } catch (e) {
      setResult({ error: errorMessage(e) });
    }
  }

  return (
    <View style={styles.root}>
      <StackHeader title="Nhận hàng" />
      {result ? (
        <View style={styles.result}>
          <Card style={styles.card}>
            <Icon name={result.order ? 'check-circle' : 'close-circle'} size={48} color={result.order ? 'tertiary' : 'error'} />
            {result.order ? (
              <>
                <AppText variant="title">Đã giao đơn #{result.order.code.slice(-8)}</AppText>
                <AppText color="muted">{result.order.customerName ?? ''}</AppText>
                <Money amountVnd={result.order.total} size="lg" />
              </>
            ) : (
              <>
                <AppText variant="title">Không giao được</AppText>
                <AppText color="muted" align="center">{result.error}</AppText>
              </>
            )}
          </Card>
          {result.order ? <Button label="Xong" onPress={() => router.back()} /> : null}
          <Button label="Quét đơn khác" variant="outline" onPress={() => setResult(undefined)} />
        </View>
      ) : typing ? (
        <View style={styles.result}>
          <TextField label="Mã nhận món khách đọc" autoCapitalize="characters" value={code} onChangeText={setCode} placeholder="VD: ZMVF4M3A" autoFocus />
          <Button label="Xác nhận giao" loading={handover.isPending} disabled={code.trim().length < 4} onPress={() => void confirm({ code: code.trim() })} />
          <Button label="Quay lại quét QR" variant="ghost" onPress={() => setTyping(false)} />
        </View>
      ) : (
        <View style={styles.root}>
          <QrScanner hint="Quét mã nhận món của khách" onDetected={(token) => void confirm({ token })} />
          <View style={styles.fallback}>
            <Button label="Không quét được? Nhập mã" variant="light" icon="keyboard-outline" onPress={() => setTyping(true)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  result: { padding: layout.screenMargin, gap: spacing.lg },
  card: { gap: spacing.sm, alignItems: 'center' },
  fallback: { position: 'absolute', left: layout.screenMargin, right: layout.screenMargin, bottom: spacing.xxl },
});
