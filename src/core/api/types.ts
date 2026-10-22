/**
 * DTO shapes in one import, re-exported from the API modules ported from StreetBiz-FE
 * (`commerce-api.ts`, `side-api.ts`), so there is a single source of truth for each type.
 */
export type {
  GeoPoint,
  MarketplaceCategory,
  MarketplaceMenuItem,
  ServiceArea,
  StorefrontHour,
  StorefrontSort,
  StorefrontSummary,
} from './commerce-api';
export type { DigitalPermit, RentalContract } from './side-api';
