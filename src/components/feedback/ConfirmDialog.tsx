import { Modal, Pressable, StyleSheet, View } from 'react-native';

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
};

export function ConfirmDialog({ visible, title, description, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onCancel}>
        <Pressable style={[styles.box, { backgroundColor: colors.card, borderColor: colors.indigo }]}>
          <AppText variant="title">{title}</AppText>
          {description ? <AppText color="muted">{description}</AppText> : null}
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
  box: { borderRadius: radius.card, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  half: { flex: 1 },
});
