import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EvidenceList } from '@/features/registration/EvidenceList';
import { requiredEvidence, type EvidenceKind } from '@/features/registration/registration-draft';
import { useRegistration, useSupplementEvidence } from '@/features/registration/use-registrations';

/** REG-02/04: add what the ward asked for and send the registration back for review. */
export default function SupplementEvidenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const registration = useRegistration(id);
  const supplement = useSupplementEvidence(id ?? '');
  const [values, setValues] = useState<Partial<Record<EvidenceKind, string>>>({});

  const r = registration.data;
  const have = new Set((r?.evidence ?? []).map((e) => e.kind).filter(Boolean));
  const missing = r ? requiredEvidence(r.vendorType).filter((k) => !have.has(k)) : [];
  const kinds = r ? (missing.length ? missing : requiredEvidence(r.vendorType)) : [];
  const ready = kinds.length > 0 && kinds.every((k) => values[k]);

  return (
    <>
      <StackHeader title="Bổ sung giấy tờ" />
      <Screen
        footer={
          <Button
            label="Gửi bổ sung"
            disabled={!ready}
            loading={supplement.isPending}
            onPress={() =>
              supplement.mutateAsync(values).then(() => {
                showToast('Đã gửi bổ sung, phường sẽ xét lại');
                router.back();
              }, showError)
            }
          />
        }
      >
        <QueryView query={registration}>
          {(v) => (!v ? <EmptyState title="Không tìm thấy hồ sơ" /> : <EvidenceList kinds={kinds} values={values} onChange={(k, uri) => setValues((x) => ({ ...x, [k]: uri }))} />)}
        </QueryView>
      </Screen>
    </>
  );
}
