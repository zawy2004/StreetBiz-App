import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

/** BR-48: ordering opens only with an approved registration and an active rental contract. */
export function useMarketplaceGate() {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const registrations = useMockDb((s) => s.registrations);
  const contracts = useMockDb((s) => s.contracts);
  const storefronts = useMockDb((s) => s.storefronts);

  const approved = registrations.some((r) => r.vendorId === vendorId && r.registration_status === 'APPROVED');
  const active = contracts.some((c) => c.vendorId === vendorId && c.contract_status === 'ACTIVE');
  const storefront = storefronts.find((s) => s.vendorId === vendorId);

  return { open: approved && active, storefront, vendorId };
}
