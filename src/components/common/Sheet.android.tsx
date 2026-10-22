import { Host, RNHostView } from '@expo/ui';
import { Column, ModalBottomSheet, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { height, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { colors, text } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Below the grouped rows: a total, a primary button. */
  footer?: ReactNode;
};

const SIDE = 16;
const BOTTOM = 28;

/**
 * Android version of the choice sheet. The universal sheet opens at half the screen and a hosted
 * React Native view fills whatever height Compose offers, so a short list sat on a blank band.
 * Here the content is measured off screen first, then the Compose sheet opens fully expanded
 * with its column pinned to that height (RN layout and Compose modifiers are both in dp).
 * Same props as `Sheet.tsx`.
 */
export function Sheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  const { width } = useWindowDimensions();
  const ref = useRef<ModalBottomSheetRef>(null);
  const [mounted, setMounted] = useState(visible);
  const [contentHeight, setContentHeight] = useState(0);

  // Mount as soon as it is asked for (adjusting state during render, not in an effect)...
  if (visible && !mounted) setMounted(true);

  // ...and stay mounted until the hide animation has finished.
  useEffect(() => {
    if (visible) return;
    let cancelled = false;
    void ref.current?.hide().then(() => {
      if (!cancelled) setMounted(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const content = (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Text style={[text.title2, { color: colors.ink }]}>{title}</Text>
        {subtitle ? <Text style={[text.footnote, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>{children}</View>
      {footer}
    </View>
  );

  return (
    <>
      {/* Invisible copy at the sheet's width, only to learn the content height */}
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ position: 'absolute', left: -10000, top: 0, width: width - 2 * SIDE, opacity: 0 }}
        onLayout={(e) => setContentHeight(Math.ceil(e.nativeEvent.layout.height))}
      >
        {content}
      </View>

      {mounted && contentHeight > 0 ? (
        <Host style={{ position: 'absolute' }} pointerEvents="none">
          <ModalBottomSheet
            ref={ref}
            onDismissRequest={onClose}
            skipPartiallyExpanded
            containerColor={colors.bg}
          >
            <Column modifiers={[padding(SIDE, 0, SIDE, BOTTOM), height(contentHeight + BOTTOM)]}>
              <RNHostView>{content}</RNHostView>
            </Column>
          </ModalBottomSheet>
        </Host>
      ) : null}
    </>
  );
}
