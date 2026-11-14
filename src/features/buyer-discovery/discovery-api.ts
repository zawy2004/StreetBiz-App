/**
 * Marketplace reads for Khám phá, the same queries and React Query keys as the web
 * (`useDiscovery.ts`). These reads are public, so their keys carry no user id.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { commerceApi, type MenuItemQuery, type StorefrontQuery } from '@/core/api/commerce-api';
import { useDiscoveryStore } from './discovery-store';

/** Wards that have listed storefronts, nearest first once the buyer's position is known. */
export function useServiceAreas() {
  const position = useDiscoveryStore((s) => s.position);
  return useQuery({
    queryKey: ['commerce', 'service-areas', position],
    queryFn: () => commerceApi.serviceAreas(position ?? undefined),
    staleTime: 60_000,
  });
}

export function useMarketplaceCategories() {
  return useQuery({
    queryKey: ['commerce', 'marketplace-categories'],
    queryFn: commerceApi.marketplaceCategories,
    staleTime: 300_000,
  });
}

export function useStorefronts(query: StorefrontQuery, enabled = true) {
  return useQuery({
    queryKey: ['commerce', 'storefronts', query],
    queryFn: () => commerceApi.storefronts(query),
    enabled,
    // Typing in search or flipping a filter keeps the current list until the new one arrives.
    placeholderData: keepPreviousData,
  });
}

export function useMenuItems(query: MenuItemQuery, enabled = true) {
  return useQuery({
    queryKey: ['commerce', 'menu-search', query],
    queryFn: () => commerceApi.menuItems(query),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useStorefrontDetail(storefrontId: number) {
  const position = useDiscoveryStore((s) => s.position);
  return useQuery({
    queryKey: ['commerce', 'storefront', storefrontId, position],
    queryFn: () => commerceApi.storefront(storefrontId, position ?? undefined),
    enabled: Number.isFinite(storefrontId),
  });
}

export function useMenuItem(menuItemId: number) {
  return useQuery({
    queryKey: ['commerce', 'menu-item', menuItemId],
    queryFn: () => commerceApi.menuItem(menuItemId),
    enabled: Number.isFinite(menuItemId),
  });
}
