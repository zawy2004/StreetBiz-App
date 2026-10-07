import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { showError, showToast } from '@/components/feedback/Toast';
import { CheckRow } from '@/components/forms/Choices';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { isLiveApi } from '@/core/config/env';
import { FOOD_SAFETY_DOCS } from '@/features/food-safety/food-safety-store';
import { useSellerMenu, useSubmitFoodSafety } from '@/features/storefront/use-store';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { spacing } from '@/theme';

/** Submit an ATTP filing for some of the storefront's dishes. */
export default function FoodSafetyApplyScreen() {
  const { storefront } = useMarketplaceGate();
  const menu = useSellerMenu(storefront?.id);
  const submit = useSubmitFoodSafety();
  const [photos, setPhotos] = useState<Record<string, string | undefined>>({});
  const [dishes, setDishes] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const needing = (menu.data?.items ?? []).filter((m) => !isLiveApi || m.foodSafety === 'MISSING' || m.foodSafety === 'PENDING');
  const ready = FOOD_SAFETY_DOCS.every((d) => photos[d.key]) && (!isLiveApi || dishes.length > 0);

  async function send() {
    if (!storefront) return;
    try {
      await submit.mutateAsync({
        storeId: storefront.id,
        menuItemIds: dishes,
        note: note.trim(),
        photos: FOOD_SAFETY_DOCS.map((d) => ({ type: d.type, uri: photos[d.key]! })),
      });
      showToast('Đã nộp hồ sơ ATTP');
      router.back();
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <StackHeader title="Nộp hồ sơ ATTP" />
      <Screen footer={<Button label="Gửi hồ sơ" disabled={!ready} loading={submit.isPending} onPress={() => void send()} />}>
        {isLiveApi ? (
          <Section title="Món cần chứng nhận">
            {needing.length ? (
              <Card padded={false} style={styles.dishes}>
                {needing.map((m) => (
                  <CheckRow
                    key={m.id}
                    label={m.name}
                    checked={dishes.includes(m.id)}
                    onToggle={() => setDishes((d) => (d.includes(m.id) ? d.filter((x) => x !== m.id) : [...d, m.id]))}
                  />
                ))}
              </Card>
            ) : (
              <AppText color="muted">Không có món nào đang thiếu chứng nhận ATTP.</AppText>
            )}
          </Section>
        ) : null}

        <Section title="Giấy tờ">
          <View style={styles.list}>
            {FOOD_SAFETY_DOCS.map((d) => (
              <Card key={d.key} style={styles.row}>
                <AppText variant="label" style={styles.label}>{d.label}</AppText>
                <PhotoSlot uri={photos[d.key]} onChange={(uri) => setPhotos((p) => ({ ...p, [d.key]: uri }))} size={72} />
              </Card>
            ))}
          </View>
        </Section>

        <TextField label="Ghi chú cho phường" placeholder="Không bắt buộc" multiline value={note} onChangeText={setNote} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  dishes: { paddingHorizontal: spacing.lg },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
