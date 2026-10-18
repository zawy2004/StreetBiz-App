import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeaderIconButton, KeyValueList, SectionHeader, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { useNotificationUnreadCount } from '@/features/notifications/notifications-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, space, tabular, text } from '@/theme';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { platformApi, type FoodCategory } from '../platform-api';

const go = (href: string) => router.push(href as Href);
const CONTENT_TYPE: Record<string, string> = { STOREFRONT: 'Gian hàng', MENU_ITEM: 'Món ăn', REVIEW: 'Đánh giá' };
const COMPLAINT_OPEN = ['OPEN', 'UNDER_REVIEW'];

function useQueues() {
  const reports = useQuery({ queryKey: ['platform', 'reported-content'], queryFn: () => platformApi.reportedContent() });
  const complaints = useQuery({ queryKey: ['platform', 'order-complaints'], queryFn: () => platformApi.complaints() });
  const categories = useQuery({ queryKey: ['platform', 'categories'], queryFn: platformApi.categories });
  return { reports, complaints, categories };
}

/**
 * A01 Tổng quan quản trị: what waits on the platform team, from the live queues. The platform
 * runs the marketplace; it holds no sidewalk compliance authority (that is the ward's).
 */
export function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const unread = useNotificationUnreadCount();
  const { reports, complaints, categories } = useQueues();
  const pendingReports = reports.data?.items.filter((r) => r.status === 'PENDING').length;
  const openComplaints = complaints.data?.items.filter((c) => COMPLAINT_OPEN.includes(c.status)).length;
  const refreshing = reports.isRefetching || complaints.isRefetching;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 22, lineHeight: 28, color: colors.ink }}>Quản trị nền tảng</Text>
          <Text style={[text.footnote, { color: colors.muted }]}>{user?.fullName ?? ''}</Text>
        </View>
        <HeaderIconButton icon={{ sf: 'bell.fill', md: 'notifications' }} label="Thông báo" badge={unread} onPress={() => go('/notifications')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingTop: 4, gap: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void Promise.all([reports.refetch(), complaints.refetch(), categories.refetch()])} tintColor={colors.cta} colors={[colors.cta]} />}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Big value={pendingReports} label="Nội dung chờ xử lý" wash={colors.dangerTint} ink={colors.onDanger} onPress={() => go('/platform/moderation?tab=CONTENT')} />
          <Big value={openComplaints} label="Khiếu nại đang mở" wash={colors.mangoTint} ink={colors.onMango} onPress={() => go('/platform/moderation?tab=COMPLAINTS')} />
        </View>
        <Big value={categories.data?.length} label="Danh mục món đang dùng" wash={colors.signTint} ink={colors.sign} onPress={() => router.navigate('/platform/categories' as Href)} />
        {reports.isError || complaints.isError ? <Banner tone="danger">{errorMessage(reports.error ?? complaints.error)}</Banner> : null}
        <Banner tone="neutral" icon={{ sf: 'building.columns', md: 'account_balance' }} title="Phạm vi quản trị">
          Quản trị nền tảng xử lý danh mục, kiểm duyệt nội dung và khiếu nại đơn. Cấp phép vỉa hè, vi phạm và mức phạt thuộc Cán bộ Phường.
        </Banner>
        <ListGroup title="Lối tắt">
          <ListRow title="Kiểm duyệt nội dung" icon={{ sf: 'flag.fill', md: 'flag' }} tint={colors.danger} tileColor={colors.dangerTint} onPress={() => router.navigate('/platform/moderation' as Href)} />
          <ListRow title="Danh mục món" icon={{ sf: 'square.grid.2x2.fill', md: 'category' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => router.navigate('/platform/categories' as Href)} />
          <ListRow title="Tài khoản người dùng" icon={{ sf: 'person.3.fill', md: 'group' }} onPress={() => router.navigate('/platform/accounts' as Href)} />
        </ListGroup>
      </ScrollView>
    </View>
  );
}

