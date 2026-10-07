import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { HeroCard } from '@/components/common/HeroCard';
import { ListRow } from '@/components/common/ListRow';
import { StatTile } from '@/components/common/StatTile';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { ThemeModeSelector } from '@/components/layout/ThemeControls';
import { WELCOME_ROUTE } from '@/core/auth/role-routes';
import { isLiveApi } from '@/core/config/env';
import { goRoot, goTo } from '@/core/navigation/go';
import { ROLE_LABELS } from '@/core/types/role';
import { useUnreadNotifications } from '@/features/account/use-account';
import { isActiveOrder } from '@/features/orders/order-utils';
import { useMyOrders, useVendorOrders } from '@/features/orders/use-orders';
import { useContracts } from '@/features/slots/use-rentals';
import { useAuthStore } from '@/store/auth-store';
import { radius, spacing, useTheme } from '@/theme';
import { formatVndCompact } from '@/utils/format';

/** Signed-in account tab, shared by buyer and seller shells (FE: /customer/account, /vendor/account). */
export function AccountScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const unread = useUnreadNotifications();

  if (!user) return null;
  const vendor = user.role_code === 'VENDOR';

  return (
    <Screen>
      <HeroCard>
        <View style={styles.profile}>
          <View style={[styles.avatarRing, { borderColor: colors.heroLine }]}>
            <Avatar name={user.fullName} size={60} />
          </View>
          <View style={styles.profileBody}>
            <AppText variant="title" style={{ color: colors.onHero }} numberOfLines={1}>{user.fullName}</AppText>
            <AppText variant="small" style={{ color: colors.heroMuted }}>{user.phone}</AppText>
            <View style={[styles.roleChip, { borderColor: colors.heroLine }]}>
              <AppText variant="badge" style={{ color: colors.onHero }}>{ROLE_LABELS[user.role_code]}</AppText>
            </View>
          </View>
        </View>
      </HeroCard>

      {vendor ? <VendorStats /> : user.role_code === 'CUSTOMER' ? <CustomerStats /> : null}

      <Section title="Tài khoản">
        <Card padded={false}>
          <ListRow
            icon="bell-outline"
            title="Thông báo"
            trailing={unread ? <CountBadge count={unread} /> : undefined}
            onPress={() => goTo('/notifications')}
          />
          <ListRow icon="lock-reset" title="Đổi mật khẩu" onPress={() => goTo('/change-password')} />
          <ListRow icon="cellphone-link" title="Phiên đăng nhập" subtitle="Thiết bị đang đăng nhập" onPress={() => goTo('/sessions')} last />
        </Card>
      </Section>

      {vendor ? (
        <Section title="Kinh doanh">
          <Card padded={false}>
            <ListRow icon="storefront-outline" iconTone="secondary" title="Gian hàng" subtitle="Thực đơn, giờ mở cửa, ATTP" onPress={() => goTo('/vendor/store')} />
            <ListRow icon="file-document-edit-outline" iconTone="secondary" title="Hồ sơ đăng ký kinh doanh" onPress={() => goTo('/vendor/registrations')} />
            <ListRow icon="robot-outline" iconTone="secondary" title="Trợ lý tuân thủ" subtitle="Hỏi về phí, giấy phép, vi phạm" onPress={() => goTo('/vendor/assistant')} last />
          </Card>
        </Section>
      ) : null}

      <Section title="Giao diện" subtitle="Chọn sáng, tối hoặc theo cài đặt của máy">
        <ThemeModeSelector />
      </Section>

      {/* Demo accounts have no backend session, so the shortcut only exists in the mock mode. */}
      {!isLiveApi ? (
        <Section title="Demo">
          <Card padded={false}>
            <ListRow icon="swap-horizontal" iconTone="tertiary" title="Đổi vai trò" subtitle="Chuyển nhanh giữa các tài khoản mẫu" onPress={() => goTo('/switch-role')} last />
          </Card>
        </Section>
      ) : null}

      <Button
        label="Đăng xuất"
        icon="logout"
        variant="danger"
        onPress={() => {
          signOut();
          goRoot(WELCOME_ROUTE);
        }}
      />
      <AppText variant="caption" color="muted" align="center">StreetBiz · Phường Hải Châu 1, Đà Nẵng</AppText>
    </Screen>
  );
}

function CustomerStats() {
  const orders = useMyOrders().data ?? [];
  const active = orders.filter((o) => isActiveOrder(o.status)).length;
  const completed = orders.filter((o) => o.status === 'COMPLETED').length;
  return (
    <View style={styles.stats}>
      <StatTile icon="receipt-text-outline" tone="primary" value={String(active)} label="Đang xử lý" onPress={() => goTo('/customer/orders')} />
      <StatTile icon="history" value={String(orders.length)} label="Tổng đơn" onPress={() => goTo('/customer/orders')} />
      <StatTile icon="check-circle-outline" tone="tertiary" value={String(completed)} label="Đã nhận món" />
    </View>
  );
}

function VendorStats() {
  const orders = useVendorOrders().data ?? [];
  const contracts = (useContracts().data ?? []).filter((c) => c.status === 'ACTIVE').length;
  const revenue = orders.filter((o) => o.status === 'COMPLETED').reduce((n, o) => n + o.total, 0);
  return (
    <View style={styles.stats}>
      <StatTile icon="map-marker-radius-outline" tone="secondary" value={String(contracts)} label="Ô đang thuê" onPress={() => goTo('/vendor/slots')} />
      <StatTile icon="receipt-text-outline" tone="primary" value={String(orders.length)} label="Đơn hàng" onPress={() => goTo('/vendor/orders')} />
      <StatTile icon="cash" tone="tertiary" value={formatVndCompact(revenue)} label="Doanh thu" onPress={() => goTo('/vendor/store/sales')} />
    </View>
  );
}

function CountBadge({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
      <AppText variant="badge" color="onPrimary">{count}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarRing: { borderWidth: 3, borderRadius: 40, padding: 3 },
  profileBody: { flex: 1, gap: 4 },
  roleChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
