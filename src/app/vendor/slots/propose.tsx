import * as Location from 'expo-location';
import { goReplace } from '@/core/navigation/go';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { SelectField } from '@/components/forms/SelectField';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';

const WINDOWS = [
  { value: '05:30 - 10:30', label: 'Sáng 05:30 - 10:30' },
  { value: '16:00 - 22:00', label: 'Chiều tối 16:00 - 22:00' },
];

// Hải Châu 1 centre, used when the device gives no location.
const FALLBACK = { lat: 16.0601, lng: 108.2198 };

export default function ProposeSlotScreen() {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const propose = useMockDb((s) => s.proposeSlot);
  const [street, setStreet] = useState('');
  const [size, setSize] = useState('');
  const [window, setWindow] = useState<string>();
  const [photo, setPhoto] = useState<string>();
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function locate() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return setCoords(FALLBACK);
    try {
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setCoords(FALLBACK);
    }
  }

  function submit() {
    const found: Record<string, string> = {};
    if (!street.trim()) found.street = 'Nhập tên đường';
    const m2 = Number(size.replace(',', '.'));
    if (!m2 || m2 <= 0) found.size = 'Nhập diện tích hợp lệ';
    if (!window) found.window = 'Chọn khung giờ';
    if (!coords) found.coords = 'Chọn vị trí đề xuất';
    setErrors(found);
    if (Object.keys(found).length || !vendorId || !coords) return;
    propose({
      slot_code: `ĐX-${Math.floor(100 + Math.random() * 900)}`,
      ward_unit_type: 'WARD',
      street: street.trim(),
      size_m2: m2,
      price_monthly: 0,
      time_window: window!,
      lat: coords.lat,
      lng: coords.lng,
      proposedByVendorId: vendorId,
    });
    setDone(true);
  }

  if (done) {
    return (
      <>
        <StackHeader title="Đề xuất ô mới" />
        <Screen footer={<Button label="Về Ô thuê" onPress={() => goReplace('/vendor/slots')} />}>
          <SuccessView title="Đã gửi đề xuất" subtitle="Phường sẽ khảo sát vị trí" />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Đề xuất ô mới" />
      <Screen footer={<Button label="Gửi đề xuất" onPress={submit} />}>
        <View style={styles.locate}>
          <Button
            label={coords ? `Đã chọn vị trí (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : 'Dùng vị trí hiện tại'}
            icon="crosshairs-gps"
            variant="outline"
            onPress={locate}
          />
          {errors.coords ? <AppText variant="small" color="error">{errors.coords}</AppText> : null}
        </View>
        <TextField label="Tên đường" icon="road-variant" value={street} onChangeText={setStreet} error={errors.street} />
        <TextField label="Diện tích (m²)" keyboardType="decimal-pad" value={size} onChangeText={setSize} error={errors.size} />
        <SelectField label="Khung giờ bán" value={window} options={WINDOWS} onChange={setWindow} error={errors.window} />
        <View style={styles.photo}>
          <AppText variant="labelSm">Ảnh vỉa hè</AppText>
          <PhotoSlot uri={photo} onChange={setPhoto} />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  locate: { gap: spacing.xs },
  photo: { gap: spacing.sm },
});
