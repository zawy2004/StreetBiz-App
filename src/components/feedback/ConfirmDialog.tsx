import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Button } from '../common/Button';

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content between the text and the buttons, e.g. a reason field. */
  children?: ReactNode;
};

export function ConfirmDialog({ visible, title, description, confirmLabel, danger, onConfirm, onCancel, children }: Props) {
  const { colors, shadow } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onCancel}>
        <Pressable style={[styles.box, shadow.raised, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AppText variant="title">{title}</AppText>
          {description ? <AppText color="muted">{description}</AppText> : null}
          {children}
          <View style={styles.actions}>
            <View style={styles.half}><Button label="Huỷ" variant="outline" onPress={onCancel} /></View>
            <View style={styles.half}>
              <Button
                label={confirmLabel}
                variant={danger ? 'danger' : 'primary'}
                onPress={onConfirm}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  box: { borderRadius: radius.sheet, borderWidth: StyleSheet.hairlineWidth, padding: spacing.xl, gap: spacing.md, maxWidth: 440, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  half: { flex: 1 },
});
