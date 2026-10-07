import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { Thumb } from '@/components/common/Thumb';
import { LoadingState } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { FilterChips } from '@/components/forms/FilterChips';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { isLiveApi } from '@/core/config/env';
import { goTo } from '@/core/navigation/go';
import { GateNotice } from '@/features/storefront/GateNotice';
import { useFoodSafetyList, useSaveStore, useSellerMenu } from '@/features/storefront/use-store';
import { useMarketplaceGate, useSelectedStore, type GateStore } from '@/features/storefront/useMarketplaceGate';
import { spacing, useTheme } from '@/theme';

/** The seller's storefront: open/pause selling, details, menu and ATTP. */
export default function VendorStoreScreen() {
  const gate = useMarketplaceGate();
  const select = useSelectedStore((s) => s.select);
  const store = gate.storefront;
  const menu = useSellerMenu(store?.id);
  const attp = useFoodSafetyList().data?.[0];

  if (gate.loading || !gate.open || !store) {
    return (
      <>
        <StackHeader title="Gian hàng" />
        {gate.loading ? (
          <Screen><LoadingState /></Screen>
        ) : !gate.open ? (
          <Screen><GateNotice /></Screen>
        ) : (
          <CreateStore />
        )}
      </>
    );
  }

  return (
    <>
      <StackHeader title="Gian hàng" />
      <Screen>
        {gate.storefronts.length > 1 ? (
          <FilterChips
            options={gate.storefronts.map((s) => ({ value: s.id, label: s.name, icon: 'storefront-outline' as const }))}
            selected={[store.id]}
            onToggle={select}
          />
        ) : null}

        <View style={styles.head}>
          <Thumb size={72} seed={store.id} icon="storefront-outline" />
          <View style={styles.headBody}>
            <AppText variant="title">{store.name}</AppText>
            <StatusChip code={store.status} />
          </View>
        </View>

        {/* Keyed so switching storefront starts the form from that store's values. */}
        <StoreEditor key={`${store.id}:${store.name}:${store.status}`} store={store} />

        <View style={styles.tiles}>
          <Tile icon="silverware-fork-knife" label="Thực đơn" meta={menu.data ? `${menu.data.items.length}/${menu.data.maxItems} món` : undefined} onPress={() => goTo('/vendor/store/menu')} />
          <Tile icon="shield-check-outline" label="An toàn thực phẩm" chip={attp?.status} onPress={() => goTo('/vendor/store/food-safety')} />
        </View>
        <View style={styles.tiles}>
          <Tile icon="receipt-text-outline" label="Đơn hàng" onPress={() => goTo('/vendor/orders')} />
          <Tile icon="chart-line" label="Doanh thu" onPress={() => goTo('/vendor/store/sales')} />
        </View>
      </Screen>
    </>
  );
}

function CreateStore() {
  const save = useSaveStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return (
    <Screen
      footer={
        <Button
          label="Tạo gian hàng"
          disabled={!name.trim()}
          loading={save.isPending}
          onPress={() => save.mutateAsync({ name: name.trim(), description: description.trim(), status: 'PAUSED' }).then(() => showToast('Đã tạo gian hàng'), showError)}
        />
      }
    >
      <AppText variant="title">Tạo gian hàng</AppText>
      <AppText color="muted">Mỗi ô đang thuê mở được một gian hàng để nhận đặt món online.</AppText>
      <TextField label="Tên gian hàng" value={name} onChangeText={setName} />
      <TextField label="Mô tả" multiline value={description} onChangeText={setDescription} placeholder="Món chính, giờ bán…" />
    </Screen>
  );
}

function StoreEditor({ store }: { store: GateStore }) {
  const { colors } = useTheme();
  const save = useSaveStore();
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description);
  const [open, setOpen] = useState(store.openTime ?? '');
  const [close, setClose] = useState(store.closeTime ?? '');

  const persist = (status: GateStore['status'] = store.status) =>
    save
      .mutateAsync({ store, name: name.trim() || store.name, description: description.trim(), status, openTime: open || undefined, closeTime: close || undefined })
      .then(() => showToast('Đã lưu gian hàng'), showError);

  return (
    <Card style={styles.card}>
      <View style={styles.line}>
        <View style={styles.flex}>
          <AppText variant="label">Đang mở bán</AppText>
          <AppText variant="caption" color="muted">Tắt khi hết hàng hoặc nghỉ bán để người mua không đặt được.</AppText>
        </View>
        <Switch
          value={store.status === 'OPEN'}
          disabled={save.isPending}
          onValueChange={(on) => void persist(on ? 'OPEN' : 'PAUSED')}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          accessibilityLabel="Đang mở bán"
        />
      </View>
      <TextField label="Tên gian hàng" value={name} onChangeText={setName} />
      <TextField label="Mô tả" multiline value={description} onChangeText={setDescription} />
      {!isLiveApi ? (
        <View style={styles.hours}>
          <View style={styles.flex}><TextField label="Mở cửa" value={open} onChangeText={setOpen} /></View>
          <View style={styles.flex}><TextField label="Đóng cửa" value={close} onChangeText={setClose} /></View>
        </View>
      ) : null}
      <Button label="Lưu thay đổi" variant="outline" size="sm" fullWidth={false} loading={save.isPending} onPress={() => void persist()} />
    </Card>
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
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flex: { flex: 1 },
  hours: { flexDirection: 'row', gap: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: spacing.sm, minHeight: 112 },
});
