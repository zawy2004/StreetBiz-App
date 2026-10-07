import { useMemo } from 'react';

import { useMockDb } from '@/mocks/db';
import type { DigitalPermit, SidewalkSlot, Storefront, Vendor } from '@/mocks/types';

export type ActiveVendor = {
  vendor: Vendor;
  slot: SidewalkSlot;
  permit: DigitalPermit;
  storefront?: Storefront;
  rating: number;
  ratingCount: number;
  distanceM: number;
  /** Position on the schematic map, 0..1 from the top-left. */
  pin: { x: number; y: number };
};

// The mock map is schematic, so pins and distances are fixed per slot rather than computed.
const LAYOUT: Record<string, { distanceM: number; pin: { x: number; y: number } }> = {
  'NVL-018': { distanceM: 320, pin: { x: 0.2, y: 0.18 } },
  'NVL-022': { distanceM: 180, pin: { x: 0.62, y: 0.3 } },
  'NVL-024': { distanceM: 250, pin: { x: 0.42, y: 0.55 } },
  'NVL-030': { distanceM: 400, pin: { x: 0.24, y: 0.82 } },
};

const FALLBACK = { distanceM: 500, pin: { x: 0.5, y: 0.5 } };

/** Vendors with an active contract and a valid permit: the only ones buyers may see. */
export function useActiveVendors(): ActiveVendor[] {
  const vendors = useMockDb((s) => s.vendors);
  const contracts = useMockDb((s) => s.contracts);
  const permits = useMockDb((s) => s.permits);
  const slots = useMockDb((s) => s.slots);
  const storefronts = useMockDb((s) => s.storefronts);
  const comments = useMockDb((s) => s.comments);

  return useMemo(() => {
    const list: ActiveVendor[] = [];
    for (const contract of contracts) {
      if (contract.contract_status !== 'ACTIVE') continue;
      const permit = permits.find((p) => p.contractId === contract.id && p.permit_status === 'VALID');
      const vendor = vendors.find((v) => v.id === contract.vendorId);
      const slot = slots.find((s) => s.id === contract.slotId);
      if (!permit || !vendor || !slot) continue;

      const storefront = storefronts.find((s) => s.vendorId === vendor.id);
      const own = comments.filter((c) => c.vendorId === vendor.id);
      const rating = own.length ? own.reduce((n, c) => n + c.rating, 0) / own.length : (storefront?.ratingAvg ?? 0);
      const layout = LAYOUT[slot.slot_code] ?? FALLBACK;

      list.push({
        vendor,
        slot,
        permit,
        storefront,
        rating,
        ratingCount: own.length || (storefront?.ratingCount ?? 0),
        ...layout,
      });
    }
    return list;
  }, [vendors, contracts, permits, slots, storefronts, comments]);
}

export const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
export const formatRating = (n: number) => n.toFixed(1).replace('.', ',');
