import { router } from 'expo-router';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { showError } from '@/components/feedback/Toast';
import { Stepper } from '@/components/forms/Stepper';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { isLiveApi } from '@/core/config/env';
import { goReplace } from '@/core/navigation/go';
import { EvidenceList } from '@/features/registration/EvidenceList';
import { requiredEvidence, useRegistrationDraft } from '@/features/registration/registration-draft';
import { useSubmitRegistration } from '@/features/registration/use-registrations';

/** REG-01/02 step 4: attach the documents and submit. */
export default function RegistrationEvidenceScreen() {
  const draft = useRegistrationDraft();
  const submit = useSubmitRegistration();
  const kinds = requiredEvidence(draft.vendorType);
  const complete = kinds.every((k) => draft.evidence[k]);

  async function send() {
    try {
      const id = await submit.mutateAsync({
        vendorType: draft.vendorType,
        businessName: draft.businessName,
        category: draft.category,
        address: draft.address,
        wardUnitId: draft.wardUnitId,
        ownerName: draft.ownerName,
        idNumber: draft.idNumber,
        birthDate: draft.birthDate,
        evidence: draft.evidence,
      });
      draft.reset();
      goReplace(`/vendor/registrations/new/done?id=${id}`);
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <StackHeader title="Đăng ký kinh doanh" />
      <Screen
        footer={
          <>
            <Button label="Gửi hồ sơ" disabled={!complete} loading={submit.isPending} onPress={() => void send()} />
            <Button label="Quay lại" variant="ghost" onPress={() => router.back()} />
          </>
        }
      >
        <Stepper step={4} total={4} />
        <EvidenceList kinds={kinds} values={draft.evidence} onChange={(k, uri) => draft.patch({ evidence: { ...draft.evidence, [k]: uri } })} />
        {isLiveApi ? <AppText variant="caption" color="muted">Ảnh được tải lên khi gửi hồ sơ; mỗi ảnh tối đa 5 MB.</AppText> : null}
      </Screen>
    </>
  );
}
