import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { showError, showToast } from '@/components/feedback/Toast';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { SelectField } from '@/components/forms/SelectField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { isLiveApi } from '@/core/config/env';
import { spacing, useTheme } from '@/theme';

import { useArchiveMenuItem, useSaveMenuItem, useSellerCategories, type SellerItem } from './use-store';
import { useMarketplaceGate } from './useMarketplaceGate';

/** Shared add/edit form; pass `item` to edit, omit it to add. */
export function ItemForm({ item }: { item?: SellerItem }) {
  const { colors } = useTheme();
  const { storefront } = useMarketplaceGate();
  const categories = useSellerCategories().data ?? [];
  const save = useSaveMenuItem(storefront?.id);
  const archive = useArchiveMenuItem(storefront?.id);

  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId);
  const [available, setAvailable] = useState(item ? item.available : true);
  const [photo, setPhoto] = useState(item?.imageUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);

  const needsAttp = categories.find((c) => c.id === categoryId)?.requiresFoodSafety;

  async function submit() {
    const found: Record<string, string> = {};
    const amount = Number(price.replace(/\D/g, ''));
    if (!name.trim()) found.name = 'Nhập tên món';
    if (!amount) found.price = 'Nhập giá hợp lệ';
    if (!categoryId) found.category = 'Chọn danh mục';
    // The backend requires a photo for a new dish.
    if (isLiveApi && !item && !photo) found.photo = 'Thêm ảnh món';
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await save.mutateAsync({
        id: item?.id ?? null,
        input: { name: name.trim(), price: amount, description: description.trim(), categoryId: categoryId!, available, photoUri: photo !== item?.imageUrl ? photo : undefined },
      });
      showToast(item ? 'Đã lưu món' : 'Đã thêm món');
      router.back();
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <StackHeader title={item ? 'Sửa món' : 'Thêm món'} />
      <Screen
        footer={
          <>
            <Button label="Lưu" loading={save.isPending} onPress={() => void submit()} />
            {item ? <Button label="Xoá món" variant="danger" loading={archive.isPending} onPress={() => setConfirm(true)} /> : null}
          </>
        }
      >
        <View style={styles.photo}>
          <AppText variant="labelSm">Ảnh món</AppText>
          <PhotoSlot uri={photo} onChange={setPhoto} size={120} />
          {errors.photo ? <AppText variant="small" color="error">{errors.photo}</AppText> : null}
        </View>
        <TextField label="Tên món" value={name} onChangeText={setName} error={errors.name} />
        <TextField label="Giá (đ)" keyboardType="number-pad" value={price} onChangeText={setPrice} error={errors.price} />
        <TextField label="Mô tả ngắn" multiline value={description} onChangeText={setDescription} />
        <SelectField
          label="Danh mục"
          value={categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.requiresFoodSafety ? `${c.name} (cần ATTP)` : c.name }))}
          onChange={setCategoryId}
          error={errors.category}
        />
        {needsAttp ? <AppText variant="caption" color="onSecondary">Món thuộc danh mục này chỉ hiện với người mua khi có chứng nhận ATTP được duyệt.</AppText> : null}
        <View style={styles.switch}>
          <AppText variant="label">Còn hàng</AppText>
          <Switch value={available} onValueChange={setAvailable} trackColor={{ true: colors.primary, false: colors.borderStrong }} accessibilityLabel="Còn hàng" />
        </View>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Xoá món này?"
        description="Món sẽ không còn hiện với người mua."
        confirmLabel="Xoá món"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (item)
            archive.mutateAsync(item.id).then(() => {
              showToast('Đã xoá món');
              router.back();
            }, showError);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  photo: { gap: spacing.sm },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