function Big({ value, label, wash, ink, onPress }: { value: number | undefined; label: string; wash: string; ink: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'đang tải'}`} style={({ pressed }) => ({ flex: 1, padding: 16, gap: 4, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: wash, opacity: pressed ? 0.85 : 1 })}>
      <Text style={[{ fontFamily: fonts.code, fontSize: 38, lineHeight: 42, color: ink }, tabular]}>{value ?? '·'}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: ink }}>{label}</Text>
    </Pressable>
  );
}

/** A02 Tài khoản: the web's page runs on demo data only; the server has no endpoint for it yet. */
export function AdminAccountsScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Tài khoản' }} />
      <StateView icon={{ sf: 'person.3', md: 'group' }} tone="neutral" title="Chưa nối máy chủ" body="Máy chủ chưa có API quản lý tài khoản người dùng, nên màn này chưa hiện dữ liệu thật. Không hiển thị dữ liệu minh hoạ thay thế." />
    </Screen>
  );
}

/** A03 Danh mục món (ADM-02): add, rename, remove (only when no dish uses it). */
export function AdminCategoriesScreen() {
  const cache = useQueryClient();
  const categories = useQuery({ queryKey: ['platform', 'categories'], queryFn: platformApi.categories });
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const refresh = () => void cache.invalidateQueries({ queryKey: ['platform', 'categories'] });
  const create = useMutation({ mutationFn: () => platformApi.createCategory(name.trim()), onSuccess: () => { setName(''); refresh(); showToast('Đã thêm danh mục'); }, onError: (e) => showToast(errorMessage(e), 'error') });
  const rename = useMutation({ mutationFn: () => platformApi.renameCategory(editing!.id, editing!.name.trim()), onSuccess: () => { setEditing(null); refresh(); showToast('Đã đổi tên'); }, onError: (e) => showToast(errorMessage(e), 'error') });
  const remove = useMutation({ mutationFn: (id: number) => platformApi.deleteCategory(id), onSuccess: () => { refresh(); showToast('Đã xoá danh mục'); }, onError: (e) => showToast(errorMessage(e), 'error') });
  const ask = (c: FoodCategory) => Alert.alert(`Xoá "${c.categoryName}"?`, 'Chỉ xoá được danh mục chưa có món.', [{ text: 'Giữ', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate(c.categoryId) }]);
  return (
    <Screen onRefresh={() => void categories.refetch()} refreshing={categories.isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Danh mục món' }} />
      <Card style={{ gap: 8 }}>
        <TextField label="Danh mục mới" value={name} onChangeText={setName} placeholder="VD: Bún - Phở" maxLength={100} />
        <Button label="Thêm danh mục" icon={{ sf: 'plus', md: 'add' }} loading={create.isPending} disabled={!name.trim()} onPress={() => create.mutate()} />
      </Card>
      {categories.isPending ? (
        <ListSkeleton rows={5} height={64} />
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        categories.data.map((c) =>
          editing?.id === c.categoryId ? (
            <Card key={c.categoryId} style={{ gap: 8 }}>
              <TextField label="Tên mới" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} maxLength={100} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Huỷ" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
                <Button label="Lưu" loading={rename.isPending} disabled={!editing.name.trim()} onPress={() => rename.mutate()} style={{ flex: 1.4 }} />
              </View>
            </Card>
          ) : (
            <View key={c.categoryId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
              <View style={{ flex: 1 }}>
                <Text style={[text.subhead, { color: colors.ink }]}>{c.categoryName}</Text>
                <Text style={[text.caption, { color: colors.muted }]}>{c.itemCount} món{c.createdByName ? ` · tạo bởi ${c.createdByName}` : ''}</Text>
              </View>
              <Pressable onPress={() => setEditing({ id: c.categoryId, name: c.categoryName })} accessibilityRole="button" accessibilityLabel={`Đổi tên ${c.categoryName}`} hitSlop={8} style={{ padding: 6 }}>
                <Icon sf="pencil" md="edit" size={18} color={colors.sign} />
              </Pressable>
              {c.itemCount === 0 ? (
                <Pressable onPress={() => ask(c)} accessibilityRole="button" accessibilityLabel={`Xoá ${c.categoryName}`} hitSlop={8} style={{ padding: 6 }}>
                  <Icon sf="trash" md="delete" size={18} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ),
        )
      )}
    </Screen>
  );
}

type Tab = 'CONTENT' | 'COMPLAINTS';

/** A04 Kiểm duyệt (ADM-03/04/05): reported content and order complaints, what needs action first. */
export function ModerationScreen() {
  const { tab: initial } = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(initial === 'COMPLAINTS' ? 'COMPLAINTS' : 'CONTENT');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const { reports, complaints } = useQueues();
  const active = tab === 'CONTENT' ? reports : complaints;
  return (
    <Screen onRefresh={() => void active.refetch()} refreshing={active.isRefetching} gap={10}>
      <Stack.Screen options={{ title: 'Kiểm duyệt' }} />
      <Segments<Tab> value={tab} onChange={setTab} options={[{ key: 'CONTENT', label: 'Nội dung', count: reports.data?.items.filter((r) => r.status === 'PENDING').length }, { key: 'COMPLAINTS', label: 'Khiếu nại đơn', count: complaints.data?.items.filter((c) => COMPLAINT_OPEN.includes(c.status)).length }]} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Cần xử lý" selected={onlyOpen} onPress={() => setOnlyOpen(true)} accessibilityRole="radio" />
        <Chip label="Tất cả" selected={!onlyOpen} onPress={() => setOnlyOpen(false)} accessibilityRole="radio" />
      </View>
      {active.isPending ? (
        <ListSkeleton rows={4} height={96} />
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      ) : tab === 'CONTENT' ? (
        (() => {
          const rows = reports.data!.items.filter((r) => !onlyOpen || r.status === 'PENDING');
          return rows.length === 0 ? (
            <StateView icon={{ sf: 'flag', md: 'flag' }} tone="neutral" title="Không có nội dung cần xử lý" body="Báo cáo mới từ người dùng sẽ hiện ở đây." />
          ) : (
            rows.map((r) => (
              <Pressable key={r.reportId} onPress={() => go(`/platform/moderation/content/${r.reportId}`)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: r.status === 'PENDING' ? 1.5 : 0, borderColor: colors.danger })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <StatusPill label={CONTENT_TYPE[r.contentType] ?? r.contentType} tone="neutral" />
                  <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>{r.contentTitle}</Text>
                  <StatusPill label={statusLabel(r.status).label} tone={statusLabel(r.status).tone} />
                </View>
                <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>Lý do: {r.reason}</Text>
                <Text style={[text.caption, { color: colors.muted }]}>{r.reporterName} · {formatVietnamDateTime(r.createdAt)}{!r.contentExists ? ' · nội dung không còn' : ''}</Text>
              </Pressable>
            ))
          );
        })()
      ) : (
        (() => {
          const rows = complaints.data!.items.filter((c) => !onlyOpen || COMPLAINT_OPEN.includes(c.status));
          return rows.length === 0 ? (
            <StateView icon={{ sf: 'exclamationmark.bubble', md: 'feedback' }} tone="neutral" title="Không có khiếu nại cần xử lý" body="Khiếu nại đơn từ người mua sẽ hiện ở đây." />
          ) : (
            rows.map((c) => (
              <Pressable key={c.complaintId} onPress={() => go(`/platform/moderation/complaints/${c.complaintId}`)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: COMPLAINT_OPEN.includes(c.status) ? 1.5 : 0, borderColor: colors.mango })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[text.subhead, { flex: 1, color: colors.ink }]}>#{c.orderCode} · {c.storefrontName}</Text>
                  <StatusPill label={statusLabel(c.status).label} tone={statusLabel(c.status).tone} />
                </View>
                <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>{c.complaintType === 'REFUND_REQUEST' ? 'Yêu cầu hoàn tiền' : 'Khiếu nại'}: {c.description}</Text>
                <Text style={[text.caption, { color: colors.muted }]}>{c.customerName} · {formatVietnamDateTime(c.createdAt)}{c.requestedRefundAmount ? ` · xin hoàn ${formatVnd(c.requestedRefundAmount)}` : ''}</Text>
              </Pressable>
            ))
          );
        })()
      )}
    </Screen>
  );
}

/** A05 Xử lý báo cáo nội dung: dismiss, hide, or restore a hidden one — each with its consequence said first. */
export function ReportedContentReviewScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const cache = useQueryClient();
  const report = useQuery({ queryKey: ['platform', 'reported-content', reportId], queryFn: () => platformApi.reportedContentDetail(reportId!) });
  const decide = useMutation({
    mutationFn: (d: 'dismiss' | 'hide' | 'restore') => (d === 'restore' ? platformApi.restoreReportedContent(reportId!, report.data!.status) : platformApi.decideReportedContent(reportId!, d, report.data!.status)),
    onSuccess: async (next, d) => {
      cache.setQueryData(['platform', 'reported-content', reportId], next);
      await cache.invalidateQueries({ queryKey: ['platform', 'reported-content'] });
      showToast(d === 'hide' ? 'Đã ẩn nội dung vi phạm' : d === 'restore' ? 'Đã khôi phục nội dung' : 'Đã bỏ qua báo cáo');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  if (report.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Báo cáo nội dung' }} />
        <ListSkeleton rows={2} height={140} />
      </Screen>
    );
  }
  if (report.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Báo cáo nội dung' }} />
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      </Screen>
    );
  }
  const r = report.data;
  const ask = (d: 'dismiss' | 'hide' | 'restore', title: string, body: string) => Alert.alert(title, body, [{ text: 'Quay lại', style: 'cancel' }, { text: 'Xác nhận', style: d === 'hide' ? 'destructive' : 'default', onPress: () => decide.mutate(d) }]);
  return (
    <Screen>
      <Stack.Screen options={{ title: `Báo cáo #${r.reportId}` }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusPill label={CONTENT_TYPE[r.contentType] ?? r.contentType} tone="neutral" />
          <View style={{ flex: 1 }} />
          <StatusPill label={statusLabel(r.status).label} tone={statusLabel(r.status).tone} />
        </View>
        <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy }]}>{r.contentTitle}</Text>
        {r.contentBody ? <Text style={[text.callout, { color: colors.ink }]}>{r.contentBody}</Text> : null}
        {!r.contentExists ? <Banner tone="neutral">Nội dung này không còn tồn tại.</Banner> : null}
      </Card>
      <Card>
        <KeyValueList rows={[{ label: 'Người báo cáo', value: r.reporterName }, { label: 'Lý do', value: r.reason }, { label: 'Gửi lúc', value: formatVietnamDateTime(r.createdAt) }, { label: 'Trạng thái nội dung', value: statusLabel(r.contentStatus).label }, r.reviewedByName ? { label: 'Người xử lý', value: `${r.reviewedByName}${r.reviewedAt ? ` · ${formatVietnamDateTime(r.reviewedAt)}` : ''}` } : null]} />
      </Card>
      {r.status === 'PENDING' ? (
        <View style={{ gap: 10 }}>
          <Button label="Ẩn nội dung" icon={{ sf: 'eye.slash.fill', md: 'visibility_off' }} loading={decide.isPending && decide.variables === 'hide'} disabled={decide.isPending} onPress={() => ask('hide', 'Ẩn nội dung này?', 'Nội dung không còn hiển thị công khai và các báo cáo trùng sẽ được đóng.')} style={{ backgroundColor: colors.danger }} />
          <Button label="Bỏ qua báo cáo" variant="secondary" loading={decide.isPending && decide.variables === 'dismiss'} disabled={decide.isPending} onPress={() => ask('dismiss', 'Bỏ qua báo cáo?', 'Báo cáo được đóng mà không thay đổi nội dung.')} />
        </View>
      ) : r.status === 'HIDDEN' ? (
        <Button label="Khôi phục nội dung" variant="secondary" icon={{ sf: 'arrow.uturn.backward', md: 'undo' }} loading={decide.isPending} onPress={() => ask('restore', 'Khôi phục nội dung?', 'Người bán lấy lại quyền với nội dung này. Gian hàng vẫn tạm dừng và món ở trạng thái hết hàng cho tới khi người bán mở lại.')} />
      ) : null}
    </Screen>
  );
}

