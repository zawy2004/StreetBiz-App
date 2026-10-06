import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ListRow } from '@/components/common/ListRow';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { View } from 'react-native';
import { spacing } from '@/theme';

export default function SessionsScreen() {
  const user = useAuthStore((s) => s.user);
  const sessions = useMockDb((s) => s.sessions).filter((s) => s.userId === user?.id);
  const revoke = useMockDb((s) => s.revokeSession);

  return (
    <>
      <StackHeader title="Phiên đăng nhập" />
      <Screen>
        {sessions.length ? (
          <Card padded={false}>
            {sessions.map((s) => (
              <View key={s.id}>
                <ListRow
                  icon="cellphone"
                  title={s.device}
                  subtitle={`${s.location} · ${s.last_active}`}
                  trailing={s.current ? <StatusChip label="Thiết bị này" tone="ok" /> : undefined}
                  showChevron={false}
                />
                {s.current ? null : (
                  <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
                    <Button label="Thu hồi" variant="danger" size="sm" fullWidth={false} onPress={() => revoke(s.id)} />
                  </View>
                )}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="cellphone-off" title="Không có phiên nào" />
        )}
      </Screen>
    </>
  );
}
