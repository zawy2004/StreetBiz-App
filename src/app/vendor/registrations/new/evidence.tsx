import { router } from 'expo-router';

import { Button } from '@/components/common/Button';
import { Stepper } from '@/components/forms/Stepper';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goReplace } from '@/core/navigation/go';
import { EvidenceList } from '@/features/registration/EvidenceList';
import { EVIDENCE_LABELS, requiredEvidence, useRegistrationDraft } from '@/features/registration/registration-draft';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

export default function RegistrationEvidenceScreen() {
  const draft = useRegistrationDraft();
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const submit = useMockDb((s) => s.submitRegistration);
  const kinds = requiredEvidence(draft.vendorType);
  const complete = kinds.every((k) => draft.evidence[k]);

  function send() {
    if (!vendorId) return;
    const registration = submit({
      vendorId,
      vendor_type: draft.vendorType,
      business_name: draft.businessName.trim(),
      owner_name: draft.ownerName.trim(),
      id_number: draft.idNumber,
      address: draft.address.trim(),
      ward_unit_type: 'WARD',
      fast_track: false,
      evidence: kinds.map((k) => ({ type: k, uri: draft.evidence[k]!, label: EVIDENCE_LABELS[k] })),
    });
    useMockDb.setState((s) => ({
      vendors: s.vendors.map((v) =>
        v.id === vendorId ? { ...v, business_name: registration.business_name, vendor_type: registration.vendor_type, address: registration.address } : v,
      ),
    }));
    draft.reset();
    goReplace(`/vendor/registrations/new/done?id=${registration.id}`);
  }

  return (
    <>
      <StackHeader title="Đăng ký kinh doanh" />
      <Screen
        footer={
          <>
            <Button label="Gửi hồ sơ" disabled={!complete} onPress={send} />
            <Button label="Quay lại" variant="ghost" onPress={() => router.back()} />
          </>
        }
      >
        <Stepper step={4} total={4} />
        <EvidenceList kinds={kinds} values={draft.evidence} onChange={(k, uri) => draft.patch({ evidence: { ...draft.evidence, [k]: uri } })} />
      </Screen>
    </>
  );
}
