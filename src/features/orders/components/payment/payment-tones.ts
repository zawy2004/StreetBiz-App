/** Lamp colours per verdict: a pale wash and a deep ink of the same hue (≥ 7:1). */
export type SignalState = 'pending' | 'placed' | 'failed' | 'confirmed';

export const SIGNAL_TONE: Record<
  SignalState,
  { wash: string; ink: string; ring: string; icon: string }
> = {
  pending: {
    wash: 'fill-[#FFF3D1] dark:fill-[#3A2A08]',
    ink: 'text-[#6B4100] dark:text-[#FFD27A]',
    ring: 'stroke-[#FFB703]',
    icon: 'clock-outline',
  },
  placed: {
    wash: 'fill-[#E6F6EC] dark:fill-[#10301F]',
    ink: 'text-[#0B5D33] dark:text-[#8BE3B0]',
    ring: 'stroke-[#0B7F43] dark:stroke-[#4ED18A]',
    icon: 'check',
  },
  confirmed: {
    wash: 'fill-[#E6F6EC] dark:fill-[#10301F]',
    ink: 'text-[#0B5D33] dark:text-[#8BE3B0]',
    ring: 'stroke-[#0B7F43] dark:stroke-[#4ED18A]',
    icon: 'check',
  },
  failed: {
    wash: 'fill-[#FDEBEA] dark:fill-[#3A1414]',
    ink: 'text-[#8F1717] dark:text-[#FF9A90]',
    ring: 'stroke-[#B42318] dark:stroke-[#FF7A6E]',
    icon: 'close',
  },
};
