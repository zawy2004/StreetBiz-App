import { useQueries, useQueryClient } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionHeader, Segments, StatTile } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { PressableScale } from '@/components/common/PressableScale';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
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
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { daypart, Plate, RoundButton, Section, Signboard, type Daypart, useLightStatusBar } from '@/ui';
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

/** The shift, by the clock in Đà Nẵng, painted on the ward's board. */
const SHIFT_WORD: Record<Daypart, string> = {
  morning: 'vào ca sáng!',
  noon: 'trực ca trưa!',
  afternoon: 'trực ca chiều!',
  evening: 'trực ca tối!',
  night: 'trực ca đêm!',
};

/**
 * W01 Tổng quan (WARD-15), v5 (screens/v5/ward-review.md): the ward's own orange board greets
 * the officer by the shift and paints the two numbers of the day (files waiting, open
 * violations); the pavement's occupancy lies across the board's edge as a kerb of bays; then the
 * money as tiles, today's waiting work and the four jobs of a shift. Every figure is this
 * officer's own ward. Pull to refresh.
 */
export function WardDashboardScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const user = useAuthStore((s) => s.user);
  const wardName = useWardName();
  const unread = useNotificationUnreadCount();
  const dash = useWardDashboard();
  const d = dash.data;
  const pending = d ? d.pendingRegistrations + d.pendingApplications : 0;
  const firstName = (user?.fullName ?? '').trim().split(/\s+/).pop() ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()} tintColor={colors.cta} colors={[colors.cta]} progressViewOffset={insets.top} />}
      >
        <Signboard
          top={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf="building.columns.fill" md="account_balance" size={18} color={colors.sign} />
                </View>
                <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 15.5, lineHeight: 20, color: colors.white }}>
                  {wardName ?? 'Phường của bạn'}
                </Text>
              </View>
              <AssistantButton pageKey="ward.dashboard" tone="onSign" />
              <RoundButton icon={{ sf: 'bell.fill', md: 'notifications' }} label="Thông báo" badge={unread || undefined} onPress={() => go('/notifications')} />
            </View>
          }
          line1={`Chào ${firstName || 'cán bộ'},`}
          line2={SHIFT_WORD[daypart()]}
          caption={todayVi()}
          overlap={dash.isPending ? <Skeleton height={150} radius={radius.card} /> : d ? <KerbOccupancy rented={d.slotRented} total={d.slotTotal} percent={d.occupancyPercent} contracts={d.activeContracts} /> : undefined}
        >
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <SignFigure value={d ? String(pending) : '…'} label="hồ sơ chờ duyệt" onPress={() => router.navigate('/ward/inbox' as Href)} />
            <SignFigure value={d ? String(d.openViolations) : '…'} label="vi phạm đang mở" onPress={() => go('/ward/more/reports')} />
          </View>
        </Signboard>

        <View style={{ paddingHorizontal: 20, gap: 28 }}>
          {dash.isPending ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton height={132} radius={radius.card} style={{ flex: 1 }} />
                <Skeleton height={132} radius={radius.card} style={{ flex: 1 }} />
              </View>
              <Skeleton height={150} radius={radius.card} />
            </View>
          ) : dash.isError || !d ? (
            <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />
          ) : (
            <>
              {/* The money: what came in, what is still owed */}
              <Section title="Thu phí" inset={0} action={{ label: 'Báo cáo', onPress: () => go('/ward/more/reports') }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <StatTile value={formatVnd(d.revenueCollected)} label="Đã thu" tone="ok" icon={{ sf: 'banknote.fill', md: 'payments' }} onPress={() => go('/ward/more/reports')} />
                  <StatTile value={formatVnd(d.outstandingDebt)} label="Còn nợ" tone={d.outstandingDebt ? 'warn' : 'ink'} icon={{ sf: 'hourglass', md: 'hourglass_top' }} onPress={() => go('/ward/more/reports')} />
                </View>
              </Section>

              {/* Today's waiting work, from the same figures */}
              <Section title="Việc chờ bạn" inset={0}>
                {pending + d.openViolations === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
                      <Icon sf="checkmark" md="check" size={22} color={colors.white} weight="bold" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.onLeaf }}>Không có hồ sơ chờ duyệt</Text>
                      <Text style={[text.footnote, { color: colors.onLeaf }]}>Hồ sơ mới gửi tới phường sẽ hiện ở đây.</Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
                    <WorkRow first count={d.pendingRegistrations} title="Hồ sơ đăng ký kinh doanh" note="Thẩm định, đối chiếu CCCD" icon={{ sf: 'doc.text.fill', md: 'description' }} wash={colors.brandTint} ink={colors.primary} onPress={() => router.navigate('/ward/inbox' as Href)} />
                    <WorkRow count={d.pendingApplications} title="Đơn thuê ô vỉa hè" note="Duyệt và cấp giấy phép số" icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} wash={colors.signTint} ink={colors.sign} onPress={() => router.navigate('/ward/inbox' as Href)} />
                    <WorkRow count={d.openViolations} title="Vi phạm đang mở" note="Biên bản chưa khép" icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} wash={colors.dangerTint} ink={colors.danger} onPress={() => go('/ward/more/reports')} />
                  </View>
                )}
              </Section>
            </>
          )}

          {/* The four jobs of a shift */}
          <Section title="Lối tắt ca trực" inset={0}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <ShiftTile lead label="Quét QR tuần tra" note="Kiểm tra giấy phép số tại chỗ" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={() => router.navigate('/ward/patrol' as Href)} />
              <ShiftTile label="Lập biên bản vi phạm" note="Biên bản hiện trường (NĐ 168/2024)" icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} wash={colors.dangerTint} ink={colors.danger} onPress={() => go('/ward/patrol/violations/new')} />
              <ShiftTile label="Hộp duyệt" note="Đăng ký, thuê ô, gia hạn, ATTP" icon={{ sf: 'tray.full.fill', md: 'inbox' }} wash={colors.signTint} ink={colors.sign} onPress={() => router.navigate('/ward/inbox' as Href)} />
              <ShiftTile label="Thu phí & công nợ" note="Hợp đồng, miễn giảm, thu tại chỗ" icon={{ sf: 'banknote.fill', md: 'payments' }} wash={colors.leafTint} ink={colors.onLeaf} onPress={() => go('/ward/more/finance')} />
            </View>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

