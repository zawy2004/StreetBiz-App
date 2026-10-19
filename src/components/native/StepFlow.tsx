import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { colors, easeOut, fonts, tabular, text } from '@/theme';

/**
 * Where the person is in a multi-step task: "Bước 2/4", the step's name, and one bar per
 * step that fills as they go. Shown under the native header, never instead of it.
 */
export function StepProgress({ step, total, title, hint }: { step: number; total: number; title: string; hint?: string }) {
  return (
    <View style={{ gap: 8 }} accessible accessibilityRole="progressbar" accessibilityLabel={`Bước ${step} trên ${total}: ${title}`} accessibilityValue={{ min: 1, max: total, now: step }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <StepBar key={i} done={i < step} />
        ))}
      </View>
      <Text style={[{ fontFamily: fonts.semibold, fontSize: 13, color: colors.primary }, tabular]}>{`Bước ${step}/${total}`}</Text>
      <Text style={[text.title2, { color: colors.ink }]}>{title}</Text>
      {hint ? <Text style={[text.callout, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

function StepBar({ done }: { done: boolean }) {
  // State change, not decoration: the bar fills when its step is reached (expo-animation, ≤ 300 ms ease-out).
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(done ? 1 : 0, { duration: 260, easing: easeOut }) }] }));
  return (
    <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.sunken, overflow: 'hidden' }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: colors.cta, transformOrigin: 'left' }, fill]} />
    </View>
  );
}

/**
 * The bottom of a step: "Quay lại" (when there is a step before) and the one forward action
 * in thumb reach. Goes in `Screen`'s `footer`, so it sits above the home indicator.
 */
export function StepFooter({
  next,
  back,
  extra,
}: {
  next: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  back?: { label?: string; onPress: () => void };
  extra?: ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      {extra}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {back ? <Button label={back.label ?? 'Quay lại'} variant="secondary" size={56} onPress={back.onPress} style={{ flex: 1 }} /> : null}
        <Button label={next.label} size={56} onPress={next.onPress} disabled={next.disabled} loading={next.loading} style={{ flex: back ? 1.6 : 1 }} />
      </View>
    </View>
  );
}
