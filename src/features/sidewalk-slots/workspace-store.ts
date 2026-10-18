import { create } from 'zustand';

import { NO_FILTERS, type SlotFilters } from './slot-stats';

/** A slot as the header search sees it: just enough to find it and jump to it. */
export type SlotSearchEntry = { slotId: number; slotCode: string; zoneId: number; zoneName: string };

export type ZoneOption = { zoneId: number; zoneName: string };

export type WorkspaceView = 'PLAN' | 'MAP';

type WorkspaceState = {
  zoneId: number | null;
  selectedSlotId: number | null;
  view: WorkspaceView;
  filters: SlotFilters;
  /** Draws the technical corridors and street furniture on the plan. */
  showFeatures: boolean;
  /**
   * What the header can offer. The workspace screen registers these while it is
   * mounted and clears them on unmount, so the header shows the route select
   * and search only where they mean something.
   */
  zones: ZoneOption[];
  searchIndex: SlotSearchEntry[];

  selectZone: (zoneId: number) => void;
  selectSlot: (slotId: number | null) => void;
  /** Jump to a slot on another (or the same) route and select it. */
  focusSlot: (zoneId: number, slotId: number) => void;
  setView: (view: WorkspaceView) => void;
  setFilters: (filters: SlotFilters) => void;
  toggleFeatures: () => void;
  register: (zones: ZoneOption[], searchIndex: SlotSearchEntry[]) => void;
  clearRegistered: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  zoneId: null,
  selectedSlotId: null,
  view: 'PLAN',
  filters: NO_FILTERS,
  showFeatures: true,
  zones: [],
  searchIndex: [],

  // A slot belongs to one zone, so changing zone always drops the selection.
  selectZone: (zoneId) => set((s) => (s.zoneId === zoneId ? s : { zoneId, selectedSlotId: null })),
  selectSlot: (selectedSlotId) => set({ selectedSlotId }),
  focusSlot: (zoneId, slotId) => set({ zoneId, selectedSlotId: slotId, view: 'PLAN' }),
  setView: (view) => set({ view }),
  setFilters: (filters) => set({ filters }),
  toggleFeatures: () => set((s) => ({ showFeatures: !s.showFeatures })),
  register: (zones, searchIndex) => set({ zones, searchIndex }),
  clearRegistered: () => set({ zones: [], searchIndex: [] }),
}));
