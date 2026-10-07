import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { HeroCard } from '@/components/common/HeroCard';
import { Icon, type IconName } from '@/components/common/Icon';
import { ListRow } from '@/components/common/ListRow';
import { StatTile } from '@/components/common/StatTile';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useChatUnread } from '@/features/chat/use-chat';
import { useVendorOrders } from '@/features/orders/use-orders';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useVendorHome, type TodoItem } from '@/features/vendor-home/useVendorHome';
import { accentTone, radius, spacing, useTheme, type AccentTone } from '@/theme';
import { daysUntil, formatDate, formatVndCompact } from '@/utils/format';

const TODO_LOOK: Record<TodoItem['kind'], { icon: IconName; tone: AccentTone }> = {
  registration: { icon: 'file-document-outline', tone: 'indigo' },
  fee: { icon: 'cash', tone: 'secondary' },
  penalty: { icon: 'alert-outline', tone: 'error' },
};

const SHORTCUTS: { label: string; icon: IconName; tone: AccentTone; href: string }[] = [
  { label: 'Đăng ký KD', icon: 'file-document-edit-outline', tone: 'indigo', href: '/vendor/registrations' },
  { label: 'Thuê ô', icon: 'map-marker-radius-outline', tone: 'tertiary', href: '/vendor/slots' },
  { label: 'Nhận hàng', icon: 'qrcode-scan', tone: 'primary', href: '/vendor/store/pickup' },
  { label: 'Cửa hàng', icon: 'storefront-outline', tone: 'secondary', href: '/vendor/store' },
  { label: 'Thực đơn', icon: 'silverware-fork-knife', tone: 'primary', href: '/vendor/store/menu' },
  { label: 'Trợ lý', icon: 'robot-outline', tone: 'indigo', href: '/vendor/assistant' },
];

