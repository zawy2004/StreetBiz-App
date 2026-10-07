import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { goRoot } from '@/core/navigation/go';
import { useViolationDraft } from '@/features/violation/violation-draft';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing, useTheme } from '@/theme';

export default function ViolationDecisionScreen() {
  const { colors } = useTheme();
  const { vendorId, slotId } = useLocalSearchParams<{ vendorId: string; slotId: string }>();
  const user = useAuthStore((s) => s.user);
  const vendor = useMockDb((s) => s.vendors).find((v) => v.id === vendorId);
  const types = useMockDb((s) => s.violationTypes);
  const record = useMockDb((s) => s.recordViolation);
  const draft = useViolationDraft();
  const type = types.find((t) => t.code === draft.violationType);

  const [amount, setAmount] = useState(String(type?.default_amount ?? 0));
  const [number, setNumber] = useState(() => `QĐ-${Math.floor(100 + Math.random() * 900)}/HC1`);
  const [signer, setSigner] = useState(user?.fullName ?? '');
  const [title, setTitle] = useState('Chủ tịch UBND phường');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  function issue() {
    const fine = Number(amount.replace(/\D/g, ''));
    if (!fine || !signer.trim() || !number.trim()) return setError('Nhập đủ số quyết định, người ký và mức phạt');
    if (!vendorId) return;
    record(
      {
        vendorId,
        slotId: slotId || undefined,
        violation_type: draft.violationType,
        note: [type?.label, draft.note.trim()].filter(Boolean).join('. '),
        photoUris: draft.photos.filter((p): p is string => !!p),
        reportedBy: 'WARD',
      },
      fine,
    );
    draft.reset();
    setDone(true);
  }

  if (done) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <Screen
          footer={
            <Button
              label="Về tuần tra"
              onPress={() => {
                goRoot('/ward/patrol');
              }}
            />
          }
        >
          <SuccessView title="Đã ban hành quyết định" subtitle={`${number} · ${vendor?.business_name ?? ''}`} />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Quyết định xử phạt" />
      <Screen footer={<Button label="Ban hành quyết định" onPress={issue} />}>
        <Stepper step={2} total={2} />
        <KeyValueCard
          rows={[
            { label: 'Hộ kinh doanh', value: vendor?.business_name ?? '' },
            { label: 'Vi phạm', value: type?.label ?? '' },
          ]}
        />
        <Card style={[styles.suggest, { backgroundColor: colors.secondaryBg, borderColor: colors.secondary }]}>
          <AppText variant="small" color="onSecondary">Mức phạt gợi ý</AppText>
          <Money amountVnd={type?.default_amount ?? 0} size="lg" />
        </Card>
        <TextField label="Mức phạt (đ)" keyboardType="number-pad" value={amount} onChangeText={setAmount} />
        <TextField label="Số quyết định" value={number} onChangeText={setNumber} />
        <TextField label="Người ký" value={signer} onChangeText={setSigner} />
        <TextField label="Chức vụ" value={title} onChangeText={setTitle} />
        {error ? <AppText variant="small" color="error">{error}</AppText> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({ suggest: { borderWidth: 1, gap: spacing.xs } });
