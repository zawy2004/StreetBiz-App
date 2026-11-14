import type { ReactNode } from 'react';
import { Pressable, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { easeOut } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
  selected?: boolean;
  hitSlop?: number;
  testID?: string;
};

/**
 * Buttons and cards: they sink to 0.97 on press-in in 120 ms (feedback the moment the finger
 * lands) and come back on release. Not for list rows — those highlight instead.
 */
export function PressableScale({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  disabled,
  selected,
  hitSlop,
  testID,
}: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const to = (value: number) => {
    if (!reduceMotion) scale.set(withTiming(value, { duration: 120, easing: easeOut }));
  };
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={12}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, selected }}
      testID={testID}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
