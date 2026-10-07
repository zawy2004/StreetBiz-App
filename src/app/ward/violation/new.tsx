import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { QueryView } from '@/components/feedback/States';
import { RadioRow } from '@/components/forms/Choices';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { useViolationKinds } from '@/features/violation/use-patrol';
import { useViolationDraft } from '@/features/violation/violation-draft';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

/** WARD-09 step 1: what was violated, with notes and photos. */
export default function RecordViolationScreen() {
  const params = useLocalSearchParams<{ vendorId: string; slotId: string; permitId: string; contractId: string; name: string; slot: string }>();
  const kinds = useViolationKinds();
  const draft = useViolationDraft();
  const [error, setError] = useState<string>();

  function next() {
    if (!draft.violationType) return setError('Chọn loại vi phạm');
    goTo(`/ward/violation/decision?${new URLSearchParams(params as Record<string, string>).toString()}`);
  }

  return (
    <>
      <StackHeader title="Lập biên bản" />
      <Screen footer={<Button label="Tiếp tục" onPress={next} />}>
        <Stepper step={1} total={2} />
        <Card style={styles.vendor}>
          <AppText variant="label">{params.name}</AppText>
          <AppText variant="small" color="muted">{params.slot}</AppText>
        </Card>

        <View style={styles.block}>
          <AppText variant="labelSm">Loại vi phạm</AppText>
          <QueryView query={kinds}>
            {(list) => (
              <>
                {list.map((t) => (
                  <RadioRow
                    key={t.code}
                    label={`${t.label} · ${formatVnd(t.amount)}`}
                    selected={t.code === draft.violationType}
                    onPress={() => {
                      draft.patch({ violationType: t.code, scheduleId: t.scheduleId });
                      setError(undefined);
                    }}
                  />
                ))}
              </>
            )}
          </QueryView>
          {error ? <AppText variant="small" color="error">{error}</AppText> : null}
        </View>

        <TextField label="Mô tả" placeholder="Ghi ngắn gọn sự việc" multiline value={draft.note} onChangeText={(v) => draft.patch({ note: v })} />

        <View style={styles.block}>
          <AppText variant="labelSm">Ảnh hiện trường</AppText>
          <View style={styles.photos}>
            {draft.photos.map((uri, i) => (
              <PhotoSlot key={i} uri={uri} size={96} onChange={(u) => draft.patch({ photos: draft.photos.map((p, j) => (j === i ? u : p)) })} />
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
