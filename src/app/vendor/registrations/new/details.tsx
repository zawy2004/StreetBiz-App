import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { SelectField } from '@/components/forms/SelectField';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { authApi } from '@/core/api/auth-api';
import { isLiveApi } from '@/core/config/env';
import { goTo } from '@/core/navigation/go';
import { useCategories } from '@/features/discovery/use-discovery';
import { useRegistrationDraft } from '@/features/registration/registration-draft';
import { useAuthStore } from '@/store/auth-store';

export default function RegistrationDetailsScreen() {
  const draft = useRegistrationDraft();
  const userWard = useAuthStore((s) => s.user?.wardUnitId);
  const categories = useCategories().data ?? [];
  const wards = useQuery({ queryKey: ['wards'], queryFn: authApi.listWards, enabled: isLiveApi, staleTime: Infinity });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const ward = draft.wardUnitId ?? userWard;

  async function fillFromLocation() {
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
    if (!draft.category.trim()) found.category = 'Chọn ngành hàng';
    if (!draft.address.trim()) found.address = 'Nhập địa chỉ kinh doanh';
    if (isLiveApi && !ward) found.ward = 'Chọn phường đăng ký';
    setErrors(found);
    if (Object.keys(found).length) return;
    if (isLiveApi) draft.patch({ wardUnitId: ward });
    goTo('/vendor/registrations/new/owner');
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
        {categories.length ? (
          <SelectField
            label="Ngành hàng"
            value={draft.category || undefined}
            options={categories.map((c) => ({ value: c.name, label: c.name }))}
            onChange={(v) => draft.patch({ category: v })}
            error={errors.category}
          />
        ) : (
          <TextField label="Ngành nghề kinh doanh" placeholder="Bán bánh mì, cà phê…" value={draft.category} onChangeText={(v) => draft.patch({ category: v })} error={errors.category} />
        )}
        {isLiveApi ? (
          <SelectField
            label="Phường"
            value={ward ? String(ward) : undefined}
            options={(wards.data ?? []).map((w) => ({ value: String(w.unitId), label: w.parentName ? `${w.unitName} · ${w.parentName}` : w.unitName }))}
            onChange={(v) => draft.patch({ wardUnitId: Number(v) })}
            error={errors.ward}
          />
        ) : null}
        <TextField label="Địa chỉ kinh doanh" icon="map-marker-outline" value={draft.address} onChangeText={(v) => draft.patch({ address: v })} error={errors.address} />
        <Button label="Dùng vị trí hiện tại" icon="crosshairs-gps" variant="outline" size="sm" fullWidth={false} loading={locating} onPress={() => void fillFromLocation()} />
      </Screen>
    </>
  );
}
