import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Button } from '../common/Button';
import { Icon, type IconName } from '../common/Icon';

export function EmptyState({ icon = 'tray-remove', title, description }: { icon?: IconName; title: string; description?: string }) {
  return (
    <View style={styles.box}>
      <Icon name={icon} size={40} color="muted" />
      <AppText variant="headline" align="center">{title}</AppText>
      {description ? <AppText color="muted" align="center">{description}</AppText> : null}
    </View>
  );
}

export function ErrorState({ message = 'Có lỗi xảy ra.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.box}>
      <Icon name="alert-circle-outline" size={40} color="error" />
      <AppText align="center">{message}</AppText>
      {onRetry ? <Button label="Thử lại" variant="outline" fullWidth={false} onPress={onRetry} /> : null}
    </View>
  );
}

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
});
