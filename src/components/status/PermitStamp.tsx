import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Icon } from '@/components/common/Icon';
import { fonts, spring } from '@/theme';

const RING_TEXT = 'GIẤY PHÉP VỈA HÈ ★ STREETBIZ ★ ';

type Props = {
  size?: number;
  ink: string;
  /** Press it down once (the one delight moment of the permit); false renders it already stamped. */
  animate?: boolean;
};

/**
 * The ward stamp on a valid permit (web `PermitStamp`): two rings, the words running round,
 * a check in the middle. It is pressed down once when a valid permit first appears, with a
 * success haptic as it lands — never again on refresh. Decoration: the verdict is in words beside it.
 */
export function PermitStamp({ size = 96, ink, animate = false }: Props) {
  const reduceMotion = useReducedMotion();
  const play = animate && !reduceMotion;
  const p = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    p.set(withDelay(260, withSpring(1, spring.stamp)));
    // The haptic fires as the stamp meets the paper, not when the motion starts.
    const t = setTimeout(
      () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      400,
    );
    return () => clearTimeout(t);
  }, [p, play]);
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.02 ? 0 : 0.92,
      transform: [{ scale: 1.3 - 0.3 * v }, { rotate: `${-16 + 8 * v}deg` }],
    };
  });

  const r = size * 0.36;
  const chars = Array.from(RING_TEXT);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style]}
    >
      <View
        style={[
          styles.ring,
          { borderRadius: size / 2, borderColor: ink, borderWidth: size * 0.03 },
        ]}
      />
      <View
        style={[
          styles.ring,
          { margin: size * 0.21, borderRadius: size, borderColor: ink, borderWidth: size * 0.018 },
        ]}
      />
      {chars.map((ch, i) => (
        <View
          key={i}
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'center', transform: [{ rotate: `${(i / chars.length) * 360}deg` }] },
          ]}
        >
          <Text
            style={{
              marginTop: size / 2 - r - size * 0.09,
              fontFamily: fonts.code,
              fontSize: size * 0.088,
              lineHeight: size * 0.11,
              color: ink,
            }}
          >
            {ch}
          </Text>
        </View>
      ))}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Icon sf="checkmark" md="check" size={size * 0.26} color={ink} weight="bold" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
