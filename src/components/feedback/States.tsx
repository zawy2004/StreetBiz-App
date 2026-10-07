import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { errorMessage } from '@/core/api/problem';
import { accentTone, spacing, useTheme, type AccentTone } from '@/theme';

import { AppText } from '../common/AppText';
import { Button } from '../common/Button';
import { Icon, type IconName } from '../common/Icon';

type EmptyProps = {
  icon?: IconName;
  title: string;
  description?: string;
  tone?: AccentTone;
  /** Optional call to action under the text (buttons, links). */
  children?: ReactNode;
};

export function EmptyState({ icon = 'tray-remove', title, description, tone = 'indigo', children }: EmptyProps) {
  const { colors } = useTheme();
  const t = accentTone(colors, tone);
  return (
    <View style={styles.box}>
      <View style={[styles.halo, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={34} color={t.fg} />
      </View>
      <View style={styles.text}>
        <AppText variant="headline" align="center">{title}</AppText>
        {description ? <AppText color="muted" align="center">{description}</AppText> : null}
      </View>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

export function ErrorState({ message = 'Có lỗi xảy ra.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState icon="alert-circle-outline" tone="error" title={message}>
      {onRetry ? <Button label="Thử lại" variant="outline" fullWidth={false} onPress={onRetry} /> : null}
    </EmptyState>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <ActivityIndicator color={colors.primary} />
      {label ? <AppText color="muted" align="center">{label}</AppText> : null}
    </View>
  );
}

type QueryLike<T> = { data: T | undefined; error: unknown; refetch: () => void };

/**
 * Renders `children(data)` once a data hook has something, a spinner while it
 * loads, and the backend's message with "Thử lại" when it failed.
 */
export function QueryView<T>({ query, children, loadingLabel }: { query: QueryLike<T>; children: (data: T) => ReactNode; loadingLabel?: string }) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error) return <ErrorState message={errorMessage(query.error)} onRetry={query.refetch} />;
  return <LoadingState label={loadingLabel} />;
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  halo: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  text: { gap: spacing.xs, maxWidth: 320 },
  actions: { alignSelf: 'stretch', gap: spacing.sm },
});
