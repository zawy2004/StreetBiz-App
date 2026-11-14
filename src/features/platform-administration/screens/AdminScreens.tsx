import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, KeyValueList, SectionHeader, Segments, StatTile } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { Toggle } from '@/components/native/Toggle';
import { MockBadge } from '@/components/status/MockBadge';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { AssistantButton } from '@/features/assistant/components/AssistantButton';
import { useNotificationUnreadCount } from '@/features/notifications/notifications-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, statusTones, tabular, text } from '@/theme';
import { Pass, RoundButton, Section, Signboard, useLightStatusBar } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { platformApi, type FoodCategory } from '../platform-api';

const go = (href: string) => router.push(href as Href);
const CONTENT_TYPE: Record<string, string> = { STOREFRONT: 'Gian hàng', MENU_ITEM: 'Món ăn', REVIEW: 'Đánh giá' };
const CONTENT_ICON: Record<string, { sf: string; md: string }> = {
  STOREFRONT: { sf: 'storefront.fill', md: 'storefront' },
  MENU_ITEM: { sf: 'fork.knife', md: 'restaurant' },
  REVIEW: { sf: 'star.bubble.fill', md: 'reviews' },
};
const COMPLAINT_OPEN = ['OPEN', 'UNDER_REVIEW'];

function useQueues() {
  const reports = useQuery({ queryKey: ['platform', 'reported-content'], queryFn: () => platformApi.reportedContent() });
  const complaints = useQuery({ queryKey: ['platform', 'order-complaints'], queryFn: () => platformApi.complaints() });
  const categories = useQuery({ queryKey: ['platform', 'categories'], queryFn: platformApi.categories });
  return { reports, complaints, categories };
}

