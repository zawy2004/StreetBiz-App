/**
 * Colour tokens, same values as StreetBiz-FE `src/index.css` (light theme).
 * The ground is always light; only text, slot plates and QR codes are dark.
 *
 * Vivid orange leads, in three strengths:
 * - `brand` #FF6A1F: large fills with no small text (banner, rings, dots, the permit band)
 * - `cta` #EE5500: filled buttons, chips and the cart bar, with bold white labels (3.5:1)
 * - `primary` #CF4A0B: orange text and prices, readable in sunlight (4.5:1)
 */
export const colors = {
  brand: '#FF6A1F',
  brandLight: '#FF8A3D',
  cta: '#EE5500',
  ctaPressed: '#D64C00',
  primary: '#CF4A0B',
  primaryPressed: '#B83F08',
  brandTint: '#FFE8DB',
  mango: '#FFB703',
  /** Price stickers and "new" tags: mango paper with ink figures. */
  sticker: '#FFC93C',
  mangoTint: '#FFF4D1',
  onMango: '#6B4100',
  leaf: '#0B7F43',
  leafTint: '#E6F6EC',
  onLeaf: '#0B5D33',
  danger: '#B42318',
  dangerTint: '#FDEBEA',
  onDanger: '#8F1717',
  sign: '#0A5FA8',
  signTint: '#E5F0FA',
  plate: '#111C2B',
  ink: '#111C2B',
  muted: '#566173',
  bg: '#F6F7F9',
  /** The buyer's white street canvas (photo-led screens sit on white, not grey). */
  canvas: '#FFFFFF',
  card: '#FFFFFF',
  sunken: '#EEF1F4',
  line: '#E1E5EA',
  kerbPaint: '#FFF8F2',
  separator: 'rgba(17, 28, 43, 0.10)',
  pressed: 'rgba(17, 28, 43, 0.05)',
  white: '#FFFFFF',
} as const;

/** Verdicts read at arm's length in sunlight: pale wash of the tone, words in the tone, every pair ≥ 7:1 (web `verdict-tones.ts`). */
export const statusTones = {
  ok: { wash: '#E6F6EC', ink: '#0B5D33', sf: 'checkmark.seal.fill', md: 'verified' },
  pending: { wash: '#FFF3D1', ink: '#6B4100', sf: 'clock.fill', md: 'schedule' },
  danger: { wash: '#FDEBEA', ink: '#8F1717', sf: 'xmark.octagon.fill', md: 'block' },
  neutral: { wash: '#EEF1F4', ink: '#2B3640', sf: 'info.circle.fill', md: 'info' },
} as const;

export type StatusTone = keyof typeof statusTones;
