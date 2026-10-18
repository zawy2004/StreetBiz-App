import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { apiAssetUrl } from '@/core/api/asset-url';
import { sellerStoreApi, type MenuInput, type SellerMenuItem } from '@/core/api/seller-store-api';
import type { PickedFile } from '@/core/api/upload';
import { formatDay } from '@/features/food-safety/format';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { buyerVisibility } from '../menu-view';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PRICE = 50_000_000;
const go = (href: string) => router.push(href as Href);

function useMenuData(storefrontParam: string | undefined) {
  const stores = useQuery({ queryKey: ['commerce', 'stores'], queryFn: sellerStoreApi.stores });
  const storeId = Number(storefrontParam) || stores.data?.[0]?.storefrontId;
  const categories = useQuery({ queryKey: ['commerce', 'seller-categories'], queryFn: sellerStoreApi.categories });
  const menu = useQuery({ queryKey: ['commerce', 'seller-menu', storeId], queryFn: () => sellerStoreApi.menu(storeId!), enabled: Boolean(storeId) });
  return { stores, categories, menu, storeId };
}

function DishAttp({ item }: { item: SellerMenuItem }) {
  switch (item.foodSafetyStatus) {
    case 'APPROVED':
      return <StatusPill label={`Đạt ATTP đến ${formatDay(item.foodSafetyExpiresOn)}`} tone="ok" />;
    case 'PENDING':
      return <StatusPill label="Chờ duyệt ATTP" tone="pending" />;
    case 'MISSING':
      return <StatusPill label="Cần giấy ATTP" tone="danger" />;
    default:
      return null;
  }
}

