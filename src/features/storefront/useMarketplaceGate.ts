import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { isLiveApi } from '@/core/config/env';
import { sellerApi, slotsApi, registrationApi } from '@/core/api/vendor-api';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

export type GateStore = {
  id: string;
  name: string;
  description: string;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  /** Demo only; the seller API has no opening hours. */
  openTime?: string;
  closeTime?: string;
  registrationId?: string;
  contractId?: string;
};

/** Which of a seller's storefronts the store/menu screens are working on. */
export const useSelectedStore = create<{ id: string | null; select: (id: string) => void }>((set) => ({
  id: null,
  select: (id) => set({ id }),
}));

const asStatus = (s: string): GateStore['status'] => (s === 'OPEN' ? 'OPEN' : s === 'CLOSED' ? 'CLOSED' : 'PAUSED');

/**
 * BR-48: ordering opens only with an approved registration and an active
 * rental contract. Also hands back the seller's storefront(s) — one per
 * contract on the live backend, one per vendor in the demo data.
 */
export function useMarketplaceGate() {
  const user = useAuthStore((s) => s.user);
  const vendorId = user?.vendorId;
  const registrations = useMockDb((s) => s.registrations);
  const contracts = useMockDb((s) => s.contracts);
  const storefronts = useMockDb((s) => s.storefronts);
  const selectedId = useSelectedStore((s) => s.id);
  const enabled = isLiveApi && user?.role_code === 'VENDOR';

  const liveRegs = useQuery({ queryKey: ['vendor', user?.id, 'registrations'], queryFn: registrationApi.list, enabled });
  const liveContracts = useQuery({ queryKey: ['vendor', user?.id, 'contracts'], queryFn: () => slotsApi.contracts(), enabled });
  const liveStores = useQuery({ queryKey: ['vendor', user?.id, 'stores'], queryFn: sellerApi.stores, enabled });

  if (!isLiveApi) {
    const approved = registrations.find((r) => r.vendorId === vendorId && r.registration_status === 'APPROVED');
    const active = contracts.some((c) => c.vendorId === vendorId && c.contract_status === 'ACTIVE');
    const s = storefronts.find((x) => x.vendorId === vendorId);
    const store: GateStore | undefined = s
      ? { id: s.id, name: s.name, description: s.description, status: s.availability_status, openTime: s.openTime, closeTime: s.closeTime }
      : undefined;
    return {
      open: Boolean(approved) && active,
      storefront: store,
      storefronts: store ? [store] : [],
      vendorId,
      registrationId: approved?.id,
      loading: false,
    };
  }

  const approved = liveRegs.data?.find((r) => r.registrationStatus === 'APPROVED');
  const active = (liveContracts.data ?? []).some((c) => c.contractStatus === 'ACTIVE');
  const stores = (liveStores.data ?? []).map(
    (s): GateStore => ({
      id: String(s.storefrontId),
      name: s.name,
      description: s.description ?? '',
      status: asStatus(s.availabilityStatus),
      registrationId: String(s.registrationId),
      contractId: String(s.contractId),
    }),
  );
  return {
    open: Boolean(approved) && active,
    storefront: stores.find((s) => s.id === selectedId) ?? stores[0],
    storefronts: stores,
    vendorId: user?.id,
    registrationId: approved ? String(approved.registrationId) : undefined,
    loading: liveRegs.isLoading || liveContracts.isLoading || liveStores.isLoading,
  };
}
