import { formatDistance } from '@/features/buyer-discovery/discovery-format';
import type { PickupLocation, PickupRangeInfo } from '../types/order.types';

/**
 * ORD-01, client side. Orders are pickup-only, so a customer may only order from a stall within
 * `radiusMeters` of where they stand. The server makes the binding decision at checkout
 * (StreetBiz-BE `PickupRangeRules`); this mirror only lets the checkout screen explain it live,
 * while the customer is still moving, instead of after a refused tap. Same formula, same numbers
 * (they come from the server's pickup-range endpoint), same test cases on both sides.
 */
export type PickupRangeStatus = 'WITHIN' | 'OUT_OF_RANGE' | 'INACCURATE';

export type PickupRangeVerdict = {
  status: PickupRangeStatus;
  distanceMeters: number;
  radiusMeters: number;
  accuracyMeters: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle (Haversine) distance in meters, as StreetBiz-BE's GeoMath computes it. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * A position vaguer than `maxAccuracyMeters` decides nothing; otherwise up to
 * `accuracyAllowanceMeters` of the reported GPS error counts in the customer's favour.
 */
export function evaluatePickupRange(
  range: Pick<
    PickupRangeInfo,
    'pickupPoint' | 'radiusMeters' | 'accuracyAllowanceMeters' | 'maxAccuracyMeters'
  >,
  fix: PickupLocation,
): PickupRangeVerdict {
  const distance = haversineMeters(range.pickupPoint, fix);
  const accuracy = Math.max(0, fix.accuracyMeters);
  const allowance = Math.min(accuracy, range.accuracyAllowanceMeters);
  const status: PickupRangeStatus =
    accuracy > range.maxAccuracyMeters
      ? 'INACCURATE'
      : distance - allowance <= range.radiusMeters
        ? 'WITHIN'
        : 'OUT_OF_RANGE';
  return {
    status,
    distanceMeters: Math.round(distance),
    radiusMeters: range.radiusMeters,
    accuracyMeters: Math.ceil(accuracy),
  };
}

/** "650 m", "2,4 km", with a non-breaking space so the number never wraps away from its unit. */
export function distanceLabel(meters: number): string {
  return (formatDistance(meters) ?? '').replace(' ', ' ');
}

/** Walking time at an unhurried 4.5 km/h (75 m a minute), rounded up, never below one minute. */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / 75));
}
