import { useQueries, useQueryClient } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderIconButton, SectionHeader } from '@/components/common/Blocks';
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
import { AiTag } from '@/components/status/AiTag';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { useWards } from '@/core/auth/useWards';
import { statusLabel } from '@/core/constants/status-labels';
import { AssistantButton } from '@/features/assistant/components/AssistantButton';
import { useNotificationUnreadCount } from '@/features/notifications/notifications-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, space, tabular, text } from '@/theme';
import { formatVietnamDate, formatVnd } from '@/utils/format';
import { useWardDashboard } from '../useWardReports';
import { complianceApi, type WardRenewalItem } from '../ward-api';

const go = (href: string) => router.push(href as Href);
const todayVi = () => new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

function useWardName() {
  const user = useAuthStore((s) => s.user);
  const { wards } = useWards();
  return wards.find((w) => w.unitId === user?.wardUnitId)?.unitName;
}

/**
 * W01 Tổng quan (WARD-15): the shift's notice board — today's work in two big numbers, the
 * pavement's occupancy, the money, then shortcuts. Every figure is this officer's own ward.
 */
export function WardDashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const wardName = useWardName();
  const unread = useNotificationUnreadCount();
  const dash = useWardDashboard();
  const d = dash.data;
  const pending = d ? d.pendingRegistrations + d.pendingApplications : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 22, lineHeight: 28, color: colors.ink }} numberOfLines={1}>{wardName ?? 'Phường của bạn'}</Text>
          <Text style={[text.footnote, { color: colors.muted }]} numberOfLines={1}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {todayVi()}
          </Text>
        </View>
        <AssistantButton />
        <HeaderIconButton icon={{ sf: 'bell.fill', md: 'notifications' }} label="Thông báo" badge={unread} onPress={() => go('/notifications')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingTop: 4, paddingBottom: 40, gap: 16 }} refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}>
        {dash.isPending ? (
          <ListSkeleton rows={3} height={130} />
        ) : dash.isError || !d ? (
          <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <BigNumber value={pending} label="Hồ sơ chờ duyệt" note={`${d.pendingRegistrations} đăng ký · ${d.pendingApplications} thuê ô`} tone="brand" onPress={() => router.navigate('/ward/inbox' as Href)} />
              <BigNumber value={d.openViolations} label="Vi phạm đang mở" note="Biên bản chưa khép" tone={d.openViolations ? 'danger' : 'ok'} onPress={() => go('/ward/more/reports')} />
            </View>
            <Pressable onPress={() => router.navigate('/ward/slots' as Href)} accessibilityRole="button" accessibilityLabel={`Lấp đầy ${d.occupancyPercent}%, ${d.slotRented} trên ${d.slotTotal} ô`}>
              <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Ô vỉa hè</Text>
                  <Text style={[{ fontFamily: fonts.heavy, fontSize: 24, color: colors.primary }, tabular]}>{d.occupancyPercent}%</Text>
                </View>
                {/* The kerb as a row of bays: rented ones painted. */}
                <View style={{ flexDirection: 'row', gap: 3, height: 22 }}>
                  {Array.from({ length: Math.min(d.slotTotal, 30) }, (_, i) => {
                    const rentedShown = Math.round((d.slotRented / Math.max(d.slotTotal, 1)) * Math.min(d.slotTotal, 30));
                    return <View key={i} style={{ flex: 1, borderRadius: 4, backgroundColor: i < rentedShown ? colors.brand : colors.sunken }} />;
                  })}
                </View>
                <Text style={[text.footnote, { color: colors.muted }, tabular]}>
                  {d.slotRented}/{d.slotTotal} ô đã cho thuê · {d.activeContracts} hợp đồng hiệu lực
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={() => go('/ward/more/reports')} accessibilityRole="button">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Money label="Đã thu" value={d.revenueCollected} wash={colors.leafTint} ink={colors.onLeaf} />
                <Money label="Còn nợ" value={d.outstandingDebt} wash={d.outstandingDebt ? colors.mangoTint : colors.sunken} ink={d.outstandingDebt ? colors.onMango : colors.muted} />
              </View>
            </Pressable>
          </>
        )}
        <SectionHeader title="Lối tắt ca trực" />
        <ListGroup>
          <ListRow title="Quét QR tuần tra" subtitle="Kiểm tra giấy phép số tại chỗ" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={() => router.navigate('/ward/patrol' as Href)} />
          <ListRow title="Lập biên bản vi phạm" subtitle="Biên bản hiện trường (NĐ 168/2024)" icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} tint={colors.danger} tileColor={colors.dangerTint} onPress={() => go('/ward/patrol/violations/new')} />
          <ListRow title="Hộp duyệt" subtitle="Đăng ký, thuê ô, gia hạn, ATTP" icon={{ sf: 'tray.full.fill', md: 'inbox' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => router.navigate('/ward/inbox' as Href)} />
          <ListRow title="Thu phí & công nợ" subtitle="Hợp đồng, miễn giảm, thu tại chỗ" icon={{ sf: 'banknote.fill', md: 'payments' }} tint={colors.onLeaf} tileColor={colors.leafTint} onPress={() => go('/ward/more/finance')} />
        </ListGroup>
      </ScrollView>
    </View>
  );
}

