import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { showError } from '@/components/feedback/Toast';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { SelectField } from '@/components/forms/SelectField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { isLiveApi } from '@/core/config/env';
import { goReplace } from '@/core/navigation/go';
import { useProposeSlot } from '@/features/slots/use-rentals';
import { spacing } from '@/theme';

const WINDOWS = [
  { value: '05:30 - 10:30', label: 'Sáng 05:30 - 10:30' },
  { value: '16:00 - 22:00', label: 'Chiều tối 16:00 - 22:00' },
];

// Hải Châu 1 centre, used when the device gives no location.
const FALLBACK = { lat: 16.0601, lng: 108.2198 };

const meters = (text: string) => Number(text.replace(',', '.'));

/** SIDE-11: propose a new slot where the vendor stands; the ward surveys it. */
export default function ProposeSlotScreen() {
  const propose = useProposeSlot();
  const [street, setStreet] = useState('');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
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

  async function submit() {
    const found: Record<string, string> = {};
    if (!isLiveApi && !street.trim()) found.street = 'Nhập tên đường';
    if (!(meters(width) > 0)) found.width = 'Nhập chiều rộng';
    if (!(meters(length) > 0)) found.length = 'Nhập chiều dài';
    if (!isLiveApi && !window) found.window = 'Chọn khung giờ';
    if (isLiveApi && !photo) found.photo = 'Cần ảnh chụp vị trí';
    if (!coords) found.coords = 'Chọn vị trí đề xuất';
    setErrors(found);
    if (Object.keys(found).length || !coords) return;
    try {
      await propose.mutateAsync({ street: street.trim(), width: meters(width), length: meters(length), timeWindow: window, lat: coords.lat, lng: coords.lng, photoUri: photo });
      setDone(true);
    } catch (e) {
      showError(e);
    }
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
      <Screen footer={<Button label="Gửi đề xuất" loading={propose.isPending} onPress={() => void submit()} />}>
        <View style={styles.locate}>
          <Button
            label={coords ? `Đã chọn vị trí (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : 'Dùng vị trí hiện tại'}
            icon="crosshairs-gps"
            variant="outline"
            onPress={() => void locate()}
          />
          {errors.coords ? <AppText variant="small" color="error">{errors.coords}</AppText> : null}
          {isLiveApi ? <AppText variant="caption" color="muted">Vị trí cần nằm trên tuyến phố phường đang quản lý.</AppText> : null}
        </View>
        {!isLiveApi ? <TextField label="Tên đường" icon="road-variant" value={street} onChangeText={setStreet} error={errors.street} /> : null}
        <View style={styles.size}>
          <View style={styles.half}>
            <TextField label="Chiều rộng (m)" keyboardType="decimal-pad" value={width} onChangeText={setWidth} error={errors.width} />
          </View>
          <View style={styles.half}>
            <TextField label="Chiều dài (m)" keyboardType="decimal-pad" value={length} onChangeText={setLength} error={errors.length} />
          </View>
        </View>
        {!isLiveApi ? <SelectField label="Khung giờ bán" value={window} options={WINDOWS} onChange={setWindow} error={errors.window} /> : null}
        <View style={styles.photo}>
          <AppText variant="labelSm">Ảnh vỉa hè</AppText>
          <PhotoSlot uri={photo} onChange={setPhoto} />
          {errors.photo ? <AppText variant="small" color="error">{errors.photo}</AppText> : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  locate: { gap: spacing.xs },
  size: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  photo: { gap: spacing.sm },
});