/** A figure painted on the board: white Archivo number, its words under it. Tapping opens the list behind it. */
function SignFigure({ value, label, onPress }: { value: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => ({ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: pressed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)', gap: 2 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { flexShrink: 1, color: colors.white }, tabular]}>
          {value}
        </Text>
        <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.white} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 18, color: colors.white }}>{label}</Text>
    </Pressable>
  );
}

/**
 * The pavement's occupancy as the kerb itself: a row of bays, the rented ones painted orange,
 * the percentage in sign figures. It sits across the board's edge and opens the slot grid.
 */
function KerbOccupancy({ rented, total, percent, contracts }: { rented: number; total: number; percent: number; contracts: number }) {
  const bays = Math.min(total, 16);
  const painted = Math.round((rented / Math.max(total, 1)) * bays);
  return (
    <PressableScale onPress={() => router.navigate('/ward/slots' as Href)} accessibilityLabel={`Lấp đầy ${percent}%, ${rented} trên ${total} ô, ${contracts} hợp đồng hiệu lực. Mở lưới ô`}>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised, overflow: 'hidden' }}>
        <View style={{ padding: 18, paddingBottom: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Ô vỉa hè đã cho thuê</Text>
              <Text style={[text.footnote, tabular, { color: colors.muted }]}>
                {rented}/{total} ô, {contracts} hợp đồng hiệu lực
              </Text>
            </View>
            <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: colors.primary }]}>{percent}%</Text>
          </View>
          {total > 0 ? (
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {Array.from({ length: bays }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 28, borderRadius: radius.plate, backgroundColor: i < painted ? colors.brand : colors.sunken, borderWidth: i < painted ? 0 : 1, borderStyle: 'dashed', borderColor: colors.line }} />
              ))}
            </View>
          ) : (
            <Text style={[text.footnote, { color: colors.muted }]}>Phường chưa có ô vỉa hè nào trên lưới.</Text>
          )}
        </View>
        <KerbStrip height={8} segment={18} />
      </View>
    </PressableScale>
  );
}

