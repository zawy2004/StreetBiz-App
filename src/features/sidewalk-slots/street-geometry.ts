import type { SidewalkSlot } from '@/core/api/side-api';

/**
 * Fits a street axis through a zone's slots and lays them out along it, in
 * true metres, for the corridor plan (corridor-model.ts, CorridorPlan). Pure math,
 * no React -- SidewalkSlots stores only a centre point per slot (no bearing,
 * no polygon, no sequence, no street centreline), and slot_code order does
 * not match physical order, so the axis and the along-street order both have
 * to be derived here from the raw coordinates.
 */

const METERS_PER_DEGREE_LAT = 110_540;
const METERS_PER_DEGREE_LNG_AT_EQUATOR = 111_320;

// A pricing zone is a ward's price bucket, not a guaranteed single street: a
// stray slot kilometres away (see DEV-SEED-01 in dev-seed-side.sql) would
// capture the covariance fit and flatten the real street into a few pixels.
// Slots farther than this from the group's median are dropped from the fit
// and reported back in `offStreet` rather than silently discarded.
const STREET_CLUSTER_RADIUS_METERS = 300;

// Below this many points a "median" isn't meaningful, so outlier rejection
// is skipped rather than risking a 2-point group flagging itself.
const MIN_POINTS_FOR_OUTLIER_FILTER = 3;

// A layout only counts as "a street" once it's at least this long and this
// straight. Shorter/wider groups render as `not-a-street` instead of a lie.
const MIN_STREET_LENGTH_METERS = 15;
const MAX_CROSS_RATIO = 0.35;

// A street only counts as having two built-up sides once each side reaches at
// least this far from the fitted axis. Under it, the group is one row (or
// geocoding jitter around one row) and the diagram draws a single side rather
// than inventing a facing terrace that isn't in the data.
const TWO_SIDED_MIN_OFFSET_METERS = 5;

// Drawing-only fallback size for a slot with no recorded width/length --
// never treated as a real measurement (see `measured` on SlotFootprint).
const PLACEHOLDER_ALONG_METERS = 2;
const PLACEHOLDER_ACROSS_METERS = 2.5;

export type SlotFootprint = {
  /** The dimension drawn running along the street. */
  alongMeters: number;
  /** The dimension drawn running across the street (kerb to building line). */
  acrossMeters: number;
  /** Null whenever either source dimension is missing -- never guessed. */
  areaSqm: number | null;
  /** False means alongMeters/acrossMeters are a drawing placeholder, not data. */
  measured: boolean;
};

export type PlacedSlot = {
  slot: SidewalkSlot;
  footprint: SlotFootprint;
  startMeters: number;
  endMeters: number;
  centerMeters: number;
  /** Signed distance from the fitted street axis, in metres. */
  crossMeters: number;
  /** 'A' when crossMeters >= 0 (drawn on one side of the roadway), 'B' otherwise. */
  side: 'A' | 'B';
};

export type StreetLayout =
  | { kind: 'empty' }
  | { kind: 'not-a-street'; alongSpreadMeters: number; crossSpreadMeters: number }
  | {
      kind: 'strip';
      placed: PlacedSlot[];
      lengthMeters: number;
      /**
       * The fitted axis's angle above due east, in degrees, positive toward
       * north (i.e. plain math convention, not a compass bearing). Display
       * only -- nothing in the layout depends on its sign.
       */
      bearingDegrees: number;
      offStreet: SidewalkSlot[];
      /** True once slots sit on both sides of the axis, not just one row. */
      hasTwoSides: boolean;
      /**
       * Projects any coordinate into this layout's frame: distance along the
       * street from its start (same zero as `placed`) and signed distance from
       * the axis (same sign convention as `PlacedSlot.crossMeters`).
       */
      locate: (latitude: number, longitude: number) => { alongMeters: number; crossMeters: number };
    };

/**
 * SidewalkSlots stores width_meters/length_meters with no recorded orientation.
 * ASSUMPTION: width = frontage along the street, length = depth from the kerb
 * to the building line. Flip the two fields here if the ward's convention is
 * the other way round -- nothing else in the diagram depends on the choice.
 */
export function slotFootprint(slot: Pick<SidewalkSlot, 'widthMeters' | 'lengthMeters'>): SlotFootprint {
  const { widthMeters, lengthMeters } = slot;
  if (widthMeters == null || lengthMeters == null) {
    return {
      alongMeters: PLACEHOLDER_ALONG_METERS,
      acrossMeters: PLACEHOLDER_ACROSS_METERS,
      areaSqm: null,
      measured: false,
    };
  }
  return {
    alongMeters: widthMeters,
    acrossMeters: lengthMeters,
    areaSqm: widthMeters * lengthMeters,
    measured: true,
  };
}

