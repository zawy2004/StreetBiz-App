import { StyleSheet, View } from 'react-native';

import { accentTone, useTheme, type AccentTone } from '@/theme';

import { AppText } from './AppText';

const TONES: AccentTone[] = ['primary', 'indigo', 'secondary', 'tertiary'];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Stable tone per name, so the same person keeps the same colour everywhere. */
function toneFor(name: string): AccentTone {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length] ?? 'primary';
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const tone = accentTone(colors, toneFor(name));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg }]}
    >
      <AppText variant={size >= 56 ? 'title' : 'labelSm'} style={{ color: tone.fg }}>
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center' } });
