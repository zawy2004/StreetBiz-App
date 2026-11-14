import { View } from 'react-native';

import { colors } from '@/theme';

/**
 * The painted kerb (web `.sb-kerb`): orange and white blocks. Static — it is the brand's
 * signature line, not something to watch; it marks where the pavement begins.
 */
export function KerbStrip({ height = 6, segment = 28 }: { height?: number; segment?: number }) {
  return (
    <View
      style={{
        height,
        overflow: 'hidden',
        flexDirection: 'row',
        backgroundColor: colors.kerbPaint,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: 40 }, (_, i) => (
        <View
          key={i}
          style={{
            width: segment,
            height,
            backgroundColor: i % 2 ? colors.kerbPaint : colors.brand,
          }}
        />
      ))}
    </View>
  );
}
