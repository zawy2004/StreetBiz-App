import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius, statusTones, text, type StatusTone } from '@/theme';

/**
 * Where a record stands, said once at the top of its screen: a verdict icon, one line, an
 * optional second line, and at most one action. It replaces paragraphs of banner text; the
 * longer explanation, if any, goes behind "Tìm hiểu" further down.
 */
export function StatusHeader({
  tone,
  title,
  detail,
  icon,
  action,
  aside,
}: {
  tone: StatusTone;
  title: string;
  detail?: string;
  /** Overrides the verdict's own icon. */
  icon?: { sf: string; md: string };
  action?: { label: string; onPress: () => void };
  /** Something compact on the right: a code plate, a countdown. */
  aside?: ReactNode;
}) {
  const t = statusTones[tone];
  return (
    <View
      accessible={!action}
      accessibilityRole={action ? undefined : 'summary'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: t.wash }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon?.sf ?? t.sf} md={icon?.md ?? t.md} size={21} color={t.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.headline, { color: t.ink }]}>{title}</Text>
        {detail ? <Text style={[text.footnote, { color: t.ink }]}>{detail}</Text> : null}
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 4, minHeight: 28, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: t.ink, textDecorationLine: 'underline' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {aside}
    </View>
  );
}
