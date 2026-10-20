import type { BusinessCategory, StreetFeatureType } from '@/core/api/side-api';
import type { SlotDisplayState } from './slot-stats';

/** A native symbol pair: SF Symbol on iPhone, Material Symbol on Android. */
export type IconName = { sf: string; md: string };

/**
 * Slot colours for the street plan, keyed by what a slot looks like right now
 * (see slotDisplayState), not by its raw status: a held slot is AVAILABLE in the
 * database but must not read as free.
 *
 * Every state is a pale wash with deep ink of the same hue, so the code, price
 * and status on a slot read at arm's length in sunlight: #0B5D33 on #E6F6EC 7.2:1,
 * #6B4100 on #FFF3D1 8.0:1, #2B3640 on #EEF1F4 10.9:1, #8F1717 on #FDEBEA 7.9:1
 * (the dark-mode pairs are higher). Colour is never the only signal: each state
 * has its own glyph, its own words and, for holds, a dashed edge.
 *
 * The selected slot keeps its state colours and gets a glowing brand-orange
 * outline instead of a dark fill. Suspended is red, not the primary orange the
 * buttons use.
 *
 * Deliberately not driven by statusLabel().tone (core/constants/status-labels.ts):
 * that maps ACTIVE -> 'ok' -> green, but on a slot plan green must mean
 * "còn trống", not "a contract is in good standing".
 */
export type SlotTone = {
  /** Background wash of the slot. */
  wash: string;
  /** Text colour on the wash (>= 7:1). */
  ink: string;
  /** Border colour (with the state's border style). */
  edge: string;
  /** Solid swatch for the occupancy bar and legend (>= 3:1 against the card). */
  swatch: string;
  icon: IconName;
};

export const SLOT_TONES: Record<SlotDisplayState, SlotTone> = {
  AVAILABLE: {
    wash: 'bg-[#E6F6EC] dark:bg-[#10301F]',
    ink: 'text-[#0B5D33] dark:text-[#8BE3B0]',
    edge: 'border-solid border-[#0B5D33]/45 dark:border-[#8BE3B0]/45',
    swatch: 'bg-[#0B7F43] dark:bg-[#4ED18A]',
    icon: { sf: 'plus.circle.fill', md: 'add_circle' },
  },
  HELD: {
    wash: 'bg-[#FFF3D1] dark:bg-[#3A2A08]',
    ink: 'text-[#6B4100] dark:text-[#FFD27A]',
    edge: 'border-dashed border-[#6B4100]/60 dark:border-[#FFD27A]/60',
    swatch: 'bg-[#FFB703] dark:bg-[#FFC233]',
    icon: { sf: 'timer', md: 'timer' },
  },
  PENDING: {
    wash: 'bg-[#FFF3D1] dark:bg-[#3A2A08]',
    ink: 'text-[#6B4100] dark:text-[#FFD27A]',
    edge: 'border-solid border-[#6B4100]/45 dark:border-[#FFD27A]/45',
    swatch: 'bg-[#FFB703] dark:bg-[#FFC233]',
    icon: { sf: 'list.clipboard.fill', md: 'assignment' },
  },
  ACTIVE: {
    wash: 'bg-[#EEF1F4] dark:bg-[#1D2833]',
    ink: 'text-[#2B3640] dark:text-[#C5D0DA]',
    edge: 'border-solid border-[#2B3640]/30 dark:border-[#C5D0DA]/30',
    swatch: 'bg-[#7B8794] dark:bg-[#8D99A6]',
    icon: { sf: 'storefront.fill', md: 'storefront' },
  },
  SUSPENDED: {
    wash: 'bg-[#FDEBEA] dark:bg-[#3A1414]',
    ink: 'text-[#8F1717] dark:text-[#FF9A90]',
    edge: 'border-solid border-[#8F1717]/45 dark:border-[#FF9A90]/45',
    swatch: 'bg-[#B42318] dark:bg-[#FF7A6E]',
    icon: { sf: 'nosign', md: 'block' },
  },
};

/** Thin diagonal hatching laid over a slot with an application under review. */
export const PENDING_HATCH =
  'bg-[repeating-linear-gradient(135deg,rgb(107_65_0/0.08)_0_2px,transparent_2px_9px)] dark:bg-[repeating-linear-gradient(135deg,rgb(255_210_122/0.1)_0_2px,transparent_2px_9px)]';

export const DISPLAY_STATE_LABELS: Record<SlotDisplayState, string> = {
  AVAILABLE: 'Còn trống',
  HELD: 'Đang giữ chỗ',
  PENDING: 'Đang có đơn',
  ACTIVE: 'Đã cho thuê',
  SUSPENDED: 'Tạm ngưng',
};

export const CATEGORY_ICONS: Record<BusinessCategory, IconName> = {
  FOOD_BEVERAGE: { sf: 'fork.knife', md: 'restaurant' },
  RETAIL: { sf: 'storefront.fill', md: 'storefront' },
  SERVICES: { sf: 'headphones', md: 'support_agent' },
  CRAFTS: { sf: 'paintpalette.fill', md: 'palette' },
  GENERAL: { sf: 'tag.fill', md: 'sell' },
};

export const FEATURE_ICONS: Record<StreetFeatureType, IconName> = {
  TRANSFORMER: { sf: 'bolt.fill', md: 'electric_bolt' },
  HYDRANT: { sf: 'drop.fill', md: 'fire_hydrant' },
  TREE: { sf: 'tree.fill', md: 'park' },
  LIGHT_POLE: { sf: 'lightbulb.fill', md: 'lightbulb' },
  BUS_STOP: { sf: 'bus.fill', md: 'directions_bus' },
  PARKING: { sf: 'parkingsign', md: 'local_parking' },
};

export const FEATURE_LABELS: Record<StreetFeatureType, string> = {
  TRANSFORMER: 'Trạm biến áp',
  HYDRANT: 'Họng cứu hỏa',
  TREE: 'Cây xanh',
  LIGHT_POLE: 'Cột đèn',
  BUS_STOP: 'Trạm xe buýt',
  PARKING: 'Bãi giữ xe',
};

/** Pavement tiles: a faint 8px paving grid drawn in CSS, for the plan's sidewalks. */
export const PAVING =
  'bg-[#F7F8FA] bg-[linear-gradient(rgb(17_28_43/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(17_28_43/0.05)_1px,transparent_1px)] bg-[length:16px_16px] dark:bg-[#17212C] dark:bg-[linear-gradient(rgb(238_242_246/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(238_242_246/0.05)_1px,transparent_1px)]';
