import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EvidenceList } from '@/features/registration/EvidenceList';
import { EVIDENCE_LABELS, requiredEvidence, type EvidenceKind } from '@/features/registration/registration-draft';
import { useMockDb } from '@/mocks/db';

export default function SupplementEvidenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const registration = useMockDb((s) => s.registrations).find((r) => r.id === id);
  const update = useMockDb((s) => s.updateRegistration);
  const [values, setValues] = useState<Partial<Record<EvidenceKind, string>>>({});

  if (!registration) {
    return (
      <>
        <StackHeader title="Bổ sung giấy tờ" />
        <Screen><EmptyState title="Không tìm thấy hồ sơ" /></Screen>
      </>
    );
  }

  const have = new Set(registration.evidence.map((e) => e.type));
  const missing = requiredEvidence(registration.vendor_type).filter((k) => !have.has(k));
  const kinds = missing.length ? missing : requiredEvidence(registration.vendor_type);
  const ready = kinds.every((k) => values[k]);

  return (
    <>
      <StackHeader title="Bổ sung giấy tờ" />
      <Screen
        footer={
          <Button
            label="Gửi bổ sung"
            disabled={!ready}
            onPress={() => {
              update(registration.id, {
                registration_status: 'UNDER_REVIEW',
                review_note: undefined,
                evidence: [
                  ...registration.evidence.filter((e) => !kinds.includes(e.type as EvidenceKind)),
                  ...kinds.map((k) => ({ type: k, uri: values[k]!, label: EVIDENCE_LABELS[k] })),
                ],
              });
              router.back();
            }}
          />
        }
      >
        <EvidenceList kinds={kinds} values={values} onChange={(k, uri) => setValues((v) => ({ ...v, [k]: uri }))} />
      </Screen>
    </>
  );
}
