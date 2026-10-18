import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Segments, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { StockTag } from '@/components/status/MockBadge';
import { errorMessage } from '@/core/api';
import { sellerStoreApi, type RentalChoice, type SellerStore } from '@/core/api/seller-store-api';
import { statusLabel } from '@/core/constants/status-labels';
import { storefrontPhotos } from '@/features/buyer-discovery/food-photos';
import { colors, fonts, radius, text } from '@/theme';
import { contractFor, displayDate, eligibilityReason, STATUS_CONSEQUENCE } from '../store-view';

const go = (href: string) => router.push(href as Href);
export const STORE_KEYS = {
  stores: ['commerce', 'stores'] as const,
  contracts: ['commerce', 'store-contracts'] as const,
  applications: ['commerce', 'store-applications'] as const,
};

/** Today in Ho Chi Minh City as yyyy-mm-dd (the web's same +7h trick). */
const hcmToday = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

function useStoreData() {
  const stores = useQuery({ queryKey: STORE_KEYS.stores, queryFn: sellerStoreApi.stores });
  const contracts = useQuery({ queryKey: STORE_KEYS.contracts, queryFn: sellerStoreApi.contracts });
  const applications = useQuery({ queryKey: STORE_KEYS.applications, queryFn: sellerStoreApi.applications });
  const today = hcmToday();
  // Each live contract (in its term, not already used) whose registration has no stall yet can open one.
  const choices =
    stores.data && contracts.data && applications.data
      ? contracts.data
          .filter((c) => c.contractStatus === 'ACTIVE' && c.startDate <= today && c.endDate >= today && !stores.data.some((s) => s.contractId === c.contractId))
          .flatMap((c) => {
            const a = applications.data.find((x) => x.applicationId === c.applicationId);
            return a && !stores.data.some((s) => s.registrationId === a.registrationId) ? [{ ...c, registrationId: a.registrationId }] : [];
          })
      : [];
  return { stores, contracts, applications, choices, today };
}

/** V34 Cửa hàng (SELL-01): each stall as its shopfront, with menu, ATTP and edit; or how to open one. */
export function StoreScreen() {
  const { stores, contracts, applications, choices, today } = useStoreData();
  const pending = stores.isPending || contracts.isPending || applications.isPending;
  const failed = stores.error ?? contracts.error ?? applications.error;

  return (
    <Screen
      onRefresh={() => void Promise.all([stores.refetch(), contracts.refetch(), applications.refetch()])}
      refreshing={stores.isRefetching}
    >
      <Stack.Screen options={{ title: 'Cửa hàng' }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <BigTile icon={{ sf: 'bag.fill', md: 'shopping_bag' }} label="Đơn hàng" note="Bếp & lấy món" onPress={() => router.navigate('/vendor/orders' as Href)} />
        <BigTile icon={{ sf: 'chart.bar.fill', md: 'bar_chart' }} label="Doanh thu" note="Theo ngày, theo món" onPress={() => go('/vendor/orders/sales-summary')} />
      </View>
      {pending ? (
        <ListSkeleton rows={1} height={300} />
      ) : failed ? (
        <ErrorState error={failed} onRetry={() => void Promise.all([stores.refetch(), contracts.refetch(), applications.refetch()])} />
      ) : (
        <>
          {stores.data!.map((store) => (
            <Facade key={store.storefrontId} store={store} contracts={contracts.data!} />
          ))}
          {choices.length > 0 ? (
            <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.brandTint }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon sf="storefront.fill" md="storefront" size={22} color={colors.primary} />
                <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 16, color: colors.primary }}>
                  {stores.data!.length ? 'Mở thêm gian hàng' : 'Mở gian hàng đầu tiên'}
                </Text>
              </View>
              <Text style={[text.footnote, { color: colors.ink }]}>
                Ô {choices[0]!.slotCode} đang có hợp đồng đến {displayDate(choices[0]!.endDate)} và chưa có gian hàng.
              </Text>
              <Button label="Tạo gian hàng" icon={{ sf: 'plus', md: 'add' }} onPress={() => go('/vendor/home/store/edit?id=new')} />
            </View>
          ) : null}
          {stores.data!.length === 0 && choices.length === 0 ? (
            <StateView
              icon={{ sf: 'storefront', md: 'storefront' }}
              title="Chưa đủ điều kiện mở gian hàng"
              body={eligibilityReason(contracts.data!, today) ?? 'Cần hồ sơ đã duyệt và hợp đồng thuê ô đang hiệu lực.'}
              action={{ label: 'Thuê ô vỉa hè', onPress: () => router.navigate('/vendor/slots' as Href) }}
            />
          ) : null}
          <StartSteps />
        </>
      )}
    </Screen>
  );
}

