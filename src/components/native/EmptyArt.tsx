import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { colors, fonts } from '@/theme';

/**
 * Empty-state illustration built from the project's own motifs instead of a generic icon:
 * a blank slot plate standing on the kerb strip, with the state's symbol on the plate.
 * Decorative only: the words beside it carry the meaning.
 */
export function EmptyArt({ icon, label }: { icon: { sf: string; md: string }; label?: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', width: 168 }}>
      <View style={{ width: 120, height: 84, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.plate, alignItems: 'center', justifyContent: 'center', gap: 4, boxShadow: '0 10px 24px -14px rgba(17, 28, 43, 0.55)', transform: [{ rotate: '-4deg' }] }}>
        <Icon sf={icon.sf} md={icon.md} size={28} color={colors.brandLight} />
        {label ? <Text style={{ fontFamily: fonts.code, fontSize: 15, letterSpacing: 1.5, color: colors.white }}>{label}</Text> : null}
      </View>
      <View style={{ width: 8, height: 18, backgroundColor: '#9AA4AF' }} />
      <View style={{ width: 168, borderRadius: 4, overflow: 'hidden' }}>
        <KerbStrip height={8} segment={21} />
      </View>
    </View>
  );
}
