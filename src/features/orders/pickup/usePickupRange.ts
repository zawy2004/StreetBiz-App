import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { isLiveApi } from '@/core/config/env';
import { orderApi } from '../api/orderApi';
import type { PickupLocation } from '../types/order.types';
import { evaluatePickupRange } from './pickup-range';
import { useLivePosition } from './useLivePosition';

export const pickupRangeKey = (storefrontId: number | string) =>
  ['orders', 'pickup-range', String(storefrontId)] as const;

/**
 * ORD-01 at checkout: follows the customer's position and judges it against the stall's pickup
 * range as they move. `canOrder` gates the pay button; `location` is what checkout sends, so the
 * server re-checks the very position the screen showed.
 */
export function usePickupRange(storefrontId: number | undefined) {
  const info = useQuery({
    queryKey: pickupRangeKey(storefrontId ?? ''),
    queryFn: () => orderApi.pickupRange(storefrontId!),
    enabled: isLiveApi && Boolean(storefrontId),
    // The slot does not move and the rule is configuration: one read per visit is plenty.
    staleTime: 5 * 60_000,
  });
  // Until the rule is known, assume it applies: asking for location early costs nothing, while
  // finding out at the pay button that it was needed costs the customer a failed tap.
  const enforced = info.data?.enforced ?? true;
  const live = useLivePosition(isLiveApi && Boolean(storefrontId) && enforced);

  const verdict = useMemo(
    () => (info.data && live.fix ? evaluatePickupRange(info.data, live.fix) : null),
    [info.data, live.fix],
  );

  const location: PickupLocation | undefined = live.fix
    ? {
        latitude: live.fix.latitude,
        longitude: live.fix.longitude,
        accuracyMeters: live.fix.accuracyMeters,
      }
    : undefined;

  // Without the rule (network error) the server still decides; a position is all it needs.
  const canOrder = info.data
    ? !info.data.enforced || verdict?.status === 'WITHIN'
    : info.isError && Boolean(location);

  return { info, live, verdict, location, canOrder, enforced };
}
