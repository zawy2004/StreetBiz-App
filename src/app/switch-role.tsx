import { Card } from '@/components/common/Card';
import { ListRow } from '@/components/common/ListRow';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState } from '@/components/feedback/States';
import { RequireAuth } from '@/core/auth/guards';
import { isLiveApi } from '@/core/config/env';
import { ROLE_HOME } from '@/core/auth/role-routes';
import { goRoot } from '@/core/navigation/go';
import { ROLE_LABELS, type RoleCode } from '@/core/types/role';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import type { AccentTone } from '@/theme';

const ICON: Record<RoleCode, 'storefront-outline' | 'shopping-outline' | 'shield-account-outline' | 'cog-outline'> = {
  VENDOR: 'storefront-outline',
  CUSTOMER: 'shopping-outline',
  WARD_AUTHORITY: 'shield-account-outline',
  PLATFORM_ADMIN: 'cog-outline',
};

const TONE: Record<RoleCode, AccentTone> = {
  VENDOR: 'secondary',
  CUSTOMER: 'primary',
  WARD_AUTHORITY: 'indigo',
  PLATFORM_ADMIN: 'indigo',
};

/** Demo helper: jump straight into any seeded account without signing out. */
export default function SwitchRoleScreen() {
  if (isLiveApi) {
    return (
      <>
        <StackHeader title="Đổi vai trò (demo)" />
        <Screen>
          <EmptyState icon="swap-horizontal" title="Chỉ dùng với dữ liệu demo" description="Khi chạy với backend, hãy đăng xuất rồi đăng nhập bằng tài khoản khác." />
        </Screen>
      </>
    );
  }
  return (
    <RequireAuth>
      <SwitchRole />
    </RequireAuth>
  );
}

function SwitchRole() {
  const current = useAuthStore((s) => s.user?.id);
  const users = useMockDb((s) => s.users).filter((u) => u.role_code !== 'PLATFORM_ADMIN');
  const vendors = useMockDb((s) => s.vendors);

  return (
    <>
      <StackHeader title="Đổi vai trò (demo)" />
      <Screen>
        <Card padded={false}>
          {users.map((u, i) => {
            const business = vendors.find((v) => v.id === u.vendorId)?.business_name;
            return (
              <ListRow
                key={u.id}
                icon={ICON[u.role_code]}
                iconTone={TONE[u.role_code]}
                title={u.fullName}
                subtitle={[ROLE_LABELS[u.role_code], business, u.id === current ? 'Đang dùng' : undefined].filter(Boolean).join(' · ')}
                last={i === users.length - 1}
                onPress={() => {
                  useAuthStore.setState({ user: u });
                  goRoot(ROLE_HOME[u.role_code]);
                }}
              />
            );
          })}
        </Card>
      </Screen>
    </>
  );
}
