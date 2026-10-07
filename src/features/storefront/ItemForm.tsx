import { router } from 'expo-router';
import { useState } from 'react';
import { Switch } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { SelectField } from '@/components/forms/SelectField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMockDb } from '@/mocks/db';
import type { MenuItem } from '@/mocks/types';
import { useTheme } from '@/theme';

import { useMarketplaceGate } from './useMarketplaceGate';

/** Shared add/edit form; pass `item` to edit, omit it to add. */
export function ItemForm({ item }: { item?: MenuItem }) {
  const { colors } = useTheme();
  const gate = useMarketplaceGate();
  const categories = useMockDb((s) => s.foodCategories);
  const add = useMockDb((s) => s.addMenuItem);
  const update = useMockDb((s) => s.updateMenuItem);
  const remove = useMockDb((s) => s.removeMenuItem);

  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId);
  const [available, setAvailable] = useState(item ? item.availability_status === 'AVAILABLE' : true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const found: Record<string, string> = {};
    const amount = Number(price.replace(/\D/g, ''));
    if (!name.trim()) found.name = 'Nhập tên món';
    if (!amount) found.price = 'Nhập giá hợp lệ';
    if (!categoryId) found.category = 'Chọn danh mục';
    setErrors(found);
    if (Object.keys(found).length || !gate.storefront) return;

    const values = {
      name: name.trim(),
      price: amount,
      description: description.trim(),
      categoryId: categoryId!,
      availability_status: available ? ('AVAILABLE' as const) : ('SOLD_OUT' as const),
    };
    if (item) update(item.id, values);
    else add({ ...values, storefrontId: gate.storefront.id });
    router.back();
  }

  return (
    <>
      <StackHeader title={item ? 'Sửa món' : 'Thêm món'} />
      <Screen
        footer={
          <>
            <Button label="Lưu" onPress={save} />
            {item ? (
              <Button
                label="Xoá món"
                variant="danger"
                onPress={() => {
                  remove(item.id);
                  router.back();
                }}
              />
            ) : null}
          </>
        }
      >
        <TextField label="Tên món" value={name} onChangeText={setName} error={errors.name} />
        <TextField label="Giá (đ)" keyboardType="number-pad" value={price} onChangeText={setPrice} error={errors.price} />
        <TextField label="Mô tả ngắn" multiline value={description} onChangeText={setDescription} />
        <SelectField
          label="Danh mục"
          value={categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          onChange={setCategoryId}
          error={errors.category}
        />
        <AppText variant="label">Còn hàng</AppText>
        <Switch
          value={available}
          onValueChange={setAvailable}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          accessibilityLabel="Còn hàng"
        />
      </Screen>
    </>
  );
}