/** A06 Xử lý khiếu nại đơn: resolve (optionally approving a refund up to what was paid) or reject, with notes. */
export function ComplaintReviewScreen() {
  const { complaintId } = useLocalSearchParams<{ complaintId: string }>();
  const cache = useQueryClient();
  const complaint = useQuery({ queryKey: ['platform', 'order-complaint', complaintId], queryFn: () => platformApi.complaintDetail(complaintId!) });
  const [notes, setNotes] = useState('');
  const [refund, setRefund] = useState('');
  const decide = useMutation({
    mutationFn: (decision: 'RESOLVE' | 'REJECT') => platformApi.decideComplaint(complaintId!, { decision, notes: notes.trim(), expectedStatus: complaint.data!.status, approvedRefundAmount: decision === 'RESOLVE' && refund ? Number(refund) : undefined }),
    onSuccess: async (next, d) => {
      cache.setQueryData(['platform', 'order-complaint', complaintId], next);
      await cache.invalidateQueries({ queryKey: ['platform', 'order-complaints'] });
      showToast(d === 'RESOLVE' ? 'Đã giải quyết khiếu nại' : 'Đã từ chối khiếu nại');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  if (complaint.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Khiếu nại' }} />
        <ListSkeleton rows={2} height={140} />
      </Screen>
    );
  }
  if (complaint.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Khiếu nại' }} />
        <ErrorState error={complaint.error} onRetry={() => void complaint.refetch()} />
      </Screen>
    );
  }
  const c = complaint.data;
  const editable = COMPLAINT_OPEN.includes(c.status);
  const refundable = Math.max(0, (c.paymentAmount ?? 0) - c.refundedAmount);
  const refundNumber = refund ? Number(refund) : 0;
  const refundError = refund && (refundNumber <= 0 || refundNumber > refundable) ? `Hoàn từ 1 đến ${formatVnd(refundable)}.` : undefined;
  return (
    <Screen>
      <Stack.Screen options={{ title: `Đơn #${c.orderCode}` }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[text.subhead, { flex: 1, color: colors.ink }]}>{c.complaintType === 'REFUND_REQUEST' ? 'Yêu cầu hoàn tiền' : 'Khiếu nại'}</Text>
          <StatusPill label={statusLabel(c.status).label} tone={statusLabel(c.status).tone} />
        </View>
        <Text style={[text.callout, { color: colors.ink }]}>{c.description}</Text>
        <KeyValueList
          rows={[
            { label: 'Người mua', value: c.customerName },
            { label: 'Quán', value: c.storefrontName },
            { label: 'Trạng thái đơn', value: statusLabel(c.orderStatus).label },
            c.paymentAmount != null ? { label: 'Đã trả', value: `${formatVnd(c.paymentAmount)}${c.paymentProvider ? ` · ${c.paymentProvider}` : ''}` } : null,
            c.requestedRefundAmount ? { label: 'Xin hoàn', value: formatVnd(c.requestedRefundAmount), emphasis: true } : null,
            c.refundedAmount ? { label: 'Đã/đang hoàn', value: `${formatVnd(c.refundedAmount)}${c.latestRefundStatus ? ` · ${statusLabel(c.latestRefundStatus).label}` : ''}` } : null,
            { label: 'Gửi lúc', value: formatVietnamDateTime(c.createdAt) },
          ]}
        />
      </Card>
      {c.resolutionNotes ? <Banner tone="neutral" title={`Đã xử lý${c.resolvedByName ? ` bởi ${c.resolvedByName}` : ''}`}>{c.resolutionNotes}</Banner> : null}
      {editable ? (
        <Card style={{ gap: 10 }}>
          <SectionHeader title="Quyết định" />
          <TextField label="Ghi chú xử lý" value={notes} onChangeText={setNotes} multiline placeholder="Bắt buộc" />
          {refundable > 0 ? <TextField label="Duyệt hoàn tiền" optional value={refund} onChangeText={(v) => setRefund(v.replace(/\D/g, ''))} keyboardType="number-pad" hint={`Tối đa ${formatVnd(refundable)}. Để trống nếu không hoàn.`} error={refundError} /> : null}
          <Text style={[text.caption, { color: colors.muted }]}>{refundNumber ? `Giải quyết: duyệt hoàn ${formatVnd(refundNumber)}.` : 'Giải quyết: không kèm hoàn tiền.'} Từ chối: không hoàn tiền.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Từ chối" variant="secondary" loading={decide.isPending && decide.variables === 'REJECT'} disabled={!notes.trim() || decide.isPending} onPress={() => decide.mutate('REJECT')} style={{ flex: 1 }} />
            <Button label="Giải quyết" loading={decide.isPending && decide.variables === 'RESOLVE'} disabled={!notes.trim() || !!refundError || decide.isPending} onPress={() => Alert.alert('Giải quyết khiếu nại?', refundNumber ? `Hoàn ${formatVnd(refundNumber)} về ví người mua.` : 'Không kèm hoàn tiền.', [{ text: 'Quay lại', style: 'cancel' }, { text: 'Xác nhận', onPress: () => decide.mutate('RESOLVE') }])} style={{ flex: 1.4 }} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
