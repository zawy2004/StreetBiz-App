import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { useRegistrationDraft } from '@/features/registration/registration-draft';
import { useAuthStore } from '@/store/auth-store';
import { parseDate } from '@/utils/format';

export default function RegistrationOwnerScreen() {
  const draft = useRegistrationDraft();
  const user = useAuthStore((s) => s.user);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function next() {
    const found: Record<string, string> = {};
    const name = (draft.ownerName || user?.fullName || '').trim();
    if (!name) found.name = 'Nhập họ tên chủ hộ';
    if (!/^\d{12}$/.test(draft.idNumber)) found.id = 'Số CCCD gồm 12 số';
    if (!parseDate(draft.birthDate)) found.birth = 'Nhập ngày sinh dạng 25/12/1985';
    setErrors(found);
    if (Object.keys(found).length) return;
    draft.patch({ ownerName: name });
    goTo('/vendor/registrations/new/evidence');
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
        <Stepper step={3} total={4} />
        <TextField label="Họ tên chủ hộ" value={draft.ownerName || user?.fullName || ''} onChangeText={(v) => draft.patch({ ownerName: v })} error={errors.name} />
        <TextField label="Số CCCD" keyboardType="number-pad" maxLength={12} value={draft.idNumber} onChangeText={(v) => draft.patch({ idNumber: v })} error={errors.id} />
        <TextField label="Ngày sinh" icon="calendar-outline" keyboardType="numbers-and-punctuation" placeholder="25/12/1985" value={draft.birthDate} onChangeText={(v) => draft.patch({ birthDate: v })} error={errors.birth} />
        <TextField label="Số điện thoại" readOnly value={user?.phone ?? ''} />
      </Screen>
    </>
  );
}
