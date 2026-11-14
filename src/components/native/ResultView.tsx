import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { colors, spring, statusTones, text, type StatusTone } from '@/theme';

/**
 * The end of a big task (a registration filed, a payment confirmed, a decision signed): one
 * mark that settles in with a success haptic as it lands, one sentence, what happens next,
 * and where to go. A rare moment, so it may move (expo-animation "delight" tier); with
 * Reduce Motion it simply appears.
 */
export function ResultView({
  tone = 'ok',
  icon,
  title,
  body,
  children,
  primary,
  secondary,
}: {
  tone?: StatusTone;
  icon?: { sf: string; md: string };
  title: string;
  body?: string;
  /** A short receipt (KeyValueList) of what was just done. */
  children?: ReactNode;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  const t = statusTones[tone];
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.set(withSpring(1, spring.stamp));
    // Fires as the mark lands, once.
    const id = setTimeout(() => void Haptics.notificationAsync(tone === 'danger' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success), reduce ? 0 : 220);
    return () => clearTimeout(id);
  }, [p, reduce, tone]);
  const mark = useAnimatedStyle(() => ({ opacity: Math.min(1, p.get() * 1.6), transform: [{ scale: 0.86 + 0.14 * p.get() }] }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 }}>
        <Animated.View style={[{ width: 112, height: 112, borderRadius: 56, backgroundColor: t.wash, alignItems: 'center', justifyContent: 'center' }, mark]}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white }}>
            <Icon sf={icon?.sf ?? 'checkmark'} md={icon?.md ?? 'check'} size={36} color={colors.white} weight="bold" />
          </View>
        </Animated.View>
        <Text accessibilityRole="header" style={[text.title1, { color: colors.ink, textAlign: 'center' }]}>{title}</Text>
        {body ? <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 320 }]}>{body}</Text> : null}
        {children ? <View style={{ alignSelf: 'stretch', marginTop: 6 }}>{children}</View> : null}
      </View>
      <KerbStrip height={5} />
      <View style={{ padding: 20, paddingBottom: Math.max(16, insets.bottom + 8), gap: 10, backgroundColor: colors.canvas }}>
        <Button label={primary.label} size={56} onPress={primary.onPress} />
        {secondary ? <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} /> : null}
      </View>
    </View>
  );
}
