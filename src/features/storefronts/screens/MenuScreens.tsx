import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View, useWindowDimensions } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
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
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { PriceSticker } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { buyerVisibility } from '../menu-view';
import { COMMON_UNITS, historyLine, NAME_EN_MAX, PRICE_UNIT_MAX, priceWithUnit } from '../price-board-view';

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

/**
 * A dish on the stall's own menu, drawn like the dish buyers see in Khám phá: the square photo,
 * the price on a mango sticker across its top edge ("Hết món" on a grey one when sold out), the
 * pencil in its corner to edit; under it the name, the ATTP state and the sold-out switch.
 * The photo is never greyed to say "sold out": the sticker and the switch say it in words.
 */
function MenuTile({
  item,
  width,
  busy,
  onEdit,
  onToggle,
}: {
  item: SellerMenuItem;
  width: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const sold = item.availabilityStatus === 'SOLD_OUT';
  const hidden = item.availabilityStatus === 'HIDDEN';
  return (
    <View style={{ width, gap: 8 }}>
      <View style={{ paddingTop: 8 }}>
        <PressableScale
          onPress={onEdit}
          accessibilityLabel={`Sửa món ${item.name}, ${sold ? 'đang hết món' : `${formatVnd(item.unitPrice)} một ${item.priceUnit}`}`}
          style={{ width, aspectRatio: 1, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: item.imageUrl ? colors.sunken : colors.kerbPaint }}
        >
          {item.imageUrl ? (
            <Image source={{ uri: apiAssetUrl(item.imageUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" recyclingKey={item.imageUrl} transition={120} accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.photo, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.brandLight }}>
              <Icon sf="camera.fill" md="photo_camera" size={24} color={colors.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>Thêm ảnh</Text>
            </View>
          )}
          {item.foodSafetyStatus === 'APPROVED' ? (
            <View style={{ position: 'absolute', right: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: 7, minHeight: 24 }}>
              <Icon sf="checkmark.shield.fill" md="verified_user" size={12} color={colors.leaf} />
              <Text style={{ fontFamily: fonts.heavy, fontSize: 11, color: colors.onLeaf }}>ATTP</Text>
            </View>
          ) : null}
          <View style={{ position: 'absolute', right: 8, bottom: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.card }}>
            <Icon sf="pencil" md="edit" size={16} color={colors.ink} />
          </View>
        </PressableScale>
        <PriceSticker
          value={sold ? 'Hết món' : `${formatVnd(item.unitPrice)}/${item.priceUnit}`}
          tilt={-4}
          style={[{ position: 'absolute', top: 0, left: 8 }, sold ? { backgroundColor: colors.sunken } : null]}
        />
      </View>

      <View style={{ gap: 6, paddingHorizontal: 2 }}>
        <View style={{ gap: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.heavy, fontSize: 15.5, lineHeight: 20, color: colors.ink }}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted }}>
            {item.categoryName}
          </Text>
        </View>
        <DishAttp item={item} />
        {hidden ? <StatusPill label="Bị ẩn bởi quản trị" tone="danger" /> : null}
        {!hidden ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 44 }}>
            <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 13.5, color: sold ? colors.onDanger : colors.onLeaf }}>{sold ? 'Đang hết món' : 'Còn món'}</Text>
            <Switch
              value={!sold}
              disabled={busy}
              onValueChange={onToggle}
              trackColor={{ true: colors.leaf, false: colors.line }}
              thumbColor={colors.white}
              accessibilityLabel={sold ? 'Còn hàng trở lại' : 'Đánh dấu hết món'}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** V35 Thực đơn (SELL-02): the stall's few signature dishes, what buyers see, sold-out at a flick. */
export function MenuScreen() {
  const { storefrontId } = useLocalSearchParams<{ storefrontId?: string }>();
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - 32 - 14) / 2);
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
        // The API refuses a dish without its unit; the switch keeps both as they are.
        priceUnit: item.priceUnit,
        nameEn: item.nameEn,
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
        <Skeleton height={150} radius={radius.card} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }} accessibilityLabel="Đang tải">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: tileWidth, gap: 8 }}>
              <Skeleton height={tileWidth} radius={radius.photo} />
              <Skeleton height={14} width="70%" />
            </View>
          ))}
        </View>
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
  const ink = v.storePaused ? colors.onMango : colors.onLeaf;

  return (
    <Screen
      onRefresh={() => void menu.refetch()}
      refreshing={menu.isRefetching}
      gap={20}
      footer={
        full ? undefined : (
          <Button label="Thêm món" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={() => go(`/vendor/home/store/dish?storefrontId=${storeId}&id=new`)} />
        )
      }
    >
      <Stack.Screen options={{ title: 'Thực đơn' }} />
      {stores.data!.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {stores.data!.map((s) => (
            <Chip key={s.storefrontId} label={s.name} selected={s.storefrontId === storeId} onPress={() => router.setParams({ storefrontId: String(s.storefrontId) })} accessibilityRole="radio" />
          ))}
        </View>
      ) : null}

      {/* The stall's tray: how many dishes buyers can see, and a plate for each place on the menu */}
      <View style={{ padding: 18, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: v.storePaused ? colors.mangoTint : colors.leafTint }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            {store ? (
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13.5, color: ink }}>
                {store.name}
              </Text>
            ) : null}
            <Text style={{ fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: ink }}>Món khách đang thấy</Text>
          </View>
          <Text maxFontSizeMultiplier={1.3} style={[sign.figure, tabular, { color: ink }]} accessibilityLabel={`${v.storePaused ? 0 : v.visible} trên ${items.length} món`}>
            {v.storePaused ? 0 : v.visible}/{items.length}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: maxItems }, (_, i) => {
            const dish = items[i];
            return (
              <View key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: radius.sticker, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: dish ? colors.white : 'transparent', borderWidth: dish ? 0 : 2, borderStyle: 'dashed', borderColor: v.storePaused ? colors.mango : colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
                {dish?.imageUrl ? (
                  <Image source={{ uri: apiAssetUrl(dish.imageUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" recyclingKey={dish.imageUrl} />
                ) : dish ? (
                  <Icon sf="fork.knife" md="restaurant" size={16} color={ink} />
                ) : (
                  <Icon sf="plus" md="add" size={14} color={ink} />
                )}
              </View>
            );
          })}
        </View>
        <Text style={[text.footnote, { color: colors.ink }]}>
          {v.storePaused
            ? 'Gian hàng đang tạm dừng nên khách chưa thấy món nào.'
            : full
              ? `Thực đơn đã đủ ${maxItems} món. Gỡ một món để thêm món mới.`
              : `Mỗi gian hàng bán tối đa ${maxItems} món chủ lực để dễ kiểm soát an toàn thực phẩm.`}
          {v.soldOut ? ` ${v.soldOut} món đang hết.` : ''}
        </Text>
      </View>

      {v.needsAttp > 0 ? (
        <Banner tone="danger" title={`${v.needsAttp} món cần giấy ATTP`} action={{ label: 'Nộp giấy ATTP', onPress: () => go(`/vendor/home/store/food-safety?storefrontId=${storeId}`) }}>
          Khách chưa thấy những món này cho đến khi Phường xác nhận giấy.
        </Banner>
      ) : (
        <Pressable
          onPress={() => go(`/vendor/home/store/food-safety?storefrontId=${storeId}`)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, boxShadow: shadow.card })}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.leafTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="checkmark.shield.fill" md="verified_user" size={17} color={colors.leaf} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>Giấy ATTP của gian hàng</Text>
          <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
        </Pressable>
      )}

      {/* The paper price board the law asks for, its QR and its history */}
      <Pressable
        onPress={() => go(`/vendor/home/store/prices?storefrontId=${storeId}`)}
        accessibilityRole="button"
        accessibilityLabel="Bảng giá và lịch sử giá. In bảng giá treo tại quầy"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, boxShadow: shadow.card })}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mangoTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="tag.fill" md="sell" size={17} color={colors.onMango} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>Bảng giá & lịch sử giá</Text>
          <Text style={[text.footnote, { color: colors.muted }]}>In bảng giá có mã QR, treo tại quầy</Text>
        </View>
        <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
      </Pressable>

      {items.length === 0 ? (
        <StateView icon={{ sf: 'fork.knife', md: 'restaurant' }} title="Chưa có món nào" body="Thêm món có ảnh thật của quán để khách nhận ra ngay." />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 22 }}>
          {items.map((item) => (
            <MenuTile
              key={item.menuItemId}
              item={item}
              width={tileWidth}
              busy={switching === item.menuItemId}
              onEdit={() => go(`/vendor/home/store/dish?storefrontId=${storeId}&id=${item.menuItemId}`)}
              onToggle={() => toggle.mutate(item)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * Add or edit one dish: a real photo (required for a new dish), name, price and the unit it is for
 * (required: a posted price names its unit), an English name for visitors (optional), category,
 * description; for a dish already on the board, its latest price changes.
 */
export function DishEditScreen() {
  const { storefrontId, id } = useLocalSearchParams<{ storefrontId?: string; id?: string }>();
  const cache = useQueryClient();
  const { categories, menu, storeId } = useMenuData(storefrontId);
  const editing = id && id !== 'new' ? menu.data?.items.find((i) => i.menuItemId === Number(id)) : undefined;
  const isNew = !id || id === 'new';
  const picker = useFilePicker();
  const [draft, setDraft] = useState<{ name: string; nameEn: string; price: string; unit: string; description: string; categoryId: number | null } | null>(null);
  const values = draft ?? {
    name: editing?.name ?? '',
    nameEn: editing?.nameEn ?? '',
    price: editing ? String(editing.unitPrice) : '',
    unit: editing?.priceUnit ?? '',
    description: editing?.description ?? '',
    categoryId: editing?.categoryId ?? null,
  };
  const set = (patch: Partial<typeof values>) => setDraft({ ...values, ...patch });
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<{ name?: string; price?: string; unit?: string; photo?: string; category?: string }>({});
  // This dish's latest changes, from the same board the price-history screen reads.
  const board = useQuery({ queryKey: ['commerce', 'price-board', storeId], queryFn: () => sellerStoreApi.priceBoard(storeId!), enabled: Boolean(storeId && editing) });
  const dishHistory = editing ? (board.data?.history ?? []).filter((h) => h.menuItemId === editing.menuItemId).slice(0, 3) : [];
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
        priceUnit: values.unit.trim(),
        nameEn: values.nameEn.trim() || null,
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
        <Skeleton height={240} radius={radius.photo} />
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
    if (!values.unit.trim()) next.unit = 'Nhập đơn vị tính, ví dụ ổ, ly, tô.';
    else if (values.unit.trim().length > PRICE_UNIT_MAX) next.unit = `Đơn vị tính tối đa ${PRICE_UNIT_MAX} ký tự.`;
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
  const typedPrice = Number(values.price);

  return (
    <View style={{ flex: 1 }}>
      <Screen footer={<Button label={isNew ? 'Thêm món' : 'Lưu thay đổi'} size={56} loading={save.isPending} onPress={submit} />} gap={18}>
        <Stack.Screen options={{ title: isNew ? 'Thêm món' : 'Sửa món' }} />
        {/* The dish photo, edge to edge, with the price sticker that follows the price being typed */}
        <View style={{ marginHorizontal: -16, marginTop: -16, paddingBottom: 6 }}>
          <Pressable
            onPress={() => void pickPhoto()}
            accessibilityRole="button"
            accessibilityLabel={preview ? 'Đổi ảnh món' : 'Thêm ảnh món'}
            style={{ aspectRatio: 4 / 3, width: '100%', overflow: 'hidden', backgroundColor: preview ? colors.sunken : colors.kerbPaint, alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: preview ? 0 : 2, borderStyle: 'dashed', borderColor: errors.photo ? colors.danger : colors.brandLight }}
          >
            {preview ? (
              <>
                <Image source={{ uri: preview }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
                <View style={{ position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: 14, minHeight: 40, backgroundColor: colors.white, boxShadow: shadow.raised }}>
                  <Icon sf="camera.fill" md="photo_camera" size={15} color={colors.ink} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>Đổi ảnh</Text>
                </View>
              </>
            ) : (
              <>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.glow }}>
                  <Icon sf="camera.fill" md="photo_camera" size={32} color={colors.white} />
                </View>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.primary }}>Chụp ảnh món</Text>
                <Text style={[text.footnote, { color: colors.muted }]}>Ảnh thật, đủ sáng, thấy rõ món</Text>
              </>
            )}
          </Pressable>
          {values.price && typedPrice > 0 ? (
            <PriceSticker value={values.unit.trim() ? `${formatVnd(typedPrice)}/${values.unit.trim()}` : formatVnd(typedPrice)} tilt={-4} style={{ position: 'absolute', left: 16, bottom: 0 }} />
          ) : null}
        </View>
        {errors.photo ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.photo}</Text> : null}
        <TextField label="Tên món" value={values.name} onChangeText={(v) => { set({ name: v }); setErrors((e) => ({ ...e, name: undefined })); }} error={errors.name} placeholder="VD: Bún chả Hà Nội" maxLength={120} />
        <TextField label="Tên tiếng Anh" optional value={values.nameEn} onChangeText={(v) => set({ nameEn: v })} placeholder="VD: Grilled pork with noodles" hint="Hiện dưới tên món trên bảng giá, cho khách nước ngoài." maxLength={NAME_EN_MAX} />
        <TextField
          label="Giá"
          value={values.price}
          onChangeText={(v) => { set({ price: v.replace(/[^0-9]/g, '') }); setErrors((e) => ({ ...e, price: undefined })); }}
          keyboardType="number-pad"
          error={errors.price}
          hint={values.price && Number(values.price) > 0 ? (values.unit.trim() ? priceWithUnit(Number(values.price), values.unit.trim()) : formatVnd(Number(values.price))) : undefined}
          trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>}
        />
        <View style={{ gap: 10 }}>
          <TextField
            label="Đơn vị tính"
            value={values.unit}
            onChangeText={(v) => {
              set({ unit: v });
              setErrors((e) => ({ ...e, unit: undefined }));
            }}
            error={errors.unit}
            placeholder="VD: ổ, ly, tô, kg"
            hint="Bắt buộc: giá niêm yết ghi rõ cho một đơn vị nào."
            maxLength={PRICE_UNIT_MAX}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COMMON_UNITS.map((u) => (
              <Chip
                key={u}
                label={u}
                selected={values.unit.trim() === u}
                accessibilityRole="radio"
                onPress={() => {
                  set({ unit: u });
                  setErrors((e) => ({ ...e, unit: undefined }));
                }}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
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
        {editing && dishHistory.length > 0 ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Lịch sử giá món này</Text>
              <Pressable onPress={() => go(`/vendor/home/store/prices?storefrontId=${storeId}`)} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary }}>Xem tất cả</Text>
              </Pressable>
            </View>
            <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
              {dishHistory.map((h, i) => {
                const line = historyLine(h);
                return (
                  <View key={h.priceHistoryId} accessible style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>{line.title}</Text>
                      <Text style={[text.caption, tabular, { color: colors.muted }]}>{formatVietnamDateTime(h.changedAt)}</Text>
                    </View>
                    <Text style={[text.footnote, tabular, { color: colors.ink }]}>{line.price}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
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
            style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 18, borderRadius: radius.full, backgroundColor: pressed ? colors.dangerTint : 'transparent', opacity: archive.isPending ? 0.6 : 1 })}
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
