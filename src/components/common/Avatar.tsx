import { Text, View } from 'react-native';

import { fonts } from '@/theme';

const WASHES = ['#FFE8DB', '#FFF4D1', '#E6F6EC', '#E5F0FA', '#FDEBEA'];
const INKS = ['#CF4A0B', '#6B4100', '#0B5D33', '#0A5FA8', '#8F1717'];

/** Initials on a soft colour picked from the name, so the same person keeps the same colour. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[words.length - 2]![0]}${words[words.length - 1]![0]}`
      : (words[0]?.slice(0, 2) ?? '?');
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const i = h % WASHES.length;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: WASHES[i],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: INKS[i] }}>
        {initials.toUpperCase()}
      </Text>
    </View>
  );
}
