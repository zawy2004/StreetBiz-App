import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState } from '@/components/feedback/States';
import { RatingStars } from '@/components/forms/RatingStars';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { requireAuth } from '@/core/auth/require-auth';
import { goTo } from '@/core/navigation/go';
import { formatDistance, formatRating, useActiveVendors } from '@/features/discovery/useActiveVendors';
import { useMockDb } from '@/mocks/db';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

export default function VendorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useActiveVendors().find((v) => v.vendor.id === id);
  const comments = useMockDb((s) => s.comments).filter((c) => c.vendorId === id);
  const [tab, setTab] = useState<'info' | 'reviews'>('info');

  if (!item) {
    return (
      <>
        <StackHeader title="Hộ kinh doanh" />
        <Screen><EmptyState title="Hộ này chưa có giấy phép hợp lệ" /></Screen>
      </>
    );
  }

  const { vendor, slot, permit, storefront } = item;

  return (
    <>
      <StackHeader title="Hộ kinh doanh" />
      <Screen
        footer={
          <>
            <Button label="Viết đánh giá" onPress={() => requireAuth() && goTo(`/customer/vendors/${id}/comment`)} />
            {storefront ? (
              <Button label="Xem thực đơn" variant="outline" onPress={() => goTo(`/customer/stores/${storefront.id}`)} />
            ) : null}
          </>
        }
      >
        <View style={styles.head}>
          <Thumb size={72} />
          <View style={styles.headBody}>
            <AppText variant="title">{storefront?.name ?? vendor.business_name}</AppText>
            <StatusChip code="VALID" />
            <AppText variant="small" color="muted">★ {formatRating(item.rating)} ({item.ratingCount}) · {formatDistance(item.distanceM)}</AppText>
          </View>
        </View>

        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'info', label: 'Thông tin' },
            { value: 'reviews', label: 'Đánh giá' },
          ]}
        />

        {tab === 'info' ? (
          <KeyValueCard
            rows={[
              { label: 'Ô cấp phép', value: `${slot.slot_code} · ${slot.street}` },
              { label: 'Giờ bán', value: storefront ? `${storefront.openTime} - ${storefront.closeTime}` : slot.time_window },
              { label: 'Chủ hộ', value: vendor.owner_name },
              { label: 'Giấy phép', value: permit.permit_code },
            ]}
          />
        ) : comments.length ? (
          comments.map((c) => (
            <Card key={c.id} style={styles.review}>
              <View style={styles.reviewHead}>
                <AppText variant="label">{c.authorName}</AppText>
                <AppText variant="small" color="muted">{formatDate(c.created_at)}</AppText>
              </View>
              <RatingStars value={c.rating} size={18} />
              <AppText>{c.text}</AppText>
            </Card>
          ))
        ) : (
          <EmptyState icon="comment-text-outline" title="Chưa có đánh giá" />
        )}

        <Button label="Báo cáo hộ này" variant="ghost" icon="flag-outline" onPress={() => goTo(`/customer/vendors/${id}/report`)} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1, gap: spacing.xs },
  review: { gap: spacing.sm },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between' },
});
