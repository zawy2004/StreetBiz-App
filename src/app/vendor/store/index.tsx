import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { Thumb } from '@/components/common/Thumb';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useFoodSafety } from '@/features/food-safety/food-safety-store';
import { GateNotice } from '@/features/storefront/GateNotice';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';

export default function VendorStoreScreen() {
  const { colors } = useTheme();
  const gate = useMarketplaceGate();
  const vendors = useMockDb((s) => s.vendors);
  const menuCount = useMockDb((s) => s.menuItems).filter((m) => m.storefrontId === gate.storefront?.id).length;
  const create = useMockDb((s) => s.createStorefront);
  const update = useMockDb((s) => s.updateStorefront);
  const files = useFoodSafety((s) => s.files);
  const [name, setName] = useState('');
  const [open, setOpen] = useState('');
  const [close, setClose] = useState('');
  const store = gate.storefront;

  if (!gate.open || !gate.vendorId) {
    return (
      <>
        <StackHeader title="Gian hàng" />
        <Screen><GateNotice /></Screen>
      </>
    );
  }

  if (!store) {
    const vendor = vendors.find((v) => v.id === gate.vendorId);
    return (
      <>
        <StackHeader title="Gian hàng" />
        <Screen
          footer={
            <Button
              label="Tạo gian hàng"
              disabled={!name.trim()}
              onPress={() =>
                create({
                  vendorId: gate.vendorId!,
                  name: name.trim(),
                  description: '',
                  openTime: '06:00',
                  closeTime: '20:00',
                  availability_status: 'PAUSED',
                })
              }
            />
          }
        >
          <AppText variant="title">Tạo gian hàng</AppText>
          <TextField label="Tên gian hàng" value={name || vendor?.business_name || ''} onChangeText={setName} />
        </Screen>
      </>
    );
  }

  const isOpen = store.availability_status === 'OPEN';
  const attp = files[files.length - 1];

  return (
    <>
      <StackHeader title="Gian hàng" />
      <Screen>
        <View style={styles.head}>
          <Thumb size={72} />
          <View style={styles.headBody}>
            <AppText variant="title">{store.name}</AppText>
            <StatusChip code="VALID" />
          </View>
        </View>

        <Card style={styles.card}>
          <View style={styles.line}>
            <AppText variant="label">Đang mở bán</AppText>
            <Switch
              value={isOpen}
              onValueChange={(on) => update(store.id, { availability_status: on ? 'OPEN' : 'PAUSED' })}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              accessibilityLabel="Đang mở bán"
            />
          </View>
          <View style={styles.hours}>
            <View style={styles.hour}><TextField label="Mở cửa" value={open || store.openTime} onChangeText={setOpen} /></View>
            <View style={styles.hour}><TextField label="Đóng cửa" value={close || store.closeTime} onChangeText={setClose} /></View>
          </View>
          <Button
            label="Lưu giờ"
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={() => update(store.id, { openTime: open || store.openTime, closeTime: close || store.closeTime })}
          />
        </Card>

        <View style={styles.tiles}>
          <Tile icon="silverware-fork-knife" label="Thực đơn" meta={`${menuCount} món`} onPress={() => goTo('/vendor/store/menu')} />
          <Tile icon="shield-check-outline" label="An toàn thực phẩm" chip={attp?.status} onPress={() => goTo('/vendor/store/food-safety')} />
        </View>
      </Screen>
    </>
  );
}

function Tile({ icon, label, meta, chip, onPress }: { icon: IconName; label: string; meta?: string; chip?: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.tile}>
      <Icon name={icon} size={28} color="primary" />
      <AppText variant="label">{label}</AppText>
      {meta ? <AppText variant="small" color="muted">{meta}</AppText> : null}
      {chip ? <StatusChip code={chip} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1, gap: spacing.xs },
  card: { gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hours: { flexDirection: 'row', gap: spacing.md },
  hour: { flex: 1 },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: spacing.sm, minHeight: 120 },
});