function BigNumber({ value, label, note, tone, onPress }: { value: number; label: string; note: string; tone: 'brand' | 'danger' | 'ok'; onPress: () => void }) {
  const t = { brand: { wash: colors.brandTint, ink: colors.primary }, danger: { wash: colors.dangerTint, ink: colors.onDanger }, ok: { wash: colors.leafTint, ink: colors.onLeaf } }[tone];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={({ pressed }) => ({ flex: 1, padding: 16, gap: 4, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: t.wash, opacity: pressed ? 0.85 : 1 })}>
      <Text style={[{ fontFamily: fonts.code, fontSize: 40, lineHeight: 44, color: t.ink }, tabular]}>{value}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: t.ink }}>{label}</Text>
      <Text style={[text.caption, { color: t.ink }]}>{note}</Text>
    </Pressable>
  );
}

function Money({ label, value, wash, ink }: { label: string; value: number; wash: string; ink: string }) {
  return (
    <View style={{ flex: 1, padding: 14, gap: 4, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: wash }}>
      <Text style={[text.caption, { color: ink }]}>{label}</Text>
      <Text style={[{ fontFamily: fonts.heavy, fontSize: 18, color: ink }, tabular]} adjustsFontSizeToFit numberOfLines={1}>{formatVnd(value)}</Text>
    </View>
  );
}

type Category = 'ALL' | 'REG' | 'RENTAL' | 'RENEWAL' | 'FAST';
type QueueItem = { key: string; category: Exclude<Category, 'ALL' | 'FAST'>; title: string; subtitle: string; status: string; risk: number; reasons: string[]; fastTrack?: boolean; overdue?: boolean; submittedAt: string; href: string };

/**
 * W02 Hộp duyệt: registrations, rental applications and renewals in one queue, riskiest first.
 * Risk and "[AI] xét nhanh" only order and flag; every decision is the officer's (BR-41).
 */
