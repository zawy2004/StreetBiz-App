import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { SelectField } from '@/components/forms/SelectField';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { useRegistrationDraft } from '@/features/registration/registration-draft';
import { useMockDb } from '@/mocks/db';

export default function RegistrationDetailsScreen() {
  const draft = useRegistrationDraft();
  const categories = useMockDb((s) => s.foodCategories);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);

  async function useMyLocation() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      const text = [place?.streetNumber, place?.street, place?.district].filter(Boolean).join(' ');
      if (text) draft.patch({ address: text });
    } catch {
      // Keep whatever the user typed when the device cannot resolve an address.
    } finally {
      setLocating(false);
    }
  }

  function next() {
    const found: Record<string, string> = {};
    if (!draft.businessName.trim()) found.name = 'Nhập tên hộ kinh doanh';
    if (!draft.category) found.category = 'Chọn ngành hàng';
    if (!draft.address.trim()) found.address = 'Nhập địa chỉ kinh doanh';
    setErrors(found);
    if (!Object.keys(found).length) goTo('/vendor/registrations/new/owner');
  }

  return (
    <>
      <StackHeader title="Đăng ký kinh doanh" />
      <Screen
        footer={
          <>
            <Button label="Tiếp tục" onPress={next} />
            <Button label="Quay lại" variant="ghost" onPress={() => router.back()} />
          </>
        }
      >
        <Stepper step={2} total={4} />
        <TextField label="Tên hộ kinh doanh" value={draft.businessName} onChangeText={(v) => draft.patch({ businessName: v })} error={errors.name} />
        <SelectField
          label="Ngành hàng"
          value={draft.category}
          options={categories.map((c) => ({ value: c.name, label: c.name }))}
          onChange={(v) => draft.patch({ category: v })}
          error={errors.category}
        />
        <TextField label="Địa chỉ kinh doanh" icon="map-marker-outline" value={draft.address} onChangeText={(v) => draft.patch({ address: v })} error={errors.address} />
        <Button label="Dùng vị trí hiện tại" icon="crosshairs-gps" variant="outline" size="sm" fullWidth={false} loading={locating} onPress={useMyLocation} />
      </Screen>
    </>
  );
}