/** A figure painted on the signboard (white Archivo number, its words under it); taps through to its queue. */
function SignFigure({ value, label, onPress }: { value: number | undefined; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'đang tải'}`}
      style={({ pressed }) => ({ flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 2, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: pressed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)' })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { flexShrink: 1, color: colors.white }, tabular]}>
          {value ?? '…'}
        </Text>
        <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.white} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 18, color: colors.white }}>{label}</Text>
    </Pressable>
  );
}

/**
 * A01 Tổng quan quản trị (screens/v5/shared-admin.md): the platform team's sign with what waits on
 * it, from the live queues, as figures that open their queue. The platform runs the marketplace;
 * it holds no sidewalk compliance authority (that is the ward's), said on the card across the sign.
 */
export function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const user = useAuthStore((s) => s.user);
  const unread = useNotificationUnreadCount();
  const { reports, complaints, categories } = useQueues();
  const pendingReports = reports.data?.items.filter((r) => r.status === 'PENDING').length;
  const openComplaints = complaints.data?.items.filter((c) => COMPLAINT_OPEN.includes(c.status)).length;
  const refreshing = reports.isRefetching || complaints.isRefetching;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ gap: 26, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void Promise.all([reports.refetch(), complaints.refetch(), categories.refetch()])}
            tintColor={colors.cta}
            colors={[colors.cta]}
            progressViewOffset={insets.top}
          />
        }
      >
        <Signboard
          top={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf="person.fill" md="person" size={16} color={colors.white} />
                </View>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.white }}>{user?.fullName ?? ''}</Text>
              </View>
              <AssistantButton tone="onSign" />
              <RoundButton icon={{ sf: 'bell.fill', md: 'notifications' }} label="Thông báo" badge={unread || undefined} onPress={() => go('/notifications')} />
            </View>
          }
          line1="Quản trị"
          line2="nền tảng"
          overlap={
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }}>
              <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="building.columns.fill" md="account_balance" size={20} color={colors.sign} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Phạm vi quản trị</Text>
                <Text style={[text.footnote, { color: '#2B3640' }]}>
                  Quản trị nền tảng xử lý danh mục, kiểm duyệt nội dung và khiếu nại đơn. Cấp phép vỉa hè, vi phạm và mức phạt thuộc Cán bộ Phường.
                </Text>
              </View>
            </View>
          }
        >
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <SignFigure value={pendingReports} label="Nội dung chờ xử lý" onPress={() => go('/platform/moderation?tab=CONTENT')} />
            <SignFigure value={openComplaints} label="Khiếu nại đang mở" onPress={() => go('/platform/moderation?tab=COMPLAINTS')} />
          </View>
        </Signboard>

        <View style={{ paddingHorizontal: 20, gap: 26 }}>
          {reports.isError || complaints.isError ? <Banner tone="danger">{errorMessage(reports.error ?? complaints.error)}</Banner> : null}
          <View style={{ flexDirection: 'row' }}>
            <StatTile
              value={categories.data ? String(categories.data.length) : '…'}
              label="Danh mục món đang dùng"
              tone="sign"
              icon={{ sf: 'square.grid.2x2.fill', md: 'category' }}
              onPress={() => router.navigate('/platform/categories' as Href)}
            />
          </View>
          <Section title="Lối tắt" inset={0}>
            <ListGroup>
              <ListRow title="Kiểm duyệt nội dung" icon={{ sf: 'flag.fill', md: 'flag' }} tint={colors.danger} tileColor={colors.dangerTint} onPress={() => router.navigate('/platform/moderation' as Href)} />
              <ListRow title="Danh mục món" icon={{ sf: 'square.grid.2x2.fill', md: 'category' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => router.navigate('/platform/categories' as Href)} />
              <ListRow title="Tài khoản người dùng" icon={{ sf: 'person.3.fill', md: 'group' }} onPress={() => router.navigate('/platform/accounts' as Href)} />
            </ListGroup>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

/** A02 Tài khoản: the web's page runs on demo data only; the server has no endpoint for it yet. */
export function AdminAccountsScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Tài khoản' }} />
      <MockBadge label="Chưa nối máy chủ" style={{ alignSelf: 'center' }} />
      <StateView icon={{ sf: 'person.3', md: 'group' }} tone="neutral" title="Chưa nối máy chủ" body="Máy chủ chưa có API quản lý tài khoản người dùng, nên màn này chưa hiện dữ liệu thật. Không hiển thị dữ liệu minh hoạ thay thế." />
    </Screen>
  );
}

/** A 44 pt round icon button for a row (rename, remove). */
function RowIconButton({ icon, label, tint, wash, onPress }: { icon: { sf: string; md: string }; label: string; tint: string; wash: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={2}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? wash : 'transparent' })}
    >
      <Icon sf={icon.sf} md={icon.md} size={18} color={tint} />
    </Pressable>
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
    <Screen onRefresh={() => void categories.refetch()} refreshing={categories.isRefetching} gap={20}>
      <Stack.Screen options={{ title: 'Danh mục món' }} />
      <Card style={{ gap: 12 }}>
        <TextField label="Danh mục mới" value={name} onChangeText={setName} placeholder="VD: Bún - Phở" maxLength={100} />
        <Button label="Thêm danh mục" icon={{ sf: 'plus', md: 'add' }} loading={create.isPending} disabled={!name.trim()} onPress={() => create.mutate()} />
      </Card>
      {categories.isPending ? (
        <ListSkeleton rows={5} height={64} />
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <View style={{ gap: 10 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink, marginLeft: 4 }}>
            {`${categories.data.length} danh mục`}
          </Text>
          {categories.data.length === 0 ? (
            <StateView icon={{ sf: 'square.grid.2x2', md: 'category' }} title="Chưa có danh mục" body="Thêm danh mục đầu tiên ở ô phía trên để người bán xếp món." />
          ) : (
            <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
              {categories.data.map((c, i) => (
                <View key={c.categoryId} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                  {editing?.id === c.categoryId ? (
                    <View style={{ padding: 14, gap: 10, backgroundColor: colors.kerbPaint }}>
                      <TextField label="Tên mới" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} maxLength={100} />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button label="Huỷ" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
                        <Button label="Lưu" loading={rename.isPending} disabled={!editing.name.trim()} onPress={() => rename.mutate()} style={{ flex: 1.4 }} />
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 10, paddingLeft: 14, paddingRight: 6 }}>
                      <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.primary }}>{(c.categoryName.trim()[0] ?? '?').toLocaleUpperCase('vi-VN')}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>{c.categoryName}</Text>
                        <Text style={[text.footnote, tabular, { color: colors.muted }]}>
                          {`${c.itemCount} món${c.createdByName ? `, tạo bởi ${c.createdByName}` : ''}`}
                        </Text>
                      </View>
                      <RowIconButton icon={{ sf: 'pencil', md: 'edit' }} label={`Đổi tên ${c.categoryName}`} tint={colors.sign} wash={colors.signTint} onPress={() => setEditing({ id: c.categoryId, name: c.categoryName })} />
                      {c.itemCount === 0 ? (
                        <RowIconButton icon={{ sf: 'trash', md: 'delete' }} label={`Xoá ${c.categoryName}`} tint={colors.danger} wash={colors.dangerTint} onPress={() => ask(c)} />
                      ) : null}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

type Tab = 'CONTENT' | 'COMPLAINTS';

/** A queue card: a disc for what it is about, the line, the reason, who and when; a status edge on the left. */
function QueueCard({
  edge,
  icon,
  wash,
  ink,
  title,
  status,
  body,
  meta,
  onPress,
}: {
  edge: string | undefined;
  icon: { sf: string; md: string };
  wash: string;
  ink: string;
  title: string;
  status: { label: string; tone: 'ok' | 'pending' | 'danger' | 'neutral' };
  body: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status.label}. ${body}. ${meta}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, paddingLeft: 16, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: pressed ? colors.kerbPaint : colors.card, boxShadow: shadow.card })}
    >
      {edge ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: edge }} /> : null}
      <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={20} color={ink} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 15.5, lineHeight: 21, color: colors.ink }} numberOfLines={2}>
            {title}
          </Text>
          <StatusPill label={status.label} tone={status.tone} />
        </View>
        <Text style={[text.footnote, { color: '#2B3640' }]} numberOfLines={2}>
          {body}
        </Text>
        <Text style={[text.caption, tabular, { color: colors.muted }]}>{meta}</Text>
      </View>
    </Pressable>
  );
}

/** A04 Kiểm duyệt (ADM-03/04/05): reported content and order complaints, what needs action first. */
export function ModerationScreen() {
  const { tab: initial } = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(initial === 'COMPLAINTS' ? 'COMPLAINTS' : 'CONTENT');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const { reports, complaints } = useQueues();
  const active = tab === 'CONTENT' ? reports : complaints;
  return (
    <Screen onRefresh={() => void active.refetch()} refreshing={active.isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Kiểm duyệt' }} />
      <Segments<Tab> value={tab} onChange={setTab} options={[{ key: 'CONTENT', label: 'Nội dung', count: reports.data?.items.filter((r) => r.status === 'PENDING').length }, { key: 'COMPLAINTS', label: 'Khiếu nại đơn', count: complaints.data?.items.filter((c) => COMPLAINT_OPEN.includes(c.status)).length }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: colors.card, boxShadow: shadow.card, marginBottom: 4 }}>
        <Icon sf="line.3.horizontal.decrease.circle.fill" md="filter_list" size={18} color={colors.primary} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Chỉ hiện việc cần xử lý</Text>
        <Toggle value={onlyOpen} onChange={setOnlyOpen} />
      </View>
      {active.isPending ? (
        <ListSkeleton rows={4} height={110} />
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      ) : tab === 'CONTENT' ? (
        (() => {
          const rows = reports.data!.items.filter((r) => !onlyOpen || r.status === 'PENDING');
          return rows.length === 0 ? (
            <StateView icon={{ sf: 'flag', md: 'flag' }} tone="neutral" title="Không có nội dung cần xử lý" body="Báo cáo mới từ người dùng sẽ hiện ở đây." />
          ) : (
            rows.map((r) => (
              <QueueCard
                key={r.reportId}
                edge={r.status === 'PENDING' ? colors.danger : undefined}
                icon={CONTENT_ICON[r.contentType] ?? { sf: 'flag.fill', md: 'flag' }}
                wash={colors.dangerTint}
                ink={colors.danger}
                title={`${CONTENT_TYPE[r.contentType] ?? r.contentType}: ${r.contentTitle}`}
                status={statusLabel(r.status)}
                body={`Lý do: ${r.reason}`}
                meta={`${r.reporterName}, ${formatVietnamDateTime(r.createdAt)}${!r.contentExists ? ', nội dung không còn' : ''}`}
                onPress={() => go(`/platform/moderation/content/${r.reportId}`)}
              />
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
              <QueueCard
                key={c.complaintId}
                edge={COMPLAINT_OPEN.includes(c.status) ? colors.mango : undefined}
                icon={c.complaintType === 'REFUND_REQUEST' ? { sf: 'arrow.uturn.backward.circle.fill', md: 'currency_exchange' } : { sf: 'exclamationmark.bubble.fill', md: 'feedback' }}
                wash={colors.mangoTint}
                ink={colors.onMango}
                title={`#${c.orderCode}, ${c.storefrontName}`}
                status={statusLabel(c.status)}
                body={`${c.complaintType === 'REFUND_REQUEST' ? 'Yêu cầu hoàn tiền' : 'Khiếu nại'}: ${c.description}`}
                meta={`${c.customerName}, ${formatVietnamDateTime(c.createdAt)}${c.requestedRefundAmount ? `, xin hoàn ${formatVnd(c.requestedRefundAmount)}` : ''}`}
                onPress={() => go(`/platform/moderation/complaints/${c.complaintId}`)}
              />
            ))
          );
        })()
      )}
    </Screen>
  );
}

