import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { communityApi, MY_REPORTS_PAGE_SIZE, type MyVendorReport, type VendorReportType } from '@/features/vendor-map/community-api';
import { CityFeedbackLinks } from '@/features/vendor-map/components/PriceBoardPanel';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { REPORT_TYPE_ICONS, reportStatusLabel, reportTypeLabel } from '../report-view';

const go = (href: string) => router.push(href as Href);
const MY_REPORTS_KEY = ['community', 'my-reports'] as const;
const typeIcon = (type: string) => REPORT_TYPE_ICONS[type as VendorReportType] ?? REPORT_TYPE_ICONS.GENERAL;

/** One line on where a report stands: the due time while it waits, the outcome once closed. */
function standing(r: MyVendorReport): string {
  if (r.status === 'PENDING') return r.dueAt ? `${r.isOverdue ? 'Quá hạn từ' : 'Hạn xử lý'} ${formatVietnamDateTime(r.dueAt)}` : 'Đang chờ phường xem';
  if (r.refundAmount) return `Được hoàn ${formatVnd(r.refundAmount)}`;
  return r.reviewedAt ? `Đóng lúc ${formatVietnamDateTime(r.reviewedAt)}` : 'Đã đóng';
}

function SignInFirst() {
  return (
    <StateView
      icon={{ sf: 'person.crop.circle.badge.questionmark', md: 'account_circle' }}
      title="Đăng nhập để xem phản ánh"
      body="Phản ánh gắn với tài khoản người mua của bạn, để phường gửi kết quả cho bạn."
      action={{ label: 'Đăng nhập', onPress: () => go('/auth/sign-in') }}
    />
  );
}

/**
 * Phản ánh của tôi (BUY-05, BUY-07): the buyer's own reports, newest first, each with where it
 * stands (the ward's due time while it waits, the outcome once closed). The detail says how the
 * ward closed it, why, and any refund.
 */
export function MyReportsScreen() {
  const user = useAuthStore((s) => s.user);
  const list = useInfiniteQuery({
    queryKey: MY_REPORTS_KEY,
    queryFn: ({ pageParam }) => communityApi.myReports(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length >= MY_REPORTS_PAGE_SIZE ? all.length + 1 : undefined),
    enabled: user?.role_code === 'CUSTOMER',
  });
  const rows = list.data?.pages.flat() ?? [];

  if (user?.role_code !== 'CUSTOMER') {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Phản ánh của tôi' }} />
        <SignInFirst />
      </Screen>
    );
  }
  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching && !list.isFetchingNextPage} gap={14}>
      <Stack.Screen options={{ title: 'Phản ánh của tôi' }} />
      {list.isPending ? (
        <ListSkeleton rows={4} height={96} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <StateView
          icon={{ sf: 'exclamationmark.bubble', md: 'feedback' }}
          tone="neutral"
          title="Chưa có phản ánh nào"
          body="Quét mã QR ở quầy để xem giấy phép và bảng giá; từ đó bạn phản ánh được nếu có vấn đề."
          action={{ label: 'Quét mã QR', onPress: () => router.navigate('/customer/scan' as Href) }}
        />
      ) : (
        <>
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
            {rows.map((r, i) => {
              const s = reportStatusLabel(r);
              const icon = typeIcon(r.reportType);
              return (
                <Pressable
                  key={r.reportId}
                  onPress={() => go(`/customer/account/reports/${r.reportId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${reportTypeLabel(r.reportType)}, ${r.vendorName ?? 'Hộ kinh doanh'}, ${s.label}. ${standing(r)}`}
                  style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator })}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={icon.sf} md={icon.md} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>{r.vendorName ?? 'Hộ kinh doanh'}</Text>
                      {r.slotCode ? <Plate code={r.slotCode} /> : null}
                    </View>
                    <Text style={[text.footnote, { fontFamily: fonts.semibold, color: colors.ink }]}>{reportTypeLabel(r.reportType)}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <StatusPill label={s.label} tone={s.tone} />
                      <Text style={[text.caption, tabular, { color: colors.muted }]}>{standing(r)}</Text>
                    </View>
                  </View>
                  <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} style={{ marginTop: 14 }} />
                </Pressable>
              );
            })}
          </View>
          {list.hasNextPage ? <Button label="Tải thêm" variant="secondary" loading={list.isFetchingNextPage} onPress={() => void list.fetchNextPage()} /> : null}
        </>
      )}
    </Screen>
  );
}

/** Pages through the buyer's own reports until this one turns up (there is no single-report read). */
async function findMyReport(reportId: number): Promise<MyVendorReport> {
  for (let page = 1; page <= 50; page++) {
    const rows = await communityApi.myReports(page);
    const found = rows.find((r) => r.reportId === reportId);
    if (found) return found;
    if (rows.length < MY_REPORTS_PAGE_SIZE) break;
  }
  throw new Error('Không tìm thấy phản ánh này trong tài khoản của bạn.');
}

/**
 * Một phản ánh của tôi: where it stands at the top (the ward's due time, or the outcome), the
 * stall, the price comparison the server made for an overcharge, what was sent, and how the ward
 * closed it: the reason for "Bác", the note and any refund for "Đã hòa giải", or that a biên bản
 * was recorded. A notification about the report opens here.
 */
