import { BottomSheet, RNHostView } from '@expo/ui';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

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

/**
 * A native bottom sheet (`@expo/ui`: Compose ModalBottomSheet on Android, a SwiftUI sheet on
 * iPhone) for a short choice. Drag down, tap outside or press back to dismiss. The React Native
 * content sits in an RNHostView, which takes the sheet's width and grows to its own height.
 */
export function Sheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onClose}
      containerColor={colors.bg}
      contentPadding={{ left: 16, right: 16, bottom: 28 }}
    >
      <RNHostView matchContents={{ vertical: true }}>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 2, paddingHorizontal: 4 }}>
            <Text style={[text.title2, { color: colors.ink }]}>{title}</Text>
            {subtitle ? (
              <Text style={[text.footnote, { color: colors.muted }]}>{subtitle}</Text>
            ) : null}
          </View>
          <View style={{ borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }}>
            {children}
          </View>
          {footer}
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