/** What a decision screen shows while its record loads: the verdict line, the record, its details. */
function DetailSkeleton() {
  return (
    <>
      <Skeleton height={80} radius={radius.card} />
      <Skeleton height={150} radius={radius.card} />
      <Skeleton height={190} radius={radius.card} />
    </>
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
        <DetailSkeleton />
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
  const verdict = statusLabel(r.status);
  const contentIcon = CONTENT_ICON[r.contentType] ?? { sf: 'flag.fill', md: 'flag' };
  const footer =
    r.status === 'PENDING' ? (
      <>
        <Button label="Ẩn nội dung" variant="danger" size={56} icon={{ sf: 'eye.slash.fill', md: 'visibility_off' }} loading={decide.isPending && decide.variables === 'hide'} disabled={decide.isPending || !r.contentExists} onPress={() => ask('hide', 'Ẩn nội dung này?', 'Nội dung không còn hiển thị công khai và các báo cáo trùng sẽ được đóng.')} />
        <Button label="Bỏ qua báo cáo" variant="secondary" loading={decide.isPending && decide.variables === 'dismiss'} disabled={decide.isPending} onPress={() => ask('dismiss', 'Bỏ qua báo cáo?', 'Báo cáo được đóng mà không thay đổi nội dung.')} />
      </>
    ) : r.status === 'HIDDEN' ? (
      <Button label="Khôi phục nội dung" size={56} icon={{ sf: 'arrow.uturn.backward', md: 'undo' }} loading={decide.isPending} disabled={decide.isPending || !r.contentExists} onPress={() => ask('restore', 'Khôi phục nội dung?', 'Người bán lấy lại quyền với nội dung này. Gian hàng vẫn tạm dừng và món ở trạng thái hết hàng cho tới khi người bán mở lại.')} />
    ) : undefined;
  return (
    <Screen gap={18} footer={footer}>
      <Stack.Screen options={{ title: `Báo cáo #${r.reportId}` }} />
      <StatusHeader tone={verdict.tone} title={verdict.label} detail={`${CONTENT_TYPE[r.contentType] ?? r.contentType} bị báo cáo, lý do: ${r.reason}`} />
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf={contentIcon.sf} md={contentIcon.md} size={18} color={colors.danger} />
          </View>
          <StatusPill label={CONTENT_TYPE[r.contentType] ?? r.contentType} tone="neutral" />
        </View>
        <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy }]}>{r.contentTitle}</Text>
        {r.contentBody ? <Text style={[text.callout, { color: colors.ink }]}>{r.contentBody}</Text> : null}
        {!r.contentExists ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.control, backgroundColor: statusTones.neutral.wash }}>
            <Icon sf="trash.slash.fill" md="hide_source" size={16} color={statusTones.neutral.ink} />
            <Text style={[text.footnote, { flex: 1, color: statusTones.neutral.ink }]}>Nội dung này không còn tồn tại.</Text>
          </View>
        ) : null}
      </Card>
      <Card>
        <KeyValueList rows={[{ label: 'Người báo cáo', value: r.reporterName }, { label: 'Lý do', value: r.reason }, { label: 'Gửi lúc', value: formatVietnamDateTime(r.createdAt) }, { label: 'Trạng thái nội dung', value: statusLabel(r.contentStatus).label }, r.reviewedByName ? { label: 'Người xử lý', value: `${r.reviewedByName}${r.reviewedAt ? `, ${formatVietnamDateTime(r.reviewedAt)}` : ''}` } : null]} />
      </Card>
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
        <DetailSkeleton />
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
  // Only a refund request can carry a refund, and never more than both what was asked and what was
  // paid, less what is already refunded (the server refuses anything else).
  const isRefundRequest = c.complaintType === 'REFUND_REQUEST';
  const requestedRemaining = Math.max(0, (c.requestedRefundAmount ?? 0) - c.refundedAmount);
  const paidRemaining = Math.max(0, (c.paymentAmount ?? 0) - c.refundedAmount);
  const refundable = isRefundRequest ? Math.min(requestedRemaining, paidRemaining) : 0;
  const refundNumber = refund ? Number(refund) : 0;
  const refundError = refund && (!Number.isSafeInteger(refundNumber) || refundNumber <= 0 || refundNumber > refundable) ? `Hoàn từ 1 đến ${formatVnd(refundable)}.` : undefined;
  const verdict = statusLabel(c.status);
  const footer = editable ? (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button label="Từ chối" variant="secondary" size={56} loading={decide.isPending && decide.variables === 'REJECT'} disabled={!notes.trim() || decide.isPending} onPress={() => decide.mutate('REJECT')} style={{ flex: 1 }} />
      <Button label="Giải quyết" size={56} loading={decide.isPending && decide.variables === 'RESOLVE'} disabled={!notes.trim() || !!refundError || decide.isPending} onPress={() => Alert.alert('Giải quyết khiếu nại?', refundNumber ? `Hoàn ${formatVnd(refundNumber)} về ví người mua.` : 'Không kèm hoàn tiền.', [{ text: 'Quay lại', style: 'cancel' }, { text: 'Xác nhận', onPress: () => decide.mutate('RESOLVE') }])} style={{ flex: 1.4 }} />
    </View>
  ) : undefined;
  return (
    <Screen gap={18} footer={footer}>
      <Stack.Screen options={{ title: `Đơn #${c.orderCode}` }} />
      <StatusHeader tone={verdict.tone} title={verdict.label} detail={c.complaintType === 'REFUND_REQUEST' ? 'Yêu cầu hoàn tiền' : 'Khiếu nại'} />

      {/* The order as a receipt: code in sign lettering, who and where; the money under the tear line */}
      <Pass
        accent={colors.mango}
        head={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Đơn hàng</Text>
                <Text maxFontSizeMultiplier={1.3} style={[sign.title, { color: colors.ink }, tabular]}>{`#${c.orderCode}`}</Text>
              </View>
              <StatusPill label={statusLabel(c.orderStatus).label} tone={statusLabel(c.orderStatus).tone} />
            </View>
            <Text style={[text.callout, { color: colors.ink }]}>{c.description}</Text>
          </View>
        }
        stub={
          <KeyValueList
            rows={[
              { label: 'Người mua', value: c.customerName },
              { label: 'Quán', value: c.storefrontName },
              c.paymentAmount != null ? { label: 'Đã trả', value: `${formatVnd(c.paymentAmount)}${c.paymentProvider ? `, qua ${c.paymentProvider}` : ''}` } : null,
              c.requestedRefundAmount ? { label: 'Xin hoàn', value: formatVnd(c.requestedRefundAmount), emphasis: true } : null,
              c.refundedAmount ? { label: 'Đã/đang hoàn', value: `${formatVnd(c.refundedAmount)}${c.latestRefundStatus ? `, ${statusLabel(c.latestRefundStatus).label}` : ''}` } : null,
              { label: 'Gửi lúc', value: formatVietnamDateTime(c.createdAt) },
            ]}
          />
        }
      />

      {c.resolutionNotes ? <Banner tone="neutral" title={`Đã xử lý${c.resolvedByName ? ` bởi ${c.resolvedByName}` : ''}`}>{c.resolutionNotes}</Banner> : null}
      {editable ? (
        <Card style={{ gap: 12 }}>
          <SectionHeader title="Quyết định" />
          <TextField label="Ghi chú xử lý" value={notes} onChangeText={setNotes} multiline maxLength={1000} placeholder="Bắt buộc" hint={`${notes.length}/1000`} />
          {refundable > 0 ? <TextField label="Duyệt hoàn tiền" optional value={refund} onChangeText={(v) => setRefund(v.replace(/\D/g, ''))} keyboardType="number-pad" hint={`Tối đa ${formatVnd(refundable)}. Để trống nếu không hoàn.`} error={refundError} /> : null}
          <Text style={[text.footnote, { color: colors.muted }]}>{refundNumber ? `Giải quyết: duyệt hoàn ${formatVnd(refundNumber)}.` : 'Giải quyết: không kèm hoàn tiền.'} Từ chối: không hoàn tiền.</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
