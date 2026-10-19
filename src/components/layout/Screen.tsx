import { useState, type ReactNode, type Ref } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

type Props = {
  children: ReactNode;
  /** The one action this screen exists for, pinned in thumb reach above the home indicator. */
  footer?: ReactNode;
  /** Pull to refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
  gap?: number;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra room at the bottom (for example under a floating bar). */
  bottomInset?: number;
  /** To scroll to a part of the screen (for example the section a status line points at). */
  scrollRef?: Ref<ScrollView>;
};

/**
 * The scrolling body of a stack screen: the scroll view is the first thing in the route
 * (so the native header and safe areas adjust it), the keyboard never covers the field
 * being typed, and an optional pinned footer holds the primary action.
 */
export function Screen({
  children,
  footer,
  refreshing,
  onRefresh,
  gap = 16,
  padded = true,
  contentStyle,
  bottomInset = 0,
  scrollRef,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [cap, setCap] = useState<{ windowKey: string; height: number } | null>(null);
  const windowKey = `${width}x${height}`;
  // Android native-stack workaround: back on a screen after the keyboard or a system dialog came
  // and went elsewhere, the screen was sometimes laid out as tall as if it had no header (+108 dp),
  // pushing the pinned footer and the last rows below the bottom edge (seen on the emulator, B1).
  // Remember the height measured with the keyboard down for this window size; never grow past it.
  const onLayout = (e: LayoutChangeEvent) => {
    if (process.env.EXPO_OS !== 'android' || Keyboard.isVisible()) return;
    if (!cap || cap.windowKey !== windowKey) setCap({ windowKey, height: e.nativeEvent.layout.height });
  };
  const maxHeight = cap?.windowKey === windowKey ? cap.height : undefined;
  return (
    <KeyboardAvoidingView
      onLayout={onLayout}
      style={{ flex: 1, maxHeight, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[
          {
            padding: padded ? space.md : 0,
            paddingBottom: (footer ? 112 : 32) + bottomInset,
            gap,
          },
          contentStyle,
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={colors.cta}
              colors={[colors.cta]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
          }}
        >
          <SafeAreaView edges={['bottom']} mode="padding">
            <View style={{ paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
              {footer}
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
