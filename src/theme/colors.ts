export type ColorTokens = {
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Tinted background behind primary icons, selected tabs and chips. */
  primarySoft: string;

  indigo: string;
  onIndigo: string;
  indigoSoft: string;

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

  /** Night-street surface for hero cards; stays dark in both schemes, like the FE landing page. */
  hero: string;
  onHero: string;
  heroMuted: string;
  heroLine: string;

  shadow: string;
};

export const lightColors: ColorTokens = {
  primary: '#E4441F',
  primaryPressed: '#C93512',
  onPrimary: '#FFFFFF',
  primarySoft: '#FDEEE8',

  indigo: '#1D2939',
  onIndigo: '#FFFFFF',
  indigoSoft: '#ECEFF4',

  secondary: '#F5A000',
  secondaryBg: '#FEF4E1',
  onSecondary: '#8A5300',

  tertiary: '#0B8A4B',
  tertiaryBg: '#E5F4EB',
  onTertiary: '#06351D',

  error: '#D92D20',
  errorBg: '#FDEFED',
  onError: '#7A150D',

  bg: '#F6F5F1',
  card: '#FFFFFF',
  sunken: '#EFEDE8',
  border: '#E6E2DB',
  borderStrong: '#D3CEC5',
  muted: '#676C75',
  text: '#1A2230',
  scrim: 'rgba(17, 21, 28, 0.5)',

  hero: '#14171C',
  onHero: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.68)',
  heroLine: 'rgba(255, 255, 255, 0.12)',

  shadow: '#1A2230',
};

export const darkColors: ColorTokens = {
  primary: '#F2552F',
  primaryPressed: '#D9431F',
  onPrimary: '#FFFFFF',
  primarySoft: '#3A1D15',

  indigo: '#DDE3EC',
  onIndigo: '#12161C',
  indigoSoft: '#232933',

  secondary: '#FFB23F',
  secondaryBg: '#33260F',
  onSecondary: '#FFD08A',

  tertiary: '#3CCB7F',
  tertiaryBg: '#12301F',
  onTertiary: '#D6F5E4',

  error: '#FF6B5E',
  errorBg: '#3A1714',
  onError: '#FFB4AB',

  bg: '#0E1013',
  card: '#171A1F',
  sunken: '#1F2329',
  border: '#2A2F36',
  borderStrong: '#3A4048',
  muted: '#9AA2AC',
  text: '#ECEEF1',
  scrim: 'rgba(0, 0, 0, 0.62)',

  hero: '#1B1F26',
  onHero: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.66)',
  heroLine: 'rgba(255, 255, 255, 0.1)',

  shadow: '#000000',
};

/** Fixed brand colours for the gradient glow on hero cards (same in both schemes). */
export const brandGlow = { from: '#E4441F', to: '#F5A000' } as const;

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

/** Icon-tile tones shared by list rows, shortcuts and stat tiles. */
export type AccentTone = 'primary' | 'indigo' | 'secondary' | 'tertiary' | 'error';

export function accentTone(c: ColorTokens, tone: AccentTone): { fg: string; bg: string } {
  return {
    primary: { fg: c.primary, bg: c.primarySoft },
    indigo: { fg: c.indigo, bg: c.indigoSoft },
    secondary: { fg: c.onSecondary, bg: c.secondaryBg },
    tertiary: { fg: c.tertiary, bg: c.tertiaryBg },
    error: { fg: c.error, bg: c.errorBg },
  }[tone];
}
