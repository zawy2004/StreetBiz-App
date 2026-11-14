import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sideApi, SideApiError, type SlotHold } from '@/core/api/side-api';
import { showToast } from '@/components/feedback/Toast';
import { useAuthStore } from '@/store/auth-store';
import { useRegistrations } from '@/features/business-registrations/useRegistrations';

/**
 * BR-16: the backend only accepts an application against an APPROVED
 * registration, and there is no picker for a vendor to name one by hand -- so
 * the caller's own approved registration is used.
 */
export function useApprovedRegistration() {
  const { registrations } = useRegistrations();
  return registrations.find((r) => r.registrationStatus === 'APPROVED') ?? null;
}

/**
 * The caller's live slot holds, plus take/release. Everything that changes a
 * hold (or an application, which releases it) invalidates the slot lists too,
 * because `holdExpiresAt` on a slot is what tells other vendors it is taken.
 */
export function useHolds() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const registration = useApprovedRegistration();
  const registrationId = registration?.registrationId;

  const holds = useQuery({
    queryKey: ['side', userId, 'holds', registrationId],
    queryFn: () => sideApi.listHolds(registrationId!),
    enabled: registrationId != null,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['side', userId, 'holds'] });
    void queryClient.invalidateQueries({ queryKey: ['side', userId, 'slots'] });
    void queryClient.invalidateQueries({ queryKey: ['side', userId, 'slot'] });
  };

  const onError = (error: unknown) => {
    showToast(error instanceof SideApiError ? error.message : 'Không thực hiện được thao tác giữ chỗ.');
    refresh();
  };

  const hold = useMutation({
    mutationFn: (slotId: number) => sideApi.createHold({ registrationId: registrationId!, slotId }),
    onSuccess: (result) => {
      showToast(result.message);
      refresh();
    },
    onError,
  });

  const release = useMutation({
    mutationFn: (slotId: number) => sideApi.releaseHold(slotId, registrationId!),
    onSuccess: (result) => {
      showToast(result.message);
      refresh();
    },
    onError,
  });

  return {
    registration,
    registrationId,
    holds: (holds.data ?? []) as SlotHold[],
    hold,
    release,
    refresh,
  };
}
