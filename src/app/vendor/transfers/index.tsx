import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { useAnswerTransfer, useTransfers, type TransferView } from '@/features/slots/use-rentals';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

/** SIDE-13: slot transfers offered to me, and the ones I offered. */
export default function TransfersScreen() {
  const transfers = useTransfers();
  const answer = useAnswerTransfer();

  const respond = (t: TransferView, accept: boolean) =>
    answer.mutateAsync({ id: t.id, accept }).then(() => showToast(accept ? 'Đã đồng ý nhận ô, chờ phường duyệt' : 'Đã từ chối'), showError);

  return (
    <>
      <StackHeader title="Chuyển nhượng" />
      <Screen onRefresh={transfers.refetch} refreshing={transfers.isRefetching}>
        <QueryView query={transfers}>
          {({ incoming, outgoing }) => (
            <>
              <Section title="Được chuyển cho bạn">
                {incoming.length ? (
                  incoming.map((t) => (
                    <Card key={t.id} style={styles.card}>
                      <View style={styles.head}>
                        <AppText variant="headline">Ô {t.slotCode}</AppText>
                        <StatusChip code={t.status} />
                      </View>
                      <AppText variant="small" color="muted">{[t.detail, `gửi ${formatDate(t.date)}`].filter(Boolean).join(' · ')}</AppText>
                      {t.status === 'PENDING' ? (
                        <View style={styles.actions}>
                          <View style={styles.half}>
                            <Button label="Từ chối" variant="outline" size="sm" disabled={answer.isPending} onPress={() => void respond(t, false)} />
                          </View>
                          <View style={styles.half}>
                            <Button label="Chấp nhận" size="sm" disabled={answer.isPending} onPress={() => void respond(t, true)} />
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
                        <AppText variant="headline">Ô {t.slotCode}</AppText>
                        <StatusChip code={t.status} />
                      </View>
                      <AppText variant="small" color="muted">{[t.detail, formatDate(t.date)].filter(Boolean).join(' · ')}</AppText>
                    </Card>
                  ))
                ) : (
                  <EmptyState icon="send-outline" title="Chưa gửi yêu cầu nào" />
                )}
              </Section>
            </>
          )}
        </QueryView>
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
