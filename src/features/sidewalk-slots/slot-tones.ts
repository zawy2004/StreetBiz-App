import type { SlotDisplayState } from './slot-stats';
import { DISPLAY_STATE_LABELS, type IconName } from './slot-visuals';

/**
 * Native colours for a slot's state, from the same hex pairs as the web's SLOT_TONES
 * (every ink ≥ 7:1 on its wash). `swatch` is the solid pin/legend colour; a held slot also
 * gets a dashed edge, because colour is never the only signal.
 */
export const SLOT_STATE: Record<SlotDisplayState, { wash: string; ink: string; swatch: string; onSwatch: string; label: string; icon: IconName }> = {
  AVAILABLE: { wash: '#E6F6EC', ink: '#0B5D33', swatch: '#0B7F43', onSwatch: '#FFFFFF', label: DISPLAY_STATE_LABELS.AVAILABLE, icon: { sf: 'plus.circle.fill', md: 'add_circle' } },
  HELD: { wash: '#FFF3D1', ink: '#6B4100', swatch: '#FFB703', onSwatch: '#3D2600', label: DISPLAY_STATE_LABELS.HELD, icon: { sf: 'timer', md: 'timer' } },
  PENDING: { wash: '#FFF3D1', ink: '#6B4100', swatch: '#FFB703', onSwatch: '#3D2600', label: DISPLAY_STATE_LABELS.PENDING, icon: { sf: 'list.clipboard.fill', md: 'assignment' } },
  ACTIVE: { wash: '#EEF1F4', ink: '#2B3640', swatch: '#7B8794', onSwatch: '#FFFFFF', label: DISPLAY_STATE_LABELS.ACTIVE, icon: { sf: 'storefront.fill', md: 'storefront' } },
  SUSPENDED: { wash: '#FDEBEA', ink: '#8F1717', swatch: '#B42318', onSwatch: '#FFFFFF', label: DISPLAY_STATE_LABELS.SUSPENDED, icon: { sf: 'nosign', md: 'block' } },
};
