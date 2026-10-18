import { View } from 'react-native';

import { errorMessage } from '@/core/api';
import { radius } from '@/theme';
import { Skeleton } from './Skeleton';
import { StateView } from './StateView';

/** "Không tải được…" with the server's own words and a retry, for any failed read. */
export function ErrorState({
  title = 'Không tải được dữ liệu',
  error,
  onRetry,
}: {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <StateView
      tone="danger"
      icon={{ sf: 'wifi.exclamationmark', md: 'wifi_off' }}
      title={title}
      body={errorMessage(error)}
      action={onRetry ? { label: 'Thử lại', onPress: onRetry } : undefined}
    />
  );
}

/** Placeholder cards shaped like the list that is loading. */
export function ListSkeleton({ rows = 4, height = 76 }: { rows?: number; height?: number }) {
  return (
    <View style={{ gap: 10 }} accessibilityLabel="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={radius.card} />
      ))}
    </View>
  );
}
