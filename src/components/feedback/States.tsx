import { router } from 'expo-router';
import { View } from 'react-native';

import { ApiError, errorMessage } from '@/core/api';
import { radius } from '@/theme';
import { Skeleton } from './Skeleton';
import { StateView } from './StateView';

/**
 * A failed read, said for what it is: offline (retry), gone or not allowed (no retry, since
 * trying again cannot help; back instead), or a server fault (retry). The server's own words
 * are the body.
 */
export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}) {
  const status = error instanceof ApiError ? error.status : undefined;
  const gone = status === 404 || status === 403;
  const offline = status === 0 || (error instanceof ApiError && error.code === 'network_error');
  const back = router.canGoBack() ? { label: 'Quay lại', onPress: () => router.back() } : undefined;
  return (
    <StateView
      tone={gone ? 'neutral' : 'danger'}
      icon={
        offline
          ? { sf: 'wifi.exclamationmark', md: 'wifi_off' }
          : gone
            ? { sf: status === 403 ? 'lock' : 'doc.text.magnifyingglass', md: status === 403 ? 'lock' : 'search_off' }
            : { sf: 'exclamationmark.triangle', md: 'error' }
      }
      title={title ?? (offline ? 'Không có kết nối mạng' : status === 404 ? 'Không tìm thấy' : status === 403 ? 'Không có quyền xem' : 'Không tải được dữ liệu')}
      body={errorMessage(error)}
      action={gone ? back : onRetry ? { label: 'Thử lại', onPress: onRetry } : undefined}
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