export function WardInboxScreen() {
  const cache = useQueryClient();
  const [category, setCategory] = useState<Category>('ALL');
  const results = useQueries({
    queries: [
      { queryKey: ['ward', 'inbox', 'enrollments'], queryFn: () => complianceApi.listEnrollments() },
      { queryKey: ['ward', 'inbox', 'rental', 'PENDING'], queryFn: () => complianceApi.listRentalApplications('PENDING') },
      { queryKey: ['ward', 'inbox', 'rental', 'UNDER_REVIEW'], queryFn: () => complianceApi.listRentalApplications('UNDER_REVIEW') },
      { queryKey: ['ward', 'inbox', 'rental', 'MORE_INFORMATION_REQUIRED'], queryFn: () => complianceApi.listRentalApplications('MORE_INFORMATION_REQUIRED') },
      { queryKey: ['ward', 'inbox', 'renewals', 'PENDING'], queryFn: () => complianceApi.listRenewals('PENDING') },
      { queryKey: ['ward', 'inbox', 'renewals', 'UNDER_REVIEW'], queryFn: () => complianceApi.listRenewals('UNDER_REVIEW') },
      { queryKey: ['ward', 'inbox', 'risk'], queryFn: () => complianceApi.riskQueue() },
    ],
  });
  const loading = results.some((r) => r.isPending);
  const failed = results.slice(0, 6).every((r) => r.isError);
  const refreshing = results.some((r) => r.isRefetching);
  const refresh = () => void cache.invalidateQueries({ queryKey: ['ward', 'inbox'] });
  const [enrollments, rentPending, rentReview, rentMore, renPending, renReview, risk] = results.map((r) => r.data ?? []) as [
    Awaited<ReturnType<typeof complianceApi.listEnrollments>>,
    Awaited<ReturnType<typeof complianceApi.listRentalApplications>>,
    Awaited<ReturnType<typeof complianceApi.listRentalApplications>>,
    Awaited<ReturnType<typeof complianceApi.listRentalApplications>>,
    WardRenewalItem[],
    WardRenewalItem[],
    Awaited<ReturnType<typeof complianceApi.riskQueue>>,
  ];
  const renewals = useMemo(() => [...new Map([...renPending, ...renReview].map((r) => [r.id, r])).values()], [renPending, renReview]);
  const items = useMemo<QueueItem[]>(() => {
    const regs: QueueItem[] = enrollments.map((r) => {
      const q = risk.find((x) => x.registrationId === r.id);
      return {
        key: `REG-${r.id}`,
        category: 'REG',
        title: r.displayName || r.ownerName || `Hồ sơ #${r.id}`,
        subtitle: `Đăng ký điểm bán · ${r.vendorType === 'FIXED_STOREFRONT' ? 'Cửa hàng cố định' : 'Hàng rong lưu động'}${r.fastTrack ? ' · Ưu tiên xét nhanh' : ''}`,
        status: r.status,
        risk: q?.score ?? 0,
        reasons: (q?.breakdown ?? []).map((b) => `${b.reason} (+${b.points}đ)`),
        submittedAt: r.createdAt,
        href: `/ward/inbox/registrations/${r.id}`,
      };
    });
    const apps: QueueItem[] = [...new Map([...rentPending, ...rentReview, ...rentMore].map((a) => [a.id, a])).values()].map((a) => ({
      key: `RENTAL-${a.id}`,
      category: 'RENTAL',
      title: `${a.vendorName} · xin thuê ô ${a.slotCode}`,
      subtitle: `${a.slotStreet} · ${a.requestedTermDays} ngày · ${formatVnd(a.pricePerDay)}/ngày`,
      status: a.status,
      risk: 0,
      reasons: [],
      submittedAt: a.createdAt,
      href: `/ward/inbox/rental-applications/${a.id}`,
    }));
    const rens: QueueItem[] = renewals.map((rn) => {
      const reasons: string[] = [];
      let score = 0;
      if (rn.violationCount > 0) {
        score += rn.violationCount * 20;
        reasons.push(`${rn.violationCount} vi phạm trong hợp đồng (+${rn.violationCount * 20}đ)`);
      }
      if (rn.isOverdue) {
        score += 100;
        reasons.push('Quá hạn xử lý (≤3 ngày làm việc) (+100đ)');
      }
      return {
        key: `REN-${rn.id}`,
        category: 'RENEWAL',
        title: `${rn.vendorName} · gia hạn ô ${rn.slotCode}`,
        subtitle: `HĐ #${rn.contractId} · +${rn.requestedTermDays} ngày · ${formatVnd(rn.totalFee)}`,
        status: rn.status,
        risk: score,
        reasons,
        fastTrack: rn.isFastTrackEligible,
        overdue: rn.isOverdue,
        submittedAt: rn.createdAt,
        href: `/ward/inbox/renewals/${rn.id}`,
      };
    });
    return [...regs, ...apps, ...rens].sort((a, b) => b.risk - a.risk);
  }, [enrollments, rentPending, rentReview, rentMore, renewals, risk]);
  const fast = renewals.filter((r) => r.isFastTrackEligible);
  const visible = category === 'ALL' ? items : category === 'FAST' ? items.filter((i) => i.fastTrack) : items.filter((i) => i.category === category);
  const count = (c: QueueItem['category']) => items.filter((i) => i.category === c).length;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing} gap={12}>
      <Stack.Screen options={{ title: 'Hộp duyệt' }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Counter label="Đang chờ" value={items.length} wash={colors.sunken} ink={colors.ink} />
        <Counter label="Cần xem kỹ" value={items.filter((i) => i.risk > 0).length} wash={colors.mangoTint} ink={colors.onMango} />
        <Counter label="Quá hạn" value={renewals.filter((r) => r.isOverdue).length} wash={colors.dangerTint} ink={colors.onDanger} />
      </View>
      <ListGroup>
        <ListRow title="Hồ sơ vị trí" subtitle="Đề xuất ô, xung đột địa chỉ, chuyển nhượng" icon={{ sf: 'mappin.and.ellipse', md: 'location_on' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go('/ward/inbox/cases')} />
        <ListRow title="Hồ sơ an toàn thực phẩm" subtitle="Kiểm tra, chuyển Chi cục, ghi kết quả" icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} tint={colors.onLeaf} tileColor={colors.leafTint} onPress={() => go('/ward/inbox/food-safety')} />
      </ListGroup>
      <SectionHeader title="Đăng ký, thuê ô & gia hạn" note="Hồ sơ cần xem kỹ được xếp lên đầu." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        <Chip label="Tất cả" selected={category === 'ALL'} onPress={() => setCategory('ALL')} accessibilityRole="radio" />
        <Chip label={`Đăng ký · ${count('REG')}`} selected={category === 'REG'} onPress={() => setCategory('REG')} accessibilityRole="radio" />
        <Chip label={`Thuê ô · ${count('RENTAL')}`} selected={category === 'RENTAL'} onPress={() => setCategory('RENTAL')} accessibilityRole="radio" />
        <Chip label={`Gia hạn · ${count('RENEWAL')}`} selected={category === 'RENEWAL'} onPress={() => setCategory('RENEWAL')} accessibilityRole="radio" />
        <Chip label={`[AI] Xét nhanh · ${fast.length}`} selected={category === 'FAST'} onPress={() => setCategory('FAST')} accessibilityRole="radio" />
      </ScrollView>
      {category === 'FAST' && fast.length > 0 ? <FastTrackBatch candidates={fast} onDone={refresh} /> : null}
      {loading ? (
        <ListSkeleton rows={4} height={96} />
      ) : failed ? (
        <ErrorState error={results[0]!.error} onRetry={refresh} />
      ) : visible.length === 0 ? (
        <StateView icon={{ sf: 'tray', md: 'inbox' }} tone="neutral" title="Không có hồ sơ cần xử lý" body="Hồ sơ mới gửi tới phường sẽ hiện ở đây." />
      ) : (
        visible.map((i) => <QueueRow key={i.key} item={i} />)
      )}
    </Screen>
  );
}

