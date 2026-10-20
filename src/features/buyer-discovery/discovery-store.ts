import { create } from 'zustand';

import type { GeoPoint, StorefrontSort } from '@/core/api/commerce-api';
import { NO_DISCOVERY_FILTERS, type DiscoveryFilters } from './discovery-filters';
import { detectPosition, LocateError, type LocateFailure } from './geolocation';

export type LocateStatus = 'IDLE' | 'LOCATING' | 'OK' | LocateFailure;

/**
 * What the buyer has told discovery so far (the web's `discovery-store.ts`): where they are,
 * which ward they picked, how they narrowed the lists, plus this app's search text, sort and
 * recent searches. In memory only: a location is not something to write to storage.
 */
type DiscoveryState = {
  position: GeoPoint | null;
  locateStatus: LocateStatus;
  filters: DiscoveryFilters;
  sort: StorefrontSort;
  query: string;
  recent: string[];
  locate: () => Promise<void>;
  clearPosition: () => void;
  setFilters: (patch: Partial<DiscoveryFilters>) => void;
  /** Clears the chip filters and keeps the chosen ward. */
  resetFilters: () => void;
  setSort: (sort: StorefrontSort) => void;
  setQuery: (query: string) => void;
  remember: (query: string) => void;
  clearRecent: () => void;
};

export const SORT_LABELS: Record<StorefrontSort, string> = {
  distance: 'Gần nhất',
  rating: 'Được khen nhiều',
  name: 'Tên A–Z',
};

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  position: null,
  locateStatus: 'IDLE',
  filters: NO_DISCOVERY_FILTERS,
  sort: 'name',
  query: '',
  recent: [],

  locate: async () => {
    if (get().locateStatus === 'LOCATING') return;
    set({ locateStatus: 'LOCATING' });
    try {
      const position = await detectPosition();
      // Once the position is known, nearest first is what a buyer wants.
      set({ position, locateStatus: 'OK', sort: 'distance' });
    } catch (error) {
      set({ locateStatus: error instanceof LocateError ? error.reason : 'FAILED' });
    }
  },
  clearPosition: () =>
    set((s) => ({
      position: null,
      locateStatus: 'IDLE',
      sort: s.sort === 'distance' ? 'name' : s.sort,
      filters: { ...s.filters, radiusMeters: null },
    })),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () =>
    set((s) => ({ filters: { ...NO_DISCOVERY_FILTERS, wardId: s.filters.wardId }, query: '' })),
  setSort: (sort) => set({ sort }),
  setQuery: (query) => set({ query }),
  remember: (query) =>
    set((s) => {
      const q = query.trim();
      if (!q) return s;
      return {
        recent: [q, ...s.recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 5),
      };
    }),
  clearRecent: () => set({ recent: [] }),
}));
