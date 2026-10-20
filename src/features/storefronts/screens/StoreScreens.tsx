import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { PressableScale } from '@/components/common/PressableScale';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { SegmentedControl } from '@/components/native/SegmentedControl';
import { StockTag } from '@/components/status/MockBadge';
import { errorMessage } from '@/core/api';
import { sellerStoreApi, type RentalChoice, type SellerStore } from '@/core/api/seller-store-api';
import { statusLabel } from '@/core/constants/status-labels';
import { storefrontPhotos } from '@/features/buyer-discovery/food-photos';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
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

/** The stall's lamp: lit green while open, mango while paused, unlit when closed. */
const LAMP: Record<string, string> = { OPEN: colors.leaf, PAUSED: colors.mango, CLOSED: colors.muted };

/**
 * The stall's own painted sign (v5 "Biển hiệu phố"): its name in street lettering on orange, and
 * a small lamp saying whether buyers can order right now. Used on the shopfront and, live, while
 * the vendor types the name.
 */
function StallSign({ name, status, placeholder }: { name: string; status: string; placeholder?: boolean }) {
  const s = statusLabel(status);
  return (
    <View style={{ backgroundColor: colors.brand, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 28, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.white }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: LAMP[status] ?? colors.muted }} />
        <Text style={{ fontFamily: fonts.heavy, fontSize: 12.5, color: colors.ink }}>{s.label}</Text>
      </View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.3}
        numberOfLines={2}
        style={[sign.title, { color: placeholder ? 'rgba(255,255,255,0.7)' : colors.white }]}
      >
        {name.toLocaleUpperCase('vi-VN')}
      </Text>
    </View>
  );
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
      gap={22}
    >
      <Stack.Screen options={{ title: 'Cửa hàng' }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <BigTile warm icon={{ sf: 'bag.fill', md: 'shopping_bag' }} label="Đơn hàng" note="Bếp và lấy món" onPress={() => router.navigate('/vendor/orders' as Href)} />
        <BigTile icon={{ sf: 'chart.bar.fill', md: 'bar_chart' }} label="Doanh thu" note="Theo ngày, theo món" onPress={() => go('/vendor/orders/sales-summary')} />
      </View>
      {pending ? (
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }} accessibilityLabel="Đang tải">
          <Skeleton height={96} radius={0} />
          <Skeleton height={180} radius={0} style={{ marginTop: 2 }} />
          <View style={{ padding: 16, gap: 10 }}>
            <Skeleton height={16} width="70%" />
            <Skeleton height={50} radius={radius.full} />
          </View>
        </View>
      ) : failed ? (
        <ErrorState error={failed} onRetry={() => void Promise.all([stores.refetch(), contracts.refetch(), applications.refetch()])} />
      ) : (
        <>
          {stores.data!.map((store) => (
            <Facade key={store.storefrontId} store={store} contracts={contracts.data!} />
          ))}
          {choices.length > 0 ? (
            <View style={{ padding: 18, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.kerbPaint, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.brandLight }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Plate code={choices[0]!.slotCode} prefix="Ô" />
                <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>
                  {stores.data!.length ? 'Mở thêm gian hàng' : 'Mở gian hàng đầu tiên'}
                </Text>
              </View>
              <Text style={[text.callout, { color: colors.ink }]}>
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

function BigTile({ icon, label, note, onPress, warm }: { icon: { sf: string; md: string }; label: string; note: string; onPress: () => void; warm?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${label}. ${note}`}
      style={{ flex: 1, minHeight: 120, padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: warm ? colors.cta : colors.card, boxShadow: warm ? shadow.glow : shadow.card }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: warm ? 'rgba(255,255,255,0.24)' : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={22} color={warm ? colors.white : colors.primary} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: warm ? colors.white : colors.ink }}>{label}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: warm ? colors.white : colors.muted }}>{note}</Text>
      </View>
    </PressableScale>
  );
}

/** One stall as its shopfront: the painted sign, the kerb, the photo with its slot plate, then what to do. */
function Facade({ store, contracts }: { store: SellerStore; contracts: RentalChoice[] }) {
  const contract = contractFor(store, contracts);
  const photo = storefrontPhotos({ storefrontId: store.storefrontId, storefrontName: store.name, description: store.description })[0]!;
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
        <StallSign name={store.name} status={store.availabilityStatus} />
        <KerbStrip height={8} segment={20} />
        <View style={{ aspectRatio: 16 / 9, width: '100%', backgroundColor: colors.sunken }}>
          <Image source={photo.source} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
          {photo.illustrative ? <StockTag style={{ right: 12, bottom: 12 }} /> : null}
          {contract ? <Plate code={contract.slotCode} prefix="Ô" style={{ position: 'absolute', left: 12, bottom: 12 }} /> : null}
        </View>
        <View style={{ padding: 18, gap: 14 }}>
          {store.description || contract ? (
            <View style={{ gap: 6 }}>
              {store.description ? (
                <Text style={[text.callout, { color: colors.ink }]} numberOfLines={3}>
                  {store.description}
                </Text>
              ) : null}
              {contract ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon sf="calendar" md="calendar_month" size={14} color={colors.muted} />
                  <Text style={[text.footnote, tabular, { color: colors.muted }]}>Hợp đồng ô đến {displayDate(contract.endDate)}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Button label="Quản lý thực đơn" icon={{ sf: 'menucard.fill', md: 'restaurant_menu' }} onPress={() => go(`/vendor/home/store/menu?storefrontId=${store.storefrontId}`)} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Giấy ATTP" variant="secondary" icon={{ sf: 'checkmark.shield', md: 'verified_user' }} onPress={() => go(`/vendor/home/store/food-safety?storefrontId=${store.storefrontId}`)} style={{ flex: 1, paddingHorizontal: 12 }} />
            <Button label="Sửa" variant="secondary" icon={{ sf: 'pencil', md: 'edit' }} onPress={() => go(`/vendor/home/store/edit?id=${store.storefrontId}`)} style={{ flex: 1, paddingHorizontal: 12 }} />
          </View>
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
    <View style={{ gap: 14 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>
        Bắt đầu bán trong 3 bước
      </Text>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, paddingVertical: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: i === 0 ? colors.cta : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Text maxFontSizeMultiplier={1.3} style={[{ fontFamily: fonts.code, fontSize: 18, lineHeight: 22, color: i === 0 ? colors.white : colors.primary }, tabular]}>{i + 1}</Text>
              </View>
              {i < STEPS.length - 1 ? <View style={{ flex: 1, width: 2, minHeight: 12, marginTop: 4, backgroundColor: colors.brandTint }} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>{s.title}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>{s.body}</Text>
            </View>
            <Icon sf={s.sf} md={s.md} size={18} color={colors.muted} />
          </View>
        ))}
      </View>
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
        <Skeleton height={110} radius={radius.card} />
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
    <Screen footer={<Button label="Lưu gian hàng" size={56} loading={save.isPending} onPress={submit} />} gap={20}>
      <Stack.Screen options={{ title: isNew ? 'Tạo gian hàng' : 'Sửa gian hàng' }} />
      {/* The sign as buyers will read it, painted while the name is typed */}
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', boxShadow: shadow.card }} accessibilityLabel="Biển hiệu xem trước">
        <StallSign name={values.name.trim() || 'Tên gian hàng'} status={values.status} placeholder={!values.name.trim()} />
        <KerbStrip height={8} segment={20} />
      </View>
      {isNew ? (
        <View style={{ gap: 10 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Ô kinh doanh</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {choices.map((c) => {
              const on = c.contractId === selected?.contractId;
              return (
                <Pressable
                  key={c.contractId}
                  onPress={() => setContractId(c.contractId)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Ô ${c.slotCode}, hợp đồng đến ${displayDate(c.endDate)}`}
                  style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, gap: 6, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: on ? colors.brandTint : pressed ? colors.sunken : colors.card, borderWidth: 2, borderColor: on ? colors.cta : colors.line })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Plate code={c.slotCode} prefix="Ô" />
                    {on ? <Icon sf="checkmark.circle.fill" md="check_circle" size={18} color={colors.cta} /> : null}
                  </View>
                  <Text style={[text.caption, tabular, { color: colors.muted }]}>đến {displayDate(c.endDate)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : existingContract ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Plate code={existingContract.slotCode} prefix="Ô" />
          <Text style={[text.footnote, tabular, { color: colors.muted }]}>Hợp đồng đến {displayDate(existingContract.endDate)}</Text>
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
      <View style={{ gap: 10 }}>
        <Text style={[text.subhead, { color: colors.ink }]}>Trạng thái</Text>
        <SegmentedControl value={values.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS.map((o) => ({ key: o.key, label: o.label }))} />
        {STATUS_CONSEQUENCE[values.status] ? <Text style={[text.footnote, { color: colors.muted }]}>{STATUS_CONSEQUENCE[values.status]}</Text> : null}
      </View>
      {save.isError ? <Banner tone="danger">{errorMessage(save.error)}</Banner> : null}
    </Screen>
  );
}
