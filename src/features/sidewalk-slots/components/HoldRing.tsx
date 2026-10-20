import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts, tabular } from '@/theme';
import { HOLD_WARNING_SECONDS, holdFraction } from '../plan-labels';
import { formatCountdown, secondsUntil } from '../slot-format';

/**
 * The 15-minute hold as a ring that empties, the time left inside in sign figures. Orange on a
 * peach track while there is time, deep red under two minutes (and the words say it too).
 */
export function HoldRing({ heldAt, expiresAt, nowMs, size = 52 }: { heldAt: string; expiresAt: string; nowMs: number; size?: number }) {
  const seconds = secondsUntil(expiresAt, nowMs);
  const fraction = holdFraction(heldAt, expiresAt, nowMs);
  const ending = seconds <= HOLD_WARNING_SECONDS;
  const stroke = size > 48 ? 5 : 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ink = ending ? colors.danger : colors.cta;
  return (
    <View
      accessible
      accessibilityLabel={`Còn giữ chỗ ${Math.floor(seconds / 60)} phút ${seconds % 60} giây`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={ending ? colors.dangerTint : colors.brandTint} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ink}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - fraction)}
        />
      </Svg>
      <Text maxFontSizeMultiplier={1.2} style={[{ fontFamily: fonts.code, fontSize: size > 48 ? 14 : 12.5, color: ending ? colors.onDanger : colors.ink }, tabular]}>
        {formatCountdown(seconds)}
      </Text>
    </View>
  );
}