export function buildStreetLayout(slots: readonly SidewalkSlot[]): StreetLayout {
  if (slots.length === 0) return { kind: 'empty' };

  // Origin for the local-metres projection: the mean coordinate. This only
  // fixes the coordinate system -- it never changes the relative distances
  // the rest of the algorithm reasons about.
  const origin = {
    lat0: mean(slots.map((s) => s.latitude)),
    lng0: mean(slots.map((s) => s.longitude)),
  };
  // Pair each slot with its projection so nothing downstream needs parallel
  // index arrays (and the risk of them drifting out of sync).
  let inliers = slots.map((slot) => ({ slot, point: toLocalMeters(slot.latitude, slot.longitude, origin) }));
  let offStreet: SidewalkSlot[] = [];

  if (slots.length >= MIN_POINTS_FOR_OUTLIER_FILTER) {
    const medianX = medianOf(inliers.map((s) => s.point.x));
    const medianY = medianOf(inliers.map((s) => s.point.y));
    const kept = inliers.filter((s) => Math.hypot(s.point.x - medianX, s.point.y - medianY) <= STREET_CLUSTER_RADIUS_METERS);
    // Never drop everything: an all-outlier result means this radius test
    // isn't discriminating anything here.
    if (kept.length > 0 && kept.length < inliers.length) {
      offStreet = inliers.filter((s) => !kept.includes(s)).map((s) => s.slot);
      inliers = kept;
    }
  }

  if (inliers.length === 0) return { kind: 'empty' };

  // Principal axis via the closed-form 2x2 covariance eigenvector.
  const meanX = mean(inliers.map((s) => s.point.x));
  const meanY = mean(inliers.map((s) => s.point.y));
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const { point } of inliers) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  const theta = inliers.length === 1 ? 0 : 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ux = Math.cos(theta);
  let uy = Math.sin(theta);
  // atan2's branch already yields cos θ ≥ 0 (west→east). Make that invariant
  // explicit rather than load-bearing-by-accident, so a future edit can't
  // silently reverse every diagram: ties on a north-south street go south→north.
  if (ux < 0 || (ux === 0 && uy < 0)) {
    ux = -ux;
    uy = -uy;
  }

  // Project from the fitted axis's own centroid (meanX/meanY), not from
  // `origin` (the mean of every slot pre-outlier-rejection). This is only a
  // translation -- `along` gets re-zeroed via minStart below regardless, so
  // it changes nothing about order/spacing/length/bearing. It does make
  // mean(cross) exactly 0, so "which side of the road" (sign of cross) is
  // decided by the axis itself, not nudged by whichever outliers got dropped.
  const projected = inliers.map(({ slot, point }) => {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    return { slot, along: dx * ux + dy * uy, cross: -dx * uy + dy * ux };
  });

  // With <=2 points the axis is exact (or undefined for 1 point) -- the
  // linearity check is meaningless and is skipped rather than divide-by-zero
  // or reject a legitimate 2-slot street.
  const alongValues = projected.map((p) => p.along);
  const alongSpreadMeters = Math.max(...alongValues) - Math.min(...alongValues);
  const crossValues = projected.map((p) => p.cross);
  const crossSpreadMeters = projected.length <= 2 ? 0 : Math.max(...crossValues) - Math.min(...crossValues);
  const isStreet =
    projected.length <= 2 ||
    (alongSpreadMeters >= MIN_STREET_LENGTH_METERS && crossSpreadMeters <= alongSpreadMeters * MAX_CROSS_RATIO);

  if (!isStreet) {
    return { kind: 'not-a-street', alongSpreadMeters, crossSpreadMeters };
  }

  const rawPlaced = projected.map(({ slot, along: centerMeters, cross }) => {
    const footprint = slotFootprint(slot);
    return {
      slot,
      footprint,
      startMeters: centerMeters - footprint.alongMeters / 2,
      endMeters: centerMeters + footprint.alongMeters / 2,
      centerMeters,
      crossMeters: cross,
      side: (cross >= 0 ? 'A' : 'B') as 'A' | 'B',
    };
  });

  const minStart = Math.min(...rawPlaced.map((p) => p.startMeters));
  const placed = rawPlaced
    .map((p) => ({
      ...p,
      startMeters: p.startMeters - minStart,
      endMeters: p.endMeters - minStart,
      centerMeters: p.centerMeters - minStart,
    }))
    .sort((a, b) => a.centerMeters - b.centerMeters);

  // Two real sides means real slots sit at least TWO_SIDED_MIN_OFFSET_METERS
  // on *both* sides of the axis -- not just a wide spread, which a single row
  // sitting off-axis would also produce.
  const hasTwoSides =
    Math.min(...crossValues) <= -TWO_SIDED_MIN_OFFSET_METERS && Math.max(...crossValues) >= TWO_SIDED_MIN_OFFSET_METERS;

  const locate = (latitude: number, longitude: number) => {
    const point = toLocalMeters(latitude, longitude, origin);
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    return { alongMeters: dx * ux + dy * uy - minStart, crossMeters: -dx * uy + dy * ux };
  };

  return {
    kind: 'strip',
    placed,
    lengthMeters: Math.max(...placed.map((p) => p.endMeters)),
    bearingDegrees: (theta * 180) / Math.PI,
    offStreet,
    hasTwoSides,
    locate,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  return sorted.length % 2 === 0 && lo !== undefined ? (lo + hi!) / 2 : hi!;
}

function toLocalMeters(lat: number, lng: number, origin: { lat0: number; lng0: number }) {
  const metersPerDegreeLng = METERS_PER_DEGREE_LNG_AT_EQUATOR * Math.cos((origin.lat0 * Math.PI) / 180);
  return {
    x: (lng - origin.lng0) * metersPerDegreeLng,
    y: (lat - origin.lat0) * METERS_PER_DEGREE_LAT,
  };
}