function Counter({ label, value, wash, ink }: { label: string; value: number; wash: string; ink: string }) {
  return (
    <View style={{ flex: 1, padding: 12, gap: 2, borderRadius: 16, borderCurve: 'continuous', backgroundColor: wash }}>
      <Text style={[{ fontFamily: fonts.code, fontSize: 26, color: ink }, tabular]}>{value}</Text>
      <Text style={[text.caption, { color: ink }]}>{label}</Text>
    </View>
  );
}

const CATEGORY_LOOK = {
  REG: { sf: 'doc.text.fill', md: 'description', wash: colors.brandTint, ink: colors.primary, label: 'Đăng ký' },
  RENTAL: { sf: 'square.grid.3x3.fill', md: 'grid_view', wash: colors.signTint, ink: colors.sign, label: 'Thuê ô' },
  RENEWAL: { sf: 'calendar.badge.plus', md: 'event_repeat', wash: colors.leafTint, ink: colors.onLeaf, label: 'Gia hạn' },
};

function QueueRow({ item }: { item: QueueItem }) {
  const look = CATEGORY_LOOK[item.category];
  const s = statusLabel(item.status);
  return (
    <Pressable onPress={() => go(item.href)} accessibilityRole="button" accessibilityLabel={`${look.label}: ${item.title}, ${s.label}`} style={({ pressed }) => ({ padding: 14, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: item.overdue ? 2 : item.risk > 0 ? 1.5 : 0, borderColor: item.overdue ? colors.danger : colors.mango })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: look.wash, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={look.sf} md={look.md} size={17} color={look.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[text.caption, { color: colors.muted }]} numberOfLines={2}>{item.subtitle}</Text>
        </View>
        <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <StatusPill label={s.label} tone={s.tone} />
        {item.fastTrack ? <AiTag label="Xét nhanh" /> : null}
        {item.risk > 0 ? <StatusPill label={`Rủi ro ${item.risk}đ`} tone="pending" /> : null}
        <Text style={[text.caption, { color: colors.muted }]}>Nộp {formatVietnamDate(item.submittedAt)}</Text>
      </View>
      {item.reasons.length ? <Text style={[text.caption, { color: colors.onMango }]}>{item.reasons.join(' · ')}</Text> : null}
    </Pressable>
  );
}

/**
 * Idea 4 (WARD-09): approve several fast-track renewals with one shared reason. Each still runs
 * through the backend's own checks; this is "Approve N times", never a way around a check.
 */
function FastTrackBatch({ candidates, onDone }: { candidates: WardRenewalItem[]; onDone: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const live = new Set([...selected].filter((id) => candidates.some((c) => c.id === id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const total = candidates.filter((c) => live.has(c.id)).reduce((s, c) => s + c.totalFee, 0);
  const submit = async () => {
    if (live.size === 0 || !reason.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await complianceApi.batchDecideRenewals(
        candidates.filter((c) => live.has(c.id)).map((c) => ({ renewalId: Number(c.id), expectedStatus: c.status })),
        'APPROVE',
        reason.trim(),
      );
      setResult(`Đã xử lý: ${res.successCount} thành công, ${res.failureCount} thất bại.`);
      setSelected(new Set());
      setReason('');
      onDone();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ padding: 14, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.mangoTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AiTag label="Gợi ý" />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.onMango }}>Duyệt nhanh hàng loạt</Text>
        <Pressable onPress={() => setSelected(live.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.id)))} hitSlop={8}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{live.size === candidates.length ? 'Bỏ chọn' : 'Chọn tất cả'}</Text>
        </Pressable>
      </View>
      <Text style={[text.caption, { color: colors.onMango }]}>Gợi ý chỉ để chọn nhanh. Từng hồ sơ vẫn được máy chủ kiểm tra điều kiện riêng như duyệt thủ công; bạn là người quyết định.</Text>
      {candidates.map((c) => {
        const on = live.has(c.id);
        return (
          <Pressable key={c.id} onPress={() => toggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.white }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: on ? colors.cta : colors.white, borderWidth: on ? 0 : 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Icon sf="checkmark" md="check" size={13} color={colors.white} weight="bold" /> : null}
            </View>
            <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>{c.vendorName} · ô {c.slotCode} · +{c.requestedTermDays} ngày · {formatVnd(c.totalFee)}</Text>
          </Pressable>
        );
      })}
      <TextField label="Lý do phê duyệt chung" value={reason} onChangeText={setReason} multiline placeholder="Bắt buộc" />
      {result ? <Banner tone="success">{result}</Banner> : null}
      <Button label={busy ? 'Đang xử lý…' : `Duyệt ${live.size || ''} hồ sơ · ${formatVnd(total)}`.replace('  ', ' ')} loading={busy} disabled={live.size === 0 || !reason.trim()} onPress={() => void submit()} />
    </View>
  );
}

/** W-More: everything that is not a daily tab — money, reports, the ward's price and penalty tables, account. */
export function WardMoreScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Thêm' }} />
      <ListGroup title="Thu phí">
        <ListRow title="Thu phí & điều chỉnh" subtitle="Hợp đồng, miễn giảm, thu tại chỗ, hoàn cọc" icon={{ sf: 'banknote.fill', md: 'payments' }} tint={colors.onLeaf} tileColor={colors.leafTint} onPress={() => go('/ward/more/finance')} />
        <ListRow title="Báo cáo thu" subtitle="Theo kỳ, đúng hạn, theo tuyến" icon={{ sf: 'chart.bar.fill', md: 'bar_chart' }} onPress={() => go('/ward/more/reports')} />
        <ListRow title="Hộ còn nợ phí" subtitle="Nhắc nợ trong ứng dụng" icon={{ sf: 'person.crop.circle.badge.exclamationmark', md: 'person_alert' }} tint={colors.onMango} tileColor={colors.mangoTint} onPress={() => go('/ward/more/debtors')} />
      </ListGroup>
      <ListGroup title="Cấu hình phường">
        <ListRow title="Biểu giá thuê theo tuyến" subtitle="Giá, phí, hình thức thuê" icon={{ sf: 'tag.fill', md: 'sell' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go('/ward/more/pricing')} />
        <ListRow title="Khung mức phạt" subtitle="Theo NĐ 168/2024, có hiệu lực theo ngày" icon={{ sf: 'list.bullet.rectangle.fill', md: 'rule' }} tint={colors.danger} tileColor={colors.dangerTint} onPress={() => go('/ward/more/penalties')} />
      </ListGroup>
      <ListGroup title="Tài khoản">
        <ListRow title="Tài khoản cán bộ" icon={{ sf: 'person.crop.circle.fill', md: 'account_circle' }} onPress={() => go('/ward/more/account')} />
        <ListRow title="Thông báo" icon={{ sf: 'bell.fill', md: 'notifications' }} onPress={() => go('/notifications')} />
      </ListGroup>
    </Screen>
  );
}
