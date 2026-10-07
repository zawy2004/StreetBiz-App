import { Pressable, StyleSheet, View } from 'react-native';

import { fromPreference, toPreference, useThemePrefs, type ThemePreference } from '@/store/theme-prefs';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';
import { HeaderIconButton } from './AppHeader';

const MODES: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Theo máy', icon: 'theme-light-dark' },
  { value: 'light', label: 'Sáng', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Tối', icon: 'weather-night' },
];

/** Three-way appearance picker (follow device / light / dark), with a mini preview swatch each. */
export function ThemeModeSelector() {
  const { colors } = useTheme();
  const preference = toPreference(useThemePrefs((s) => s.scheme));
  const setScheme = useThemePrefs((s) => s.setScheme);

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Giao diện">
      {MODES.map((mode) => {
        const selected = mode.value === preference;
        return (
          <Pressable
            key={mode.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Giao diện ${mode.label}`}
            onPress={() => setScheme(fromPreference(mode.value))}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.primarySoft : colors.card,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <Swatch mode={mode.value} />
            <View style={styles.label}>
              <Icon name={mode.icon} size={16} color={selected ? 'primary' : 'muted'} />
              <AppText variant="labelSm" color={selected ? 'primary' : 'text'}>{mode.label}</AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tiny drawing of a screen in that mode; "Theo máy" is split light / dark. */
function Swatch({ mode }: { mode: ThemePreference }) {
  const light = { bg: '#F6F5F1', card: '#FFFFFF', line: '#E6E2DB' };
  const dark = { bg: '#0E1013', card: '#1F2329', line: '#2A2F36' };
  const half = (p: typeof light) => (
    <View style={[styles.swatchHalf, { backgroundColor: p.bg }]}>
      <View style={[styles.swatchBar, { backgroundColor: '#E4441F' }]} />
      <View style={[styles.swatchCard, { backgroundColor: p.card, borderColor: p.line }]} />
      <View style={[styles.swatchCard, styles.swatchShort, { backgroundColor: p.card, borderColor: p.line }]} />
    </View>
  );
  return (
    <View style={styles.swatch}>
      {mode === 'dark' ? half(dark) : half(light)}
      {mode === 'system' ? half(dark) : null}
    </View>
  );
}

/** Header shortcut that flips between light and dark (pins the choice instead of following the device). */
export function ThemeToggleButton() {
  const { scheme } = useTheme();
  const setScheme = useThemePrefs((s) => s.setScheme);
  const dark = scheme === 'dark';
  return (
    <HeaderIconButton
      icon={dark ? 'white-balance-sunny' : 'weather-night'}
      label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      onPress={() => setScheme(dark ? 'light' : 'dark')}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, borderRadius: radius.card, borderWidth: 1.5, padding: spacing.sm, gap: spacing.sm },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  swatch: { height: 64, borderRadius: 10, overflow: 'hidden', flexDirection: 'row' },
  swatchHalf: { flex: 1, padding: 6, gap: 4 },
  swatchBar: { width: '50%', height: 6, borderRadius: 3 },
  swatchCard: { height: 14, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  swatchShort: { width: '70%' },
});