function BigTile({ icon, label, note, onPress }: { icon: { sf: string; md: string }; label: string; note: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, padding: 14, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={19} color={colors.white} />
      </View>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{label}</Text>
      <Text style={[text.caption, { color: colors.muted }]}>{note}</Text>
    </Pressable>
  );
}

function Facade({ store, contracts }: { store: SellerStore; contracts: RentalChoice[] }) {
  const contract = contractFor(store, contracts);
  const photo = storefrontPhotos({ storefrontId: store.storefrontId, storefrontName: store.name, description: store.description })[0]!;
  const s = statusLabel(store.availabilityStatus);
  return (
    <View style={{ borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
      <View>
        <Image source={photo.source} style={{ height: 160, width: '100%' }} contentFit="cover" transition={150} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 22, flexDirection: 'row' }}>
          {Array.from({ length: 14 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? colors.white : colors.brand, borderBottomLeftRadius: 11, borderBottomRightRadius: 11 }} />
          ))}
        </View>
        {photo.illustrative ? <StockTag style={{ position: 'absolute', right: 10, bottom: 10 }} /> : null}
        {contract ? <SlotPlate code={contract.slotCode} style={{ position: 'absolute', left: 12, bottom: 12 }} /> : null}
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={[text.title3, { flex: 1, color: colors.ink, fontFamily: fonts.heavy }]} numberOfLines={2}>{store.name}</Text>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        {store.description ? <Text style={[text.footnote, { color: colors.muted }]} numberOfLines={3}>{store.description}</Text> : null}
        {contract ? <Text style={[text.caption, { color: colors.muted }]}>Hợp đồng ô đến {displayDate(contract.endDate)}</Text> : null}
        <Button label="Quản lý thực đơn" icon={{ sf: 'menucard.fill', md: 'restaurant_menu' }} onPress={() => go(`/vendor/home/store/menu?storefrontId=${store.storefrontId}`)} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Giấy ATTP" variant="secondary" icon={{ sf: 'checkmark.shield', md: 'verified_user' }} onPress={() => go(`/vendor/home/store/food-safety?storefrontId=${store.storefrontId}`)} style={{ flex: 1 }} />
          <Button label="Sửa" variant="secondary" icon={{ sf: 'pencil', md: 'edit' }} onPress={() => go(`/vendor/home/store/edit?id=${store.storefrontId}`)} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const STEPS = [
  { sf: 'storefront', md: 'storefront', title: 'Mở gian hàng trên ô đã thuê', body: 'Mỗi ô có hợp đồng còn hiệu lực mở được một gian hàng.' },
  { sf: 'camera.fill', md: 'photo_camera', title: 'Thêm món có ảnh thật', body: 'Ảnh món của chính quán giúp khách nhận ra ngay.' },
  { sf: 'checkmark.shield.fill', md: 'verified_user', title: 'Nộp giấy ATTP cho món cần', body: 'Món nước, cơm - bún - phở… chỉ hiện với khách khi có giấy.' },
];

function StartSteps() {
  return (
    <View style={{ gap: 10 }}>
      <SectionHeader title="Bắt đầu bán trong 3 bước" />
      {STEPS.map((s, i) => (
        <View key={s.title} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.subhead, { color: colors.ink }]}>{s.title}</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{s.body}</Text>
          </View>
          <Icon sf={s.sf} md={s.md} size={18} color={colors.muted} />
        </View>
      ))}
    </View>
  );
}

const STATUS_OPTIONS = [
  { key: 'OPEN', label: 'Đang mở' },
  { key: 'PAUSED', label: 'Tạm dừng' },
  { key: 'CLOSED', label: 'Đóng cửa' },
] as const;