/** One line of waiting work: an icon disc, what it is, how many in sign figures. */
function WorkRow({ count, title, note, icon, wash, ink, onPress, first }: { count: number; title: string; note: string; icon: { sf: string; md: string }; wash: string; ink: string; onPress: () => void; first?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${count}. ${note}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: first ? 0 : 1, borderTopColor: colors.separator })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={20} color={ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>{title}</Text>
        <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text>
      </View>
      <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: count ? ink : colors.muted }]}>{count}</Text>
      <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
    </Pressable>
  );
}

/** A job of the shift; the lead one (the patrol scan) in the ward's civic blue. */
function ShiftTile({ label, note, icon, wash = colors.brandTint, ink = colors.primary, lead, onPress }: { label: string; note: string; icon: { sf: string; md: string }; wash?: string; ink?: string; lead?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${label}. ${note}`}
      style={{ width: '47.5%', flexGrow: 1, padding: 16, gap: 12, minHeight: 132, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: lead ? colors.sign : colors.card, boxShadow: lead ? '0 12px 26px -12px rgba(10, 95, 168, 0.55)' : shadow.card }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: lead ? 'rgba(255,255,255,0.22)' : wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={22} color={lead ? colors.white : ink} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 21, color: lead ? colors.white : colors.ink }}>{label}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: lead ? colors.white : colors.muted }}>{note}</Text>
      </View>
    </PressableScale>
  );
}

type Category = 'ALL' | 'REG' | 'RENTAL' | 'RENEWAL' | 'FAST';
type QueueItem = {
  key: string;
  category: Exclude<Category, 'ALL' | 'FAST'>;
  title: string;
  subtitle: string;
  /** A second detail line (term, money). */
  detail?: string;
  /** The slot's plate, when the file is about a slot. */
  plate?: string;
  /** A registration flagged for expedited handling (display only; not the FAST filter). */
  priority?: boolean;
  status: string;
  risk: number;
  reasons: string[];
  fastTrack?: boolean;
  overdue?: boolean;
  submittedAt: string;
  href: string;
};

/**
 * W02 Hộp duyệt, v5: the queue's tally painted over a strip of kerb (waiting, to look at
 * closely, overdue), the two other desks side by side, then registrations, rental applications
 * and renewals in one list, riskiest first, filtered by a segmented control. Risk and "[AI] xét
 * nhanh" only order and flag; every decision is the officer's (BR-41).
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
        subtitle: `Đăng ký điểm bán, ${r.vendorType === 'FIXED_STOREFRONT' ? 'cửa hàng cố định' : 'hàng rong lưu động'}`,
        priority: r.fastTrack,
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
      title: a.vendorName,
      subtitle: `Xin thuê ô, ${a.slotStreet}`,
      detail: `${a.requestedTermDays} ngày, ${formatVnd(a.pricePerDay)}/ngày`,
      plate: a.slotCode,
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
        title: rn.vendorName,
        subtitle: `Gia hạn hợp đồng #${rn.contractId}`,
        detail: `+${rn.requestedTermDays} ngày, ${formatVnd(rn.totalFee)}`,
        plate: rn.slotCode,
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
    <Screen onRefresh={refresh} refreshing={refreshing} gap={18}>
      <Stack.Screen options={{ title: 'Hộp duyệt', headerLargeTitleEnabled: true }} />

      {/* The queue's tally over a strip of kerb */}
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, overflow: 'hidden' }}>
        <KerbStrip height={8} segment={18} />
        <View style={{ flexDirection: 'row', paddingVertical: 14 }}>
          <Tally label="Đang chờ" value={loading ? '…' : String(items.length)} ink={colors.ink} />
          <Tally label="Cần xem kỹ" value={loading ? '…' : String(items.filter((i) => i.risk > 0).length)} ink={colors.onMango} divider />
          <Tally label="Quá hạn" value={loading ? '…' : String(renewals.filter((r) => r.isOverdue).length)} ink={colors.onDanger} divider />
        </View>
      </View>

      {/* The other two desks */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <DeskTile title="Hồ sơ vị trí" note="Đề xuất ô, xung đột địa chỉ, chuyển nhượng" icon={{ sf: 'mappin.and.ellipse', md: 'location_on' }} wash={colors.signTint} ink={colors.sign} onPress={() => go('/ward/inbox/cases')} />
        <DeskTile title="An toàn thực phẩm" note="Kiểm tra, chuyển Chi cục, ghi kết quả" icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} wash={colors.leafTint} ink={colors.onLeaf} onPress={() => go('/ward/inbox/food-safety')} />
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Đăng ký, thuê ô & gia hạn" note="Hồ sơ cần xem kỹ được xếp lên đầu." />
        <Segments<Category>
          value={category}
          onChange={setCategory}
          options={[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'REG', label: 'Đăng ký', count: count('REG') },
            { key: 'RENTAL', label: 'Thuê ô', count: count('RENTAL') },
            { key: 'RENEWAL', label: 'Gia hạn', count: count('RENEWAL') },
          ]}
        />
        {/* [AI] fast-track: a filter of its own, in the advisory mango */}
        <Pressable
          onPress={() => setCategory(category === 'FAST' ? 'ALL' : 'FAST')}
          accessibilityRole="radio"
          accessibilityState={{ selected: category === 'FAST' }}
          accessibilityLabel={`[AI] Xét nhanh, ${fast.length} hồ sơ gia hạn`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: category === 'FAST' ? colors.sticker : pressed ? colors.sticker : colors.mangoTint })}
        >
          <Icon sf="sparkles" md="auto_awesome" size={16} color={colors.onMango} />
          <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 14.5, color: colors.onMango }}>[AI] Xét nhanh gia hạn</Text>
          <Text style={[sign.price, tabular, { color: colors.onMango }]}>{fast.length}</Text>
          <Icon sf={category === 'FAST' ? 'xmark' : 'chevron.right'} md={category === 'FAST' ? 'close' : 'chevron_right'} size={13} color={colors.onMango} />
        </Pressable>
      </View>

      {category === 'FAST' && fast.length > 0 ? <FastTrackBatch candidates={fast} onDone={refresh} /> : null}
      {loading ? (
        <ListSkeleton rows={4} height={104} />
      ) : failed ? (
        <ErrorState error={results[0]!.error} onRetry={refresh} />
      ) : visible.length === 0 ? (
        <StateView icon={{ sf: 'tray', md: 'inbox' }} tone="neutral" title="Không có hồ sơ cần xử lý" body="Hồ sơ mới gửi tới phường sẽ hiện ở đây. Kéo xuống để tải lại." action={{ label: 'Tải lại', onPress: refresh }} />
      ) : (
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {visible.map((i, n) => (
            <QueueRow key={i.key} item={i} first={n === 0} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Tally({ label, value, ink, divider }: { label: string; value: string; ink: string; divider?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6, borderLeftWidth: divider ? 1 : 0, borderLeftColor: colors.separator }}>
      <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: ink }]}>{value}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.muted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function DeskTile({ title, note, icon, wash, ink, onPress }: { title: string; note: string; icon: { sf: string; md: string }; wash: string; ink: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${title}. ${note}`} style={{ flex: 1, padding: 14, gap: 10, minHeight: 120, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: wash, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={icon.sf} md={icon.md} size={20} color={ink} />
        </View>
        <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 15.5, lineHeight: 20, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted }}>{note}</Text>
      </View>
    </PressableScale>
  );
}

const CATEGORY_LOOK = {
  REG: { sf: 'doc.text.fill', md: 'description', wash: colors.brandTint, ink: colors.primary, label: 'Đăng ký' },
  RENTAL: { sf: 'square.grid.3x3.fill', md: 'grid_view', wash: colors.signTint, ink: colors.sign, label: 'Thuê ô' },
  RENEWAL: { sf: 'calendar.badge.plus', md: 'event_repeat', wash: colors.leafTint, ink: colors.onLeaf, label: 'Gia hạn' },
};

/** One file in the queue: a coloured edge for risk (mango) or overdue (red), the slot plate when it has one. */
function QueueRow({ item, first }: { item: QueueItem; first?: boolean }) {
  const look = CATEGORY_LOOK[item.category];
  const s = statusLabel(item.status);
  const edge = item.overdue ? colors.danger : item.risk > 0 ? colors.mango : 'transparent';
  return (
    <Pressable
      onPress={() => go(item.href)}
      accessibilityRole="button"
      accessibilityLabel={`${look.label}: ${item.title}${item.plate ? `, ô ${item.plate}` : ''}, ${s.label}${item.risk > 0 ? `, rủi ro ${item.risk} điểm` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: 14, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: first ? 0 : 1, borderTopColor: colors.separator, borderLeftWidth: 5, borderLeftColor: edge })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: look.wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={look.sf} md={look.md} size={19} color={look.ink} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }} numberOfLines={2}>{item.title}</Text>
          <Text style={[text.footnote, { color: colors.muted }]} numberOfLines={2}>{item.subtitle}</Text>
        </View>
        {item.plate || item.detail ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {item.plate ? <Plate code={item.plate} /> : null}
            {item.detail ? <Text style={[text.footnote, tabular, { color: colors.ink, fontFamily: fonts.semibold }]}>{item.detail}</Text> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <StatusPill label={s.label} tone={s.tone} />
          {item.priority ? <StatusPill label="Ưu tiên xét nhanh" tone="ok" /> : null}
          {item.fastTrack ? <AiTag label="Xét nhanh" /> : null}
          {item.risk > 0 ? <StatusPill label={`Rủi ro ${item.risk}đ`} tone="pending" /> : null}
          <Text style={[text.caption, tabular, { color: colors.muted }]}>Nộp {formatVietnamDate(item.submittedAt)}</Text>
        </View>
        {item.reasons.length ? (
          <View style={{ gap: 2 }}>
            {item.reasons.map((r) => (
              <Text key={r} style={[text.caption, { color: colors.onMango }]}>{r}</Text>
            ))}
          </View>
        ) : null}
      </View>
      <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} style={{ marginTop: 16 }} />
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
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.mangoTint, borderWidth: 1.5, borderColor: colors.sticker }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AiTag label="Gợi ý" />
          <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.onMango }}>Duyệt nhanh hàng loạt</Text>
        </View>
        <Pressable onPress={() => setSelected(live.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.id)))} hitSlop={8} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: colors.primary }}>{live.size === candidates.length ? 'Bỏ chọn' : 'Chọn tất cả'}</Text>
        </Pressable>
      </View>
      <Text style={[text.footnote, { color: colors.onMango }]}>Gợi ý chỉ để chọn nhanh. Từng hồ sơ vẫn được máy chủ kiểm tra điều kiện riêng như duyệt thủ công; bạn là người quyết định.</Text>
      <View style={{ borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card }}>
        {candidates.map((c, n) => {
          const on = live.has(c.id);
          return (
            <Pressable key={c.id} onPress={() => toggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${c.vendorName}, ô ${c.slotCode}, thêm ${c.requestedTermDays} ngày, ${formatVnd(c.totalFee)}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: n === 0 ? 0 : 1, borderTopColor: colors.separator })}>
              <View style={{ width: 26, height: 26, borderRadius: radius.plate, backgroundColor: on ? colors.sign : colors.white, borderWidth: on ? 0 : 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Icon sf="checkmark" md="check" size={15} color={colors.white} weight="bold" /> : null}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{c.vendorName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Plate code={c.slotCode} />
                  <Text style={[text.footnote, tabular, { color: colors.muted }]}>+{c.requestedTermDays} ngày, {formatVnd(c.totalFee)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <TextField label="Lý do phê duyệt chung" value={reason} onChangeText={setReason} multiline placeholder="Bắt buộc" />
      {result ? <Banner tone="success">{result}</Banner> : null}
      <Button label={busy ? 'Đang xử lý…' : `Duyệt ${live.size || ''} hồ sơ, ${formatVnd(total)}`.replace('  ', ' ')} variant="sign" size={56} loading={busy} disabled={live.size === 0 || !reason.trim()} onPress={() => void submit()} />
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
