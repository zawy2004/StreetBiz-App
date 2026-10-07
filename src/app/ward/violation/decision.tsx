import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { showError } from '@/components/feedback/Toast';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { isLiveApi } from '@/core/config/env';
import { goRoot } from '@/core/navigation/go';
import { useIssueViolation, useViolationKinds } from '@/features/violation/use-patrol';
import { useViolationDraft } from '@/features/violation/violation-draft';
import { useAuthStore } from '@/store/auth-store';
import { spacing, useTheme } from '@/theme';

/** WARD-10/11 step 2: record the violation and issue the sanction decision. */
export default function ViolationDecisionScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ vendorId: string; slotId: string; contractId: string; name: string }>();
  const user = useAuthStore((s) => s.user);
  const kinds = useViolationKinds().data ?? [];
  const issue = useIssueViolation();
  const draft = useViolationDraft();
  const kind = kinds.find((t) => t.code === draft.violationType);

  const [amount, setAmount] = useState(String(kind?.amount ?? 0));
  const [number, setNumber] = useState(() => `QĐ-${Math.floor(100 + Math.random() * 900)}/XPHC`);
  const [signer, setSigner] = useState(user?.fullName ?? '');
  const [result, setResult] = useState<{ sanctioned: boolean; message?: string }>();
  const [error, setError] = useState<string>();

  async function submit() {
    const fine = isLiveApi ? (kind?.amount ?? 0) : Number(amount.replace(/\D/g, ''));
    if (!kind || !fine || !number.trim() || (!isLiveApi && !signer.trim())) return setError('Nhập đủ số quyết định, người ký và mức phạt');
    try {
      const r = await issue.mutateAsync({
        vendorId: params.vendorId || undefined,
        contractId: params.contractId || undefined,
        slotId: params.slotId || undefined,
        kind,
        note: draft.note.trim(),
        photos: draft.photos.filter((p): p is string => !!p),
        decisionNumber: number.trim(),
        amount: fine,
      });
      draft.reset();
      setResult(r);
    } catch (e) {
      showError(e);
    }
  }

  if (result) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <Screen footer={<Button label="Về tuần tra" onPress={() => goRoot('/ward/patrol')} />}>
          <SuccessView
            title={result.sanctioned ? 'Đã ban hành quyết định' : 'Đã lập biên bản'}
            subtitle={result.sanctioned ? `${number} · ${params.name ?? ''}` : result.message}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Quyết định xử phạt" />
      <Screen footer={<Button label="Ban hành quyết định" loading={issue.isPending} onPress={() => void submit()} />}>
        <Stepper step={2} total={2} />
        <KeyValueCard
          rows={[
            { label: 'Hộ kinh doanh', value: params.name ?? '' },
            { label: 'Vi phạm', value: kind?.label ?? '' },
          ]}
        />
        <Card style={[styles.suggest, { backgroundColor: colors.secondaryBg, borderColor: colors.secondary }]}>
          <AppText variant="small" color="onSecondary">{isLiveApi ? 'Mức phạt theo khung của phường' : 'Mức phạt gợi ý'}</AppText>
          <Money amountVnd={kind?.amount ?? 0} size="lg" />
        </Card>
        {!isLiveApi ? <TextField label="Mức phạt (đ)" keyboardType="number-pad" value={amount} onChangeText={setAmount} /> : null}
        <TextField label="Số quyết định" value={number} onChangeText={setNumber} />
        {!isLiveApi ? <TextField label="Người ký" value={signer} onChangeText={setSigner} /> : null}
        {isLiveApi ? <AppText variant="caption" color="muted">Người ký và chức vụ lấy từ cấu hình của phường trên hệ thống.</AppText> : null}
        {error ? <AppText variant="small" color="error">{error}</AppText> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({ suggest: { borderWidth: 1, gap: spacing.xs } });
