import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts, tabular } from '@/theme';
import { HOLD_WARNING_SECONDS, holdFraction } from '../plan-labels';
import { formatCountdown, secondsUntil } from '../slot-format';

/**
 * The 15-minute hold as a ring that empties, with the time left inside. Orange while there
 * is time, deep red under two minutes (and the words say it too).
 */
export function HoldRing({ heldAt, expiresAt, nowMs, size = 52 }: { heldAt: string; expiresAt: string; nowMs: number; size?: number }) {
  const seconds = secondsUntil(expiresAt, nowMs);
  const fraction = holdFraction(heldAt, expiresAt, nowMs);
  const ending = seconds <= HOLD_WARNING_SECONDS;
  const stroke = 4.5;
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
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.sunken} strokeWidth={stroke} fill="none" />
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
      <Text style={[{ fontFamily: fonts.bold, fontSize: size > 48 ? 12 : 10.5, color: ending ? colors.onDanger : colors.ink }, tabular]}>
        {formatCountdown(seconds)}
      </Text>
    </View>
  );
}