export default function VendorHomeScreen() {
  const { colors } = useTheme();
  const { user, contract, permit, todos, dueTotal, refetch } = useVendorHome();
  const { storefront } = useMarketplaceGate();
  const orders = useVendorOrders();
  const unreadChat = useChatUnread('VENDOR');
  const firstName = user?.fullName.trim().split(/\s+/).slice(-1)[0] ?? '';

  const newOrders = (orders.data ?? []).filter((o) => o.status === 'PLACED').length;
  const permitDays = permit ? daysUntil(permit.endDate) : 0;

  return (
    <Screen onRefresh={refetch}>
      <View style={styles.greeting}>
        <AppText variant="labelSm" color="muted">{storefront?.name ?? 'Hộ kinh doanh'}</AppText>
        <AppText variant="display">Chào {firstName}, chúc buôn may bán đắt!</AppText>
      </View>

      {permit && contract ? (
        <HeroCard accent={permit.status === 'VALID' ? 'green' : 'amber'} onPress={() => goTo(`/vendor/permit/${contract.id}`)}>
          <View style={styles.permitTop}>
            <View style={styles.qrTile}>
              <Icon name="qrcode" size={34} color="#14171C" />
            </View>
            <View style={styles.permitBody}>
              <AppText variant="eyebrow" style={{ color: colors.heroMuted }}>Giấy phép số</AppText>
              <AppText variant="title" style={{ color: colors.onHero }}>{permit.displayCode}</AppText>
              <StatusChip code={permit.status} />
            </View>
            <Icon name="chevron-right" size={24} color={colors.heroMuted} />
          </View>
          <View style={[styles.permitFoot, { borderTopColor: colors.heroLine }]}>
            <View style={styles.permitFact}>
              <Icon name="map-marker-outline" size={16} color={colors.heroMuted} />
              <AppText variant="small" style={{ color: colors.onHero }} numberOfLines={1}>{contract.slotCode} · {contract.street}</AppText>
            </View>
            <View style={styles.permitFact}>
              <Icon name="calendar-clock" size={16} color={colors.heroMuted} />
              <AppText variant="small" style={{ color: permitDays <= 30 ? '#FFB547' : colors.onHero }}>
                Hết hạn {formatDate(permit.endDate)}{permitDays >= 0 && permitDays <= 30 ? ` · còn ${permitDays} ngày` : ''}
              </AppText>
            </View>
          </View>
        </HeroCard>
      ) : contract ? (
        <HeroCard accent="amber" onPress={() => goTo(`/vendor/contracts/${contract.id}`)}>
          <AppText variant="eyebrow" style={{ color: '#FFB547' }}>Đang chờ</AppText>
          <AppText variant="title" style={{ color: colors.onHero }}>Hợp đồng ô {contract.slotCode} chờ cấp giấy phép</AppText>
          <AppText style={{ color: colors.heroMuted }}>Phường sẽ phát hành giấy phép QR cho hợp đồng này; bạn sẽ nhận được thông báo.</AppText>
        </HeroCard>
      ) : (
        <HeroCard accent="amber">
          <AppText variant="eyebrow" style={{ color: '#FFB547' }}>Bắt đầu</AppText>
          <AppText variant="title" style={{ color: colors.onHero }}>Chưa có giấy phép bán hàng</AppText>
          <AppText style={{ color: colors.heroMuted }}>Chọn một ô trống trên bản đồ và nộp hồ sơ online, phường duyệt xong sẽ cấp giấy phép QR.</AppText>
          <Button label="Tìm ô vỉa hè" icon="map-search-outline" onPress={() => goTo('/vendor/slots')} />
        </HeroCard>
      )}

      <View style={styles.stats}>
        <StatTile icon="receipt-text-outline" tone="primary" value={String(newOrders)} label="Đơn mới" onPress={() => goTo('/vendor/orders')} />
        <StatTile icon="message-text-outline" tone="indigo" value={String(unreadChat)} label="Tin chưa đọc" onPress={() => goTo('/vendor/chat')} />
        <StatTile icon="cash-clock" tone="secondary" value={formatVndCompact(dueTotal)} label="Cần thanh toán" onPress={() => goTo('/vendor/finance')} />
      </View>

      <Section
        title="Việc cần làm"
        action={todos.length ? <View style={[styles.count, { backgroundColor: colors.primarySoft }]}><AppText variant="badge" color="primary">{todos.length} việc</AppText></View> : null}
      >
        {todos.length ? (
          <Card padded={false}>
            {todos.map((t, i) => (
              <ListRow
                key={t.id}
                icon={TODO_LOOK[t.kind].icon}
                iconTone={TODO_LOOK[t.kind].tone}
                title={t.title}
                subtitle={t.subtitle}
                meta={t.chip ? <StatusChip code={t.chip} /> : undefined}
                last={i === todos.length - 1}
                onPress={() => goTo(t.href)}
              />
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState icon="check-circle-outline" tone="tertiary" title="Không có việc cần làm" description="Phí, hồ sơ và biên bản đều đã xong." />
          </Card>
        )}
      </Section>

      <Section title="Lối tắt">
        <View style={styles.grid}>
          {SHORTCUTS.map((s) => (
            <Shortcut key={s.label} {...s} />
          ))}
        </View>
      </Section>
    </Screen>
  );
}

function Shortcut({ label, icon, tone, href }: (typeof SHORTCUTS)[number]) {
  const { colors, shadow } = useTheme();
  const t = accentTone(colors, tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => goTo(href)}
      style={({ pressed }) => [styles.shortcut, shadow.card, { backgroundColor: pressed ? colors.sunken : colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.shortcutIcon, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={24} color={t.fg} />
      </View>
      <AppText variant="labelSm" align="center" numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: 2 },
  permitTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qrTile: { width: 60, height: 60, borderRadius: radius.control + 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  permitBody: { flex: 1, gap: 4 },
  permitFoot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: 6 },
  permitFact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  count: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcut: {
    width: '31.8%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  shortcutIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
