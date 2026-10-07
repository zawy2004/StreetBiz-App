import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { HeroCard } from '@/components/common/HeroCard';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { requireAuth } from '@/core/auth/require-auth';
import { goTo } from '@/core/navigation/go';
import { ReviewCard } from '@/features/discovery/ReviewCard';
import { useVendorProfile } from '@/features/discovery/use-discovery';
import { formatDistance, formatRating } from '@/features/discovery/useActiveVendors';
import { spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

/** BUY-03: a licensed vendor's public profile. */
export default function VendorProfileScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useVendorProfile(id);
  const [tab, setTab] = useState<'info' | 'reviews'>('info');
  const p = profile.data;

  return (
    <>
      <StackHeader title="Hộ kinh doanh" />
      <Screen
        onRefresh={profile.refetch}
        refreshing={profile.isRefetching}
        footer={
          p ? (
            <>
              {p.storefrontId ? (
                <Button label="Xem thực đơn & đặt món" icon="silverware-fork-knife" onPress={() => goTo(`/customer/stores/${p.storefrontId}`)} />
              ) : null}
              <Button
                label="Viết đánh giá"
                variant={p.storefrontId ? 'outline' : 'primary'}
                icon="star-outline"
                onPress={() => requireAuth(`/customer/vendors/${id}/comment`) && goTo(`/customer/vendors/${id}/comment`)}
              />
            </>
          ) : undefined
        }
      >
        <QueryView query={profile}>
          {(v) =>
            !v ? (
              <EmptyState title="Hộ này chưa có giấy phép hợp lệ" />
            ) : (
              <>
                <HeroCard accent="green">
                  <View style={styles.head}>
                    <Thumb size={64} seed={v.vendorId + v.slotCode} icon="storefront-outline" />
                    <View style={styles.headBody}>
                      <AppText variant="title" style={{ color: colors.onHero }}>{v.name}</AppText>
                      <StatusChip code={v.permitStatus === 'ACTIVE' ? 'VALID' : v.permitStatus} />
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <AppText variant="labelSm" style={{ color: colors.onHero }}>★ {v.rating !== null ? formatRating(v.rating) : 'Mới'}</AppText>
                    <AppText variant="small" style={{ color: colors.heroMuted }}>
                      {[`${v.ratingCount} đánh giá`, v.distanceM !== null ? formatDistance(v.distanceM) : null, v.slotCode].filter(Boolean).join(' · ')}
                    </AppText>
                  </View>
                </HeroCard>

                <SegmentedControl
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'info', label: 'Thông tin' },
                    { value: 'reviews', label: `Đánh giá (${v.comments.length})` },
                  ]}
                />

                {tab === 'info' ? (
                  <KeyValueCard
                    rows={[
                      { label: 'Ô cấp phép', value: `${v.slotCode} · ${v.street}` },
                      ...(v.hours ? [{ label: 'Giờ bán', value: v.hours }] : []),
                      ...(v.address ? [{ label: 'Địa chỉ', value: v.address }] : []),
                      ...(v.ownerName ? [{ label: 'Chủ hộ', value: v.ownerName }] : []),
                      { label: 'Giấy phép', value: v.permitCode },
                      { label: 'Hiệu lực đến', value: formatDate(v.permitEndDate) },
                    ]}
                  />
                ) : v.comments.length ? (
                  v.comments.map((c) => <ReviewCard key={c.id} review={c} />)
                ) : (
                  <EmptyState icon="comment-text-outline" title="Chưa có đánh giá" />
                )}

                <Button label="Báo cáo hộ này" variant="ghost" icon="flag-outline" onPress={() => goTo(`/customer/vendors/${id}/report`)} />
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
