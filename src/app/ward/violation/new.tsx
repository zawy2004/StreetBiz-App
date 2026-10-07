import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { RadioRow } from '@/components/forms/Choices';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { useViolationDraft } from '@/features/violation/violation-draft';
import { useMockDb } from '@/mocks/db';
import { spacing } from '@/theme';

export default function RecordViolationScreen() {
  const { vendorId, slotId, permitId } = useLocalSearchParams<{ vendorId: string; slotId: string; permitId: string }>();
  const vendor = useMockDb((s) => s.vendors).find((v) => v.id === vendorId);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === slotId);
  const types = useMockDb((s) => s.violationTypes);
  const draft = useViolationDraft();
  const [error, setError] = useState<string>();

  function next() {
    if (!draft.violationType) return setError('Chọn loại vi phạm');
    goTo(`/ward/violation/decision?vendorId=${vendorId}&slotId=${slotId ?? ''}&permitId=${permitId ?? ''}`);
  }

  return (
    <>
      <StackHeader title="Lập biên bản" />
      <Screen footer={<Button label="Tiếp tục" onPress={next} />}>
        <Stepper step={1} total={2} />
        <Card style={styles.vendor}>
          <AppText variant="label">{vendor?.business_name || vendor?.owner_name}</AppText>
          <AppText variant="small" color="muted">{slot?.slot_code}</AppText>
        </Card>

        <View style={styles.block}>
          <AppText variant="labelSm">Loại vi phạm</AppText>
          {types.map((t) => (
            <RadioRow
              key={t.code}
              label={t.label}
              selected={t.code === draft.violationType}
              onPress={() => {
                draft.patch({ violationType: t.code });
                setError(undefined);
              }}
            />
          ))}
          {error ? <AppText variant="small" color="error">{error}</AppText> : null}
        </View>

        <TextField label="Mô tả" placeholder="Ghi ngắn gọn sự việc" multiline value={draft.note} onChangeText={(v) => draft.patch({ note: v })} />

        <View style={styles.block}>
          <AppText variant="labelSm">Ảnh hiện trường</AppText>
          <View style={styles.photos}>
            {draft.photos.map((uri, i) => (
              <PhotoSlot
                key={i}
                uri={uri}
                size={96}
                onChange={(u) => draft.patch({ photos: draft.photos.map((p, j) => (j === i ? u : p)) })}
              />
            ))}
          </View>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  vendor: { gap: 2 },
  block: { gap: spacing.sm },
  photos: { flexDirection: 'row', gap: spacing.sm },
});