export function MyReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const id = Number(reportId);
  const user = useAuthStore((s) => s.user);
  const report = useQuery({ queryKey: [...MY_REPORTS_KEY, 'detail', id], queryFn: () => findMyReport(id), enabled: user?.role_code === 'CUSTOMER' && Number.isSafeInteger(id) && id > 0 });

  if (user?.role_code !== 'CUSTOMER') {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Phản ánh' }} />
        <SignInFirst />
      </Screen>
    );
  }
  if (report.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Phản ánh' }} />
        <Skeleton height={88} radius={radius.card} />
        <ListSkeleton rows={3} height={96} />
      </Screen>
    );
  }
  if (report.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Phản ánh' }} />
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      </Screen>
    );
  }
  const r = report.data;
  const s = reportStatusLabel(r);
  const e = r.priceEvidence;
  const closed = r.status !== 'PENDING';
  const headline =
    r.status === 'PENDING'
      ? r.dueAt
        ? `${r.isOverdue ? 'Đã quá hạn xử lý từ' : 'Phường xử lý trước'} ${formatVietnamDateTime(r.dueAt)}. Bạn nhận thông báo khi có kết quả.`
        : 'Bạn nhận thông báo khi có kết quả.'
      : r.reviewedAt
        ? `Phường đóng phản ánh lúc ${formatVietnamDateTime(r.reviewedAt)}.`
        : undefined;

  return (
    <Screen onRefresh={() => void report.refetch()} refreshing={report.isRefetching} gap={18}>
      <Stack.Screen options={{ title: `Phản ánh #${r.reportId}` }} />
      <StatusHeader tone={s.tone} title={s.label} detail={headline} />

      {closed ? (
        <View style={{ padding: 16, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Kết quả</Text>
          <KeyValueList
            rows={[
              { label: 'Phường', value: s.label, emphasis: true },
              r.refundAmount ? { label: 'Số tiền được hoàn', value: formatVnd(r.refundAmount), emphasis: true } : null,
            ]}
          />
          {r.resolutionNote ? (
            <View style={{ gap: 4 }}>
              <Text style={[text.caption, { color: colors.muted }]}>{r.resolution === 'DISMISSED' ? 'Lý do' : r.resolution === 'VIOLATION_RECORDED' ? 'Biên bản' : 'Ghi chú của phường'}</Text>
              <Text style={[text.callout, { color: colors.ink }]}>{r.resolutionNote}</Text>
            </View>
          ) : null}
          {r.resolution === 'VIOLATION_RECORDED' ? <Text style={[text.footnote, { color: colors.muted }]}>Phường đã lập biên bản vi phạm với quầy; việc xử phạt do người có thẩm quyền quyết định.</Text> : null}
        </View>
      ) : null}

      <View style={{ padding: 16, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.ink }}>{r.vendorName ?? 'Hộ kinh doanh'}</Text>
          {r.slotCode ? <Plate code={r.slotCode} /> : null}
        </View>
        <KeyValueList
          rows={[
            { label: 'Loại', value: reportTypeLabel(r.reportType) },
            { label: 'Gửi lúc', value: formatVietnamDateTime(r.createdAt) },
            r.hasPhoto ? { label: 'Ảnh', value: 'Đã gửi (chỉ cán bộ phường xem)' } : null,
          ]}
        />
        <View style={{ gap: 4 }}>
          <Text style={[text.caption, { color: colors.muted }]}>Nội dung bạn gửi</Text>
          <Text style={[text.callout, { color: colors.ink }]}>{r.reason}</Text>
        </View>
      </View>

      {e ? (
        <View style={{ padding: 16, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Đối chiếu giá lúc mua</Text>
          <Text style={[text.footnote, { color: colors.muted }]}>Máy chủ lấy giá niêm yết đúng lúc bạn mua, từ lịch sử bảng giá của quầy.</Text>
          <KeyValueList
            rows={[
              { label: 'Món', value: e.itemName },
              { label: 'Lúc mua', value: formatVietnamDateTime(e.purchasedAt) },
              { label: 'Giá niêm yết', value: `${formatVnd(e.postedUnitPrice)} / ${e.priceUnit} (bản số ${e.priceVersion})` },
              { label: 'Niêm yết × số lượng', value: `${formatVnd(e.postedAmount)} (${e.quantity} ${e.priceUnit})` },
              { label: 'Bạn đã trả', value: formatVnd(e.chargedAmount) },
              { label: 'Chênh lệch', value: <Text style={[sign.price, tabular, { color: colors.danger }]}>{`+${formatVnd(e.difference)}`}</Text> },
            ]}
          />
        </View>
      ) : null}

      {r.resolution === 'DISMISSED' ? (
        <>
          <Banner tone="neutral" title="Chưa đồng ý với kết quả?">Bạn có thể phản ánh tiếp qua kênh 1022 của thành phố.</Banner>
          <CityFeedbackLinks />
        </>
      ) : null}
    </Screen>
  );
}
