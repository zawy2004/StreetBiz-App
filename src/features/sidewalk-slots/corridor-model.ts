import type { SidewalkSlot, StreetFeature } from '@/core/api/side-api';
import type { PlacedSlot, StreetLayout } from './street-geometry';

/**
 * Turns a fitted street layout plus the zone's street features into the two
 * rows the corridor plan draws (one per side of the roadway), each ordered by
 * distance along the street with slots and technical corridors interleaved.
 */

export type CorridorItem =
  | { kind: 'slot'; key: string; alongMeters: number; placed: PlacedSlot }
  | { kind: 'feature'; key: string; alongMeters: number; feature: StreetFeature };

export type Corridor = {
  /** The row on the positive-cross side (north for an east-running street). */
  rowA: CorridorItem[];
  /** Empty unless slots really sit on both sides of the road. */
  rowB: CorridorItem[];
  hasTwoSides: boolean;
  lengthMeters: number;
  /** Slots that are not on this street (dropped by the layout's outlier filter). */
  offStreet: SidewalkSlot[];
};

// A feature belongs to the plan only when it lies along the street and close
// to it; anything farther is another street's furniture, not this corridor's.
const FEATURE_MAX_ALONG_OVERHANG_METERS = 25;
const FEATURE_MAX_CROSS_METERS = 60;

export function buildCorridor(
  layout: Extract<StreetLayout, { kind: 'strip' }>,
  features: readonly StreetFeature[],
): Corridor {
  const rowA: CorridorItem[] = [];
  const rowB: CorridorItem[] = [];
  const rowFor = (cross: number) => (layout.hasTwoSides && cross < 0 ? rowB : rowA);

  for (const placed of layout.placed) {
    rowFor(placed.crossMeters).push({
      kind: 'slot',
      key: `slot-${placed.slot.slotId}`,
      alongMeters: placed.centerMeters,
      placed,
    });
  }

  for (const feature of features) {
    const { alongMeters, crossMeters } = layout.locate(feature.latitude, feature.longitude);
    const outsideAlong =
      alongMeters < -FEATURE_MAX_ALONG_OVERHANG_METERS ||
      alongMeters > layout.lengthMeters + FEATURE_MAX_ALONG_OVERHANG_METERS;
    if (outsideAlong || Math.abs(crossMeters) > FEATURE_MAX_CROSS_METERS) continue;
    rowFor(crossMeters).push({ kind: 'feature', key: `feature-${feature.featureId}`, alongMeters, feature });
  }

  const byAlong = (a: CorridorItem, b: CorridorItem) => a.alongMeters - b.alongMeters;
  rowA.sort(byAlong);
  rowB.sort(byAlong);

  return {
    rowA,
    rowB,
    hasTwoSides: layout.hasTwoSides,
    lengthMeters: layout.lengthMeters,
    offStreet: layout.offStreet,
  };
}
