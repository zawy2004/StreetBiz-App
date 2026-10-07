import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Avatar } from '@/components/common/Avatar';
import { Card } from '@/components/common/Card';
import { RatingStars } from '@/components/forms/RatingStars';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

import type { ReviewView } from './use-discovery';

export function ReviewCard({ review }: { review: ReviewView }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        {review.author ? <Avatar name={review.author} size={32} /> : null}
        <AppText variant="label" style={styles.author}>{review.author ?? 'Người mua'}</AppText>
        <AppText variant="caption" color="muted">{formatDate(review.createdAt)}</AppText>
      </View>
      {review.rating !== null ? <RatingStars value={review.rating} size={18} /> : null}
      {review.text ? <AppText>{review.text}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flex: 1 },
});
