import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

/** A placeholder in the shape of what is loading, with a light sweeping across (web `.sb-shimmer`). */
export function Skeleton({
  width = '100%',
  height,
  radius = 12,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (!reduceMotion)
      x.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1);
  }, [reduceMotion, x]);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-100 + x.value * 200}%` }],
  }));
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.sunken, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
        <LinearGradient
          colors={['rgba(225,229,234,0)', colors.line, 'rgba(225,229,234,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}
