import * as Haptics from 'expo-haptics';
import { useRef, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/components/common/Icon';
import { colors, fonts } from '@/theme';

export type SwipeAction = {
  id: string;
  label: string;
  icon: { sf: string; md: string };
  /** `danger` is red and belongs at the trailing edge; it still confirms before acting. */
  tone?: 'danger' | 'brand' | 'sign' | 'neutral';
  onPress: () => void;
};

const fills = { danger: colors.danger, brand: colors.cta, sign: colors.sign, neutral: '#5B6676' } as const;

/**
 * A row whose own actions sit behind a swipe to the left (the iOS Mail / Gmail pattern),
 * with a light haptic when they open. Swiping is never the only way: every action here must
 * also exist on the row's detail screen or in its long-press menu (WCAG dragging alternative).
 */
export function SwipeRow({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const ref = useRef<SwipeableMethods>(null);
  if (actions.length === 0) return <>{children}</>;
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      renderRightActions={() => (
        <View style={{ flexDirection: 'row' }}>
          {actions.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                ref.current?.close();
                a.onPress();
              }}
              style={({ pressed }) => ({ width: 84, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: fills[a.tone ?? 'neutral'], opacity: pressed ? 0.85 : 1 })}
            >
              <Icon sf={a.icon.sf} md={a.icon.md} size={20} color={colors.white} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.white }} numberOfLines={1}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
