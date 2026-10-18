import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
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
}: Props) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
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
            backgroundColor: 'rgba(247,248,250,0.97)',
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
