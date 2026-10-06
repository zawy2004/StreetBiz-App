export type ColorTokens = {
  primary: string;
  primaryPressed: string;
  onPrimary: string;

  indigo: string;
  onIndigo: string;

  secondary: string;
  secondaryBg: string;
  onSecondary: string;

  tertiary: string;
  tertiaryBg: string;
  onTertiary: string;

  error: string;
  errorBg: string;
  onError: string;

  bg: string;
  card: string;
  sunken: string;
  border: string;
  borderStrong: string;
  muted: string;
  text: string;
  scrim: string;
};

export const lightColors: ColorTokens = {
  primary: '#E4441F',
  primaryPressed: '#C93512',
  onPrimary: '#FFFFFF',

  indigo: '#1D2939',
  onIndigo: '#FFFFFF',

  secondary: '#F5A000',
  secondaryBg: '#FEF6E7',
  onSecondary: '#8A5300',

  tertiary: '#0B8A4B',
  tertiaryBg: '#E8F5EE',
  onTertiary: '#06351D',

  error: '#D92D20',
  errorBg: '#FDF2F1',
  onError: '#7A150D',

  bg: '#F4F4F2',
  card: '#FFFFFF',
  sunken: '#F0F1F3',
  border: '#E2E4E8',
  borderStrong: '#D0D3D9',
  muted: '#676C75',
  text: '#1D2939',
  scrim: 'rgba(29, 41, 57, 0.48)',
};

export const darkColors: ColorTokens = {
  primary: '#F2552F',
  primaryPressed: '#D9431F',
  onPrimary: '#FFFFFF',

  indigo: '#DDE3EC',
  onIndigo: '#12161C',

  secondary: '#FFB23F',
  secondaryBg: '#33260F',
  onSecondary: '#FFD08A',

  tertiary: '#3CCB7F',
  tertiaryBg: '#12301F',
  onTertiary: '#D6F5E4',

  error: '#FF6B5E',
  errorBg: '#3A1714',
  onError: '#FFB4AB',

  bg: '#0F1113',
  card: '#181B1F',
  sunken: '#1F2328',
  border: '#2B3036',
  borderStrong: '#3A4048',
  muted: '#9AA2AC',
  text: '#ECEEF1',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export type StatusTone = 'ok' | 'pending' | 'danger' | 'neutral';

export type ToneColors = { fg: string; bg: string; dot: string };

export function statusTones(c: ColorTokens): Record<StatusTone, ToneColors> {
  return {
    ok: { fg: c.tertiary, bg: c.tertiaryBg, dot: c.tertiary },
    pending: { fg: c.onSecondary, bg: c.secondaryBg, dot: c.secondary },
    danger: { fg: c.onError, bg: c.errorBg, dot: c.error },
    neutral: { fg: c.muted, bg: c.sunken, dot: c.muted },
  };
}
