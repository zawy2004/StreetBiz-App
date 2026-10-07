import { View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ListRow } from '@/components/common/ListRow';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { RequireAuth } from '@/core/auth/guards';
import { useRevokeSession, useSessions } from '@/features/account/use-account';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

export default function SessionsScreen() {
  return (
    <RequireAuth>
      <Sessions />
    </RequireAuth>
  );
}

function Sessions() {
  const sessions = useSessions();
  const revoke = useRevokeSession();

  return (
    <>
      <StackHeader title="Phiên đăng nhập" />
      <Screen onRefresh={sessions.refetch} refreshing={sessions.isRefetching}>
        <QueryView query={sessions}>
          {(list) =>
            list.length ? (
              <Card padded={false}>
                {list.map((s, i) => (
                  <View key={s.id}>
                    <ListRow
                      icon="cellphone"
                      title={s.device}
                      subtitle={[s.place, formatDateTime(s.lastActive)].filter(Boolean).join(' · ')}
                      trailing={s.current ? <StatusChip label="Thiết bị này" tone="ok" /> : undefined}
                      showChevron={false}
                      last={i === list.length - 1 && s.current}
                    />
                    {s.current ? null : (
                      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
                        <Button label="Thu hồi" variant="danger" size="sm" fullWidth={false} onPress={() => revoke.mutate(s.id)} />
                      </View>
                    )}
                  </View>
                ))}
              </Card>
            ) : (
              <EmptyState icon="cellphone-off" title="Không có phiên nào" />
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}
