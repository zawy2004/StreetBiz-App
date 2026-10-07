import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { formatDate, phoneDigits } from '@/utils/format';

export default function TransfersScreen() {
  const user = useAuthStore((s) => s.user);
  const transfers = useMockDb((s) => s.transfers);
  const contracts = useMockDb((s) => s.contracts);
  const slots = useMockDb((s) => s.slots);
  const accept = useMockDb((s) => s.acceptTransfer);
  const review = useMockDb((s) => s.reviewTransfer);

  const codeOf = (contractId: string) => slots.find((s) => s.id === contracts.find((c) => c.id === contractId)?.slotId)?.slot_code ?? '';
  const incoming = transfers.filter((t) => phoneDigits(t.toVendorPhone) === phoneDigits(user?.phone ?? '') && t.fromVendorId !== user?.vendorId);
  const outgoing = transfers.filter((t) => t.fromVendorId === user?.vendorId);

  return (
    <>
      <StackHeader title="Chuyển nhượng" />
      <Screen>
        <Section title="Được chuyển cho bạn">
          {incoming.length ? (
            incoming.map((t) => (
              <Card key={t.id} style={styles.card}>
                <View style={styles.head}>
                  <AppText variant="headline">Ô {codeOf(t.contractId)}</AppText>
                  <StatusChip code={t.transfer_status} />
                </View>
                <AppText variant="small" color="muted">Gửi {formatDate(t.requested_at)}</AppText>
                {t.transfer_status === 'PENDING' ? (
                  <View style={styles.actions}>
                    <View style={styles.half}>
                      <Button label="Từ chối" variant="outline" size="sm" onPress={() => review(t.id, false)} />
                    </View>
                    <View style={styles.half}>
                      <Button label="Chấp nhận" size="sm" onPress={() => user?.vendorId && accept(t.id, user.vendorId)} />
                    </View>
                  </View>
                ) : null}
              </Card>
            ))
          ) : (
            <EmptyState icon="swap-horizontal" title="Chưa có yêu cầu nào" />
          )}
        </Section>

        <Section title="Bạn đã gửi">
          {outgoing.length ? (
            outgoing.map((t) => (
              <Card key={t.id} style={styles.card}>
                <View style={styles.head}>
                  <AppText variant="headline">Ô {codeOf(t.contractId)}</AppText>
                  <StatusChip code={t.transfer_status} />
                </View>
                <AppText variant="small" color="muted">Cho {t.toVendorPhone} · {formatDate(t.requested_at)}</AppText>
              </Card>
            ))
          ) : (
            <EmptyState icon="send-outline" title="Chưa gửi yêu cầu nào" />
          )}
        </Section>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
