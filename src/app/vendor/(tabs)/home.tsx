import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { ListRow } from '@/components/common/ListRow';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StatusChip } from '@/components/status/StatusChip';
import { useVendorHome, type TodoItem } from '@/features/vendor-home/useVendorHome';
import { radius, spacing, useTheme } from '@/theme';

const TODO_ICON: Record<TodoItem['kind'], IconName> = {
  registration: 'file-document-outline',
  fee: 'cash',
  penalty: 'alert-outline',
};

const SHORTCUTS: { label: string; icon: IconName; href: string }[] = [
  { label: 'Đăng ký KD', icon: 'file-document-edit-outline', href: '/vendor/registrations' },
  { label: 'Thuê ô', icon: 'view-grid-outline', href: '/vendor/slots' },
  { label: 'Nhận hàng', icon: 'qrcode-scan', href: '/vendor/store/pickup' },
  { label: 'Cửa hàng', icon: 'storefront-outline', href: '/vendor/store' },
];

export default function VendorHomeScreen() {
  const { colors } = useTheme();
  const { user, permit, slot, todos } = useVendorHome();
  const firstName = user?.fullName.split(' ').slice(-1)[0] ?? '';

  return (
    <Screen>
      <AppText variant="display">Chào chị {firstName}</AppText>

      {permit ? (
        <Card style={styles.permit}>
          <View style={styles.permitTop}>
            <View style={[styles.qrTile, { backgroundColor: colors.sunken }]}>
              <Icon name="qrcode" size={30} color="indigo" />
            </View>
            <View style={styles.permitBody}>
              <AppText variant="code">{permit.permit_code}</AppText>
              <StatusChip code={permit.permit_status} />
            </View>
            <Button
              label="Xem QR"
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={() => router.push(`/vendor/permit/${permit.id}` as never)}
            />
          </View>
          {slot ? (
            <View style={[styles.place, { backgroundColor: colors.sunken }]}>
              <Icon name="map-marker-outline" size={18} color="muted" />
              <AppText variant="small" color="muted">{slot.slot_code} · {slot.street}</AppText>
            </View>
          ) : null}
        </Card>
      ) : (
        <Card style={styles.permit}>
          <AppText variant="label">Chưa có giấy phép</AppText>
          <Button label="Thuê ô vỉa hè" onPress={() => router.push('/vendor/slots' as never)} />
        </Card>
      )}

      <Section
        title="Việc cần làm"
        action={todos.length ? <AppText variant="labelSm" color="primary">{todos.length} việc</AppText> : null}
      >
        {todos.length ? (
          <Card padded={false}>
            {todos.map((t) => (
              <ListRow
                key={t.id}
                icon={TODO_ICON[t.kind]}
                title={t.title}
                subtitle={t.subtitle}
                meta={t.chip ? <StatusChip code={t.chip} /> : undefined}
                onPress={() => router.push(t.href as never)}
              />
            ))}
          </Card>
        ) : (
          <Card><EmptyState icon="check-circle-outline" title="Không có việc cần làm" /></Card>
        )}
      </Section>

      <Section title="Lối tắt">
        <View style={styles.grid}>
          {SHORTCUTS.map((s) => (
            <Card key={s.label} style={styles.shortcut} onPress={() => router.push(s.href as never)}>
              <View style={[styles.shortcutIcon, { backgroundColor: colors.sunken }]}>
                <Icon name={s.icon} size={26} color="primary" />
              </View>
              <AppText variant="label">{s.label}</AppText>
            </Card>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  permit: { gap: spacing.md, padding: spacing.md },
  permitTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qrTile: { width: 44, height: 44, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  permitBody: { flex: 1, gap: 6 },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.control },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  shortcut: { width: '47.8%', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  shortcutIcon: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