/** V35 Thực đơn (SELL-02): the stall's few signature dishes, what buyers see, sold-out at a flick. */
export function MenuScreen() {
  const { storefrontId } = useLocalSearchParams<{ storefrontId?: string }>();
  const cache = useQueryClient();
  const { stores, categories, menu, storeId } = useMenuData(storefrontId);
  const [switching, setSwitching] = useState<number | null>(null);
  const toggle = useMutation({
    mutationFn: (item: SellerMenuItem) =>
      sellerStoreApi.saveItem(storeId!, item.menuItemId, {
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        unitPrice: item.unitPrice,
        availabilityStatus: item.availabilityStatus === 'AVAILABLE' ? 'SOLD_OUT' : 'AVAILABLE',
      }),
    onMutate: (item) => setSwitching(item.menuItemId),
    onSettled: () => setSwitching(null),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['commerce'] });
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  if (stores.isPending || categories.isPending || (storeId && menu.isPending)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thực đơn' }} />
        <ListSkeleton rows={1} height={110} />
        <ListSkeleton rows={3} height={110} />
      </Screen>
    );
  }
  const failed = stores.error ?? categories.error ?? menu.error;
  if (failed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thực đơn' }} />
        <ErrorState error={failed} onRetry={() => void Promise.all([stores.refetch(), categories.refetch(), menu.refetch()])} />
      </Screen>
    );
  }
  if (!storeId) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thực đơn' }} />
        <StateView icon={{ sf: 'storefront', md: 'storefront' }} title="Cần tạo gian hàng trước" body="Thực đơn thuộc về một gian hàng trên ô bạn đã thuê." action={{ label: 'Mở Cửa hàng', onPress: () => router.back() }} />
      </Screen>
    );
  }
  const items = menu.data?.items ?? [];
  const maxItems = menu.data?.maxItems ?? 5;
  const full = items.length >= maxItems;
  const store = stores.data!.find((s) => s.storefrontId === storeId);
  const v = buyerVisibility(items, store?.availabilityStatus);

  return (
    <Screen
      onRefresh={() => void menu.refetch()}
      refreshing={menu.isRefetching}
      footer={
        full ? undefined : (
          <Button label="Thêm món" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={() => go(`/vendor/home/store/dish?storefrontId=${storeId}&id=new`)} />
        )
      }
    >
      <Stack.Screen options={{ title: store ? `Thực đơn · ${store.name}` : 'Thực đơn' }} />
      {stores.data!.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {stores.data!.map((s) => (
            <Chip key={s.storefrontId} label={s.name} selected={s.storefrontId === storeId} onPress={() => router.setParams({ storefrontId: String(s.storefrontId) })} accessibilityRole="radio" />
          ))}
        </View>
      ) : null}

      <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: v.storePaused ? colors.mangoTint : colors.leafTint }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={[{ fontFamily: fonts.code, fontSize: 30, color: v.storePaused ? colors.onMango : colors.onLeaf }, tabular]}>
            {v.storePaused ? 0 : v.visible}/{items.length}
          </Text>
          <Text style={[text.subhead, { color: v.storePaused ? colors.onMango : colors.onLeaf }]}>món khách đang thấy</Text>
        </View>
        {/* Slots for the stall's dishes: filled plates and empty ones, up to the limit. */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: maxItems }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < items.length ? (v.storePaused ? colors.mango : colors.leaf) : colors.white }} />
          ))}
        </View>
        <Text style={[text.footnote, { color: colors.ink }]}>
          {v.storePaused
            ? 'Gian hàng đang tạm dừng nên khách chưa thấy món nào.'
            : `Mỗi gian hàng bán tối đa ${maxItems} món chủ lực để dễ kiểm soát an toàn thực phẩm.`}
          {v.soldOut ? ` ${v.soldOut} món đang hết.` : ''}
        </Text>
      </View>
      {v.needsAttp > 0 ? (
        <Banner tone="danger" title={`${v.needsAttp} món cần giấy ATTP`} action={{ label: 'Nộp giấy ATTP', onPress: () => go(`/vendor/home/store/food-safety?storefrontId=${storeId}`) }}>
          Khách chưa thấy những món này cho đến khi Phường xác nhận giấy.
        </Banner>
      ) : (
        <Pressable onPress={() => go(`/vendor/home/store/food-safety?storefrontId=${storeId}`)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <Icon sf="checkmark.shield" md="verified_user" size={16} color={colors.primary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Giấy ATTP của gian hàng</Text>
        </Pressable>
      )}
      {full ? <Banner tone="neutral" title={`Thực đơn đã đủ ${maxItems} món`}>Gỡ một món để thêm món mới.</Banner> : null}

      {items.length === 0 ? (
        <StateView icon={{ sf: 'fork.knife', md: 'restaurant' }} title="Chưa có món nào" body="Thêm món có ảnh thật của quán để khách nhận ra ngay." />
      ) : (
        items.map((item) => {
          const sold = item.availabilityStatus === 'SOLD_OUT';
          const hidden = item.availabilityStatus === 'HIDDEN';
          return (
            <View key={item.menuItemId} style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
              <Pressable onPress={() => go(`/vendor/home/store/dish?storefrontId=${storeId}&id=${item.menuItemId}`)} accessibilityRole="button" accessibilityLabel={`Sửa món ${item.name}`}>
                <View style={{ width: 92, height: 92, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                  {item.imageUrl ? (
                    <Image source={{ uri: apiAssetUrl(item.imageUrl) }} style={{ width: '100%', height: '100%', opacity: sold ? 0.45 : 1 }} contentFit="cover" recyclingKey={item.imageUrl} transition={120} />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <Icon sf="camera" md="photo_camera" size={20} color={colors.primary} />
                      <Text style={[text.caption, { color: colors.primary }]}>Thêm ảnh</Text>
                    </View>
                  )}
                  {sold ? (
                    <View style={{ position: 'absolute', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.plate }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.white }}>HẾT MÓN</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[text.headline, { color: colors.ink }]} numberOfLines={2}>{item.name}</Text>
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 15.5, color: colors.primary }, tabular]}>{formatVnd(item.unitPrice)}</Text>
                <Text style={[text.caption, { color: colors.muted }]}>{item.categoryName}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <DishAttp item={item} />
                  {hidden ? <StatusPill label="Bị ẩn bởi quản trị" tone="danger" /> : null}
                </View>
                {!hidden ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={[text.footnote, { color: sold ? colors.onDanger : colors.onLeaf, fontFamily: fonts.semibold }]}>{sold ? 'Đang hết món' : 'Còn món'}</Text>
                    <Switch
                      value={!sold}
                      disabled={switching === item.menuItemId}
                      onValueChange={() => toggle.mutate(item)}
                      trackColor={{ true: colors.leaf, false: colors.line }}
                      thumbColor={colors.white}
                      accessibilityLabel={sold ? 'Còn hàng trở lại' : 'Đánh dấu hết món'}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

/** Add or edit one dish: a real photo (required for a new dish), name, price, category, description. */
export function DishEditScreen() {
  const { storefrontId, id } = useLocalSearchParams<{ storefrontId?: string; id?: string }>();
  const cache = useQueryClient();
  const { categories, menu, storeId } = useMenuData(storefrontId);
  const editing = id && id !== 'new' ? menu.data?.items.find((i) => i.menuItemId === Number(id)) : undefined;
  const isNew = !id || id === 'new';
  const picker = useFilePicker();
  const [draft, setDraft] = useState<{ name: string; price: string; description: string; categoryId: number | null } | null>(null);
  const values = draft ?? {
    name: editing?.name ?? '',
    price: editing ? String(editing.unitPrice) : '',
    description: editing?.description ?? '',
    categoryId: editing?.categoryId ?? null,
  };
  const set = (patch: Partial<typeof values>) => setDraft({ ...values, ...patch });
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<{ name?: string; price?: string; photo?: string; category?: string }>({});
  const categoryId = values.categoryId ?? categories.data?.[0]?.categoryId ?? null;
  const category = categories.data?.find((c) => c.categoryId === categoryId);

  const save = useMutation({
    mutationFn: async () => {
      const imageUrl = photo ? (await sellerStoreApi.uploadMenuImage(photo)).fileUrl : undefined;
      const input: MenuInput = {
        categoryId: categoryId!,
        name: values.name.trim(),
        description: values.description.trim() || null,
        unitPrice: Number(values.price),
        availabilityStatus: editing?.availabilityStatus ?? 'AVAILABLE',
        ...(imageUrl ? { imageUrl } : {}),
      };
      return sellerStoreApi.saveItem(storeId!, editing?.menuItemId ?? null, input);
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['commerce'] });
      showToast('Đã lưu món');
      router.back();
    },
  });
  const archive = useMutation({
    mutationFn: () => sellerStoreApi.archiveItem(storeId!, editing!.menuItemId),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['commerce'] });
      showToast('Đã gỡ món');
      router.back();
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  if (categories.isPending || menu.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: isNew ? 'Thêm món' : 'Sửa món' }} />
        <ListSkeleton rows={1} height={200} />
        <ListSkeleton rows={3} height={64} />
      </Screen>
    );
  }
  if (!isNew && !editing) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Sửa món' }} />
        <ErrorState error={menu.error ?? new Error('Không tìm thấy món.')} onRetry={() => void menu.refetch()} />
      </Screen>
    );
  }

  const submit = () => {
    const amount = Number(values.price);
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = 'Nhập tên món.';
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_PRICE) next.price = 'Giá là số nguyên, từ 1 đến 50.000.000 đ.';
    if (!categoryId) next.category = 'Chọn danh mục.';
    if (isNew && !photo) next.photo = 'Món mới cần ảnh thật của quán.';
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };
  const pickPhoto = async () => {
    const file = await picker.pick(editing ? 'Đổi ảnh món' : 'Ảnh món', false);
    if (!file) return;
    if (file.size != null && file.size > MAX_PHOTO_BYTES) {
      setErrors((e) => ({ ...e, photo: 'Ảnh lớn hơn 5 MB. Chọn ảnh nhỏ hơn.' }));
      return;
    }
    setPhoto(file);
    setErrors((e) => ({ ...e, photo: undefined }));
  };
  const preview = photo?.uri ?? (editing?.imageUrl ? apiAssetUrl(editing.imageUrl) : undefined);

  return (
    <View style={{ flex: 1 }}>
      <Screen footer={<Button label={isNew ? 'Thêm món' : 'Lưu thay đổi'} size={56} loading={save.isPending} onPress={submit} />}>
        <Stack.Screen options={{ title: isNew ? 'Thêm món' : 'Sửa món' }} />
        <Pressable
          onPress={() => void pickPhoto()}
          accessibilityRole="button"
          accessibilityLabel={preview ? 'Đổi ảnh món' : 'Thêm ảnh món'}
          style={{ height: 210, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: preview ? colors.card : colors.kerbPaint, borderWidth: preview ? 0 : 2, borderStyle: 'dashed', borderColor: errors.photo ? colors.danger : colors.brandLight, alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {preview ? (
            <>
              <Image source={{ uri: preview }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(17,28,43,0.7)' }}>
                <Icon sf="camera.fill" md="photo_camera" size={13} color={colors.white} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>Đổi ảnh</Text>
              </View>
            </>
          ) : (
            <>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="camera.fill" md="photo_camera" size={26} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>Chụp ảnh món</Text>
              <Text style={[text.caption, { color: colors.muted }]}>Ảnh thật, đủ sáng, thấy rõ món</Text>
            </>
          )}
        </Pressable>
        {errors.photo ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.photo}</Text> : null}
        <TextField label="Tên món" value={values.name} onChangeText={(v) => { set({ name: v }); setErrors((e) => ({ ...e, name: undefined })); }} error={errors.name} placeholder="VD: Bún chả Hà Nội" maxLength={120} />
        <TextField
          label="Giá"
          value={values.price}
          onChangeText={(v) => { set({ price: v.replace(/[^0-9]/g, '') }); setErrors((e) => ({ ...e, price: undefined })); }}
          keyboardType="number-pad"
          error={errors.price}
          hint={values.price && Number(values.price) > 0 ? formatVnd(Number(values.price)) : undefined}
          trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>}
        />
        <View style={{ gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Danh mục</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.data?.map((c) => (
              <Chip key={c.categoryId} label={c.name} selected={c.categoryId === categoryId} onPress={() => set({ categoryId: c.categoryId })} accessibilityRole="radio" />
            ))}
          </View>
          {errors.category ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.category}</Text> : null}
          {category?.requiresFoodSafety ? (
            <Banner tone="warning" icon={{ sf: 'checkmark.shield', md: 'verified_user' }}>Danh mục này cần giấy ATTP. Món chỉ hiện với khách khi Phường xác nhận giấy.</Banner>
          ) : null}
        </View>
        <TextField label="Mô tả món" optional value={values.description} onChangeText={(v) => set({ description: v })} multiline placeholder="Thành phần, khẩu vị, phần ăn" maxLength={500} />
        {save.isError ? <Banner tone="danger">{errorMessage(save.error)}</Banner> : null}
        {editing ? (
          <Pressable
            onPress={() =>
              Alert.alert('Gỡ món này?', `${editing.name} sẽ không còn trong thực đơn.`, [
                { text: 'Giữ món', style: 'cancel' },
                { text: 'Gỡ món', style: 'destructive', onPress: () => archive.mutate() },
              ])
            }
            disabled={archive.isPending}
            accessibilityRole="button"
            style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16, opacity: pressed || archive.isPending ? 0.6 : 1 })}
          >
            <Icon sf="trash" md="delete" size={16} color={colors.danger} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger }}>Gỡ món khỏi thực đơn</Text>
          </Pressable>
        ) : null}
      </Screen>
      {picker.sheet}
    </View>
  );
}
