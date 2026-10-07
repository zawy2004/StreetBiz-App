import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FOOD_SAFETY_DOCS, useFoodSafety } from '@/features/food-safety/food-safety-store';
import { spacing } from '@/theme';

export default function FoodSafetyApplyScreen() {
  const submit = useFoodSafety((s) => s.submit);
  const [photos, setPhotos] = useState<Record<string, string | undefined>>({});
  const ready = FOOD_SAFETY_DOCS.every((d) => photos[d.key]);

  return (
    <>
      <StackHeader title="Nộp hồ sơ ATTP" />
      <Screen
        footer={
          <Button
            label="Gửi hồ sơ"
            disabled={!ready}
            onPress={() => {
              submit('Hồ sơ an toàn thực phẩm');
              router.back();
            }}
          />
        }
      >
        <View style={styles.list}>
          {FOOD_SAFETY_DOCS.map((d) => (
            <Card key={d.key} style={styles.row}>
              <AppText variant="label" style={styles.label}>{d.label}</AppText>
              <PhotoSlot uri={photos[d.key]} onChange={(uri) => setPhotos((p) => ({ ...p, [d.key]: uri }))} size={72} />
            </Card>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
