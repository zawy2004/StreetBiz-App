import type {
  GeoPoint,
  MenuItemQuery,
  MenuItemSort,
  StorefrontQuery,
  StorefrontSort,
} from '@/core/api/commerce-api';

export const RADIUS_OPTIONS = [1000, 2000, 5000] as const;
export const PRICE_CAPS = [30_000, 50_000, 100_000] as const;

/** What a customer narrows a listing by. The ward (service area) is picked separately from the rest. */
export type DiscoveryFilters = {
  wardId: number | null;
  categoryId: number | null;
  openNow: boolean;
  radiusMeters: number | null;
  maxPrice: number | null;
};

export const NO_DISCOVERY_FILTERS: DiscoveryFilters = {
  wardId: null,
  categoryId: null,
  openNow: false,
  radiusMeters: null,
  maxPrice: null,
};

/** True when a chip-level filter is on; the service area is deliberately not counted. */
export const hasActiveFilters = (f: DiscoveryFilters) =>
  f.categoryId != null || f.openNow || f.radiusMeters != null || f.maxPrice != null;

/** One sort choice for the search screen, mapped onto whichever list it orders. */
export type SearchSort = 'NEAREST' | 'RATING' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME';

export function storefrontSortFor(sort: SearchSort, position: GeoPoint | null): StorefrontSort {
  if (sort === 'NEAREST') return position ? 'distance' : 'name';
  return sort === 'RATING' ? 'rating' : 'name';
}

export const menuSortFor = (sort: SearchSort): MenuItemSort =>
  sort === 'PRICE_ASC' ? 'price_asc' : sort === 'PRICE_DESC' ? 'price_desc' : 'name';

export function storefrontQuery(
  filters: DiscoveryFilters,
  position: GeoPoint | null,
  text: string,
  sort: StorefrontSort | null = null,
): StorefrontQuery {
  // A radius is meaningless (and rejected by the API) without a position to measure from.
  const radiusMeters = position && filters.radiusMeters ? filters.radiusMeters : undefined;
  const wanted = sort ?? (position ? 'distance' : 'name');
  return {
    query: text.trim() || undefined,
    wardId: filters.wardId ?? undefined,
    categoryId: filters.categoryId ?? undefined,
    openNow: filters.openNow || undefined,
    position: position ?? undefined,
    radiusMeters,
    sort: wanted === 'distance' && !position ? 'name' : wanted,
  };
}

export function menuItemQuery(
  filters: DiscoveryFilters,
  text: string,
  sort: MenuItemSort = 'name',
): MenuItemQuery {
  return {
    query: text.trim() || undefined,
    wardId: filters.wardId ?? undefined,
    categoryId: filters.categoryId ?? undefined,
    openNow: filters.openNow || undefined,
    maxPrice: filters.maxPrice ?? undefined,
    sort,
  };
}