/** Create or edit a stall: which slot it stands on (new only), its name, description and status. */
export function StoreEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const cache = useQueryClient();
  const { stores, contracts, applications, choices } = useStoreData();
  const existing = !isNew ? stores.data?.find((s) => s.storefrontId === Number(id)) : undefined;
  const [contractId, setContractId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; status: string } | null>(null);
  const values = form ?? { name: existing?.name ?? '', description: existing?.description ?? '', status: existing?.availabilityStatus ?? 'OPEN' };
  const set = (patch: Partial<typeof values>) => setForm({ ...values, ...patch });
  const selected = choices.find((c) => c.contractId === (contractId ?? choices[0]?.contractId));
  const [nameError, setNameError] = useState<string>();

  const save = useMutation({
    mutationFn: () =>
      sellerStoreApi.saveStore(existing?.storefrontId ?? null, {
        registrationId: existing?.registrationId ?? selected!.registrationId,
        contractId: existing?.contractId ?? selected!.contractId,
        name: values.name.trim(),
        description: values.description.trim() || null,
        availabilityStatus: values.status,
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['commerce'] });
      showToast('Đã lưu gian hàng');
      router.back();
    },
  });

  if (stores.isPending || contracts.isPending || applications.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: isNew ? 'Tạo gian hàng' : 'Sửa gian hàng' }} />
        <ListSkeleton rows={3} height={70} />
      </Screen>
    );
  }
  if (!isNew && !existing) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Sửa gian hàng' }} />
        <ErrorState error={stores.error ?? new Error('Không tìm thấy gian hàng.')} onRetry={() => void stores.refetch()} />
      </Screen>
    );
  }
  if (isNew && choices.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tạo gian hàng' }} />
        <StateView icon={{ sf: 'storefront', md: 'storefront' }} tone="neutral" title="Chưa có ô để mở gian hàng" body="Cần một hợp đồng thuê ô đang hiệu lực chưa có gian hàng." />
      </Screen>
    );
  }
  const submit = () => {
    if (!values.name.trim()) {
      setNameError('Nhập tên gian hàng.');
      return;
    }
    save.mutate();
  };
  const existingContract = existing ? contractFor(existing, contracts.data ?? []) : undefined;

  return (
    <Screen footer={<Button label="Lưu gian hàng" size={56} loading={save.isPending} onPress={submit} />}>
      <Stack.Screen options={{ title: isNew ? 'Tạo gian hàng' : 'Sửa gian hàng' }} />
      {isNew ? (
        <View style={{ gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Ô kinh doanh</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {choices.map((c) => {
              const on = c.contractId === selected?.contractId;
              return (
                <Pressable
                  key={c.contractId}
                  onPress={() => setContractId(c.contractId)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{ padding: 12, gap: 4, borderRadius: 16, borderCurve: 'continuous', backgroundColor: on ? colors.brandTint : colors.card, borderWidth: on ? 2 : 1, borderColor: on ? colors.cta : colors.line }}
                >
                  <SlotPlate code={c.slotCode} />
                  <Text style={[text.caption, { color: colors.muted }]}>đến {displayDate(c.endDate)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : existingContract ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SlotPlate code={existingContract.slotCode} />
          <Text style={[text.footnote, { color: colors.muted }]}>Hợp đồng đến {displayDate(existingContract.endDate)}</Text>
        </View>
      ) : null}
      <TextField
        label="Tên gian hàng"
        value={values.name}
        onChangeText={(v) => {
          set({ name: v });
          setNameError(undefined);
        }}
        placeholder="VD: Bún chả cô Lan"
        error={nameError}
        maxLength={120}
      />
      <TextField label="Mô tả" optional value={values.description} onChangeText={(v) => set({ description: v })} multiline placeholder="Món chính, giờ bán, điểm đặc biệt" maxLength={500} />
      <View style={{ gap: 8 }}>
        <Text style={[text.subhead, { color: colors.ink }]}>Trạng thái</Text>
        <Segments value={values.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS.map((o) => ({ key: o.key, label: o.label }))} />
        {STATUS_CONSEQUENCE[values.status] ? <Text style={[text.footnote, { color: colors.muted }]}>{STATUS_CONSEQUENCE[values.status]}</Text> : null}
      </View>
      {save.isError ? <Banner tone="danger">{errorMessage(save.error)}</Banner> : null}
    </Screen>
  );
}
