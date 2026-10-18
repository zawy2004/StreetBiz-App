import { useQueries, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { PressableScale } from '@/components/common/PressableScale';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StatusPill } from '@/components/status/StatusPill';
import { sideApi } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { useRegistrations } from '@/features/business-registrations/useRegistrations';
import { useFeeItems, usePenalties } from '@/features/fee-schedules/useFinance';
import { useNotificationUnreadCount } from '@/features/notifications/notifications-api';
import { formatCountdown, hkdCode, secondsUntil } from '@/features/sidewalk-slots/slot-format';
import { useHolds } from '@/features/sidewalk-slots/useHolds';
import { useNow } from '@/features/sidewalk-slots/useNow';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, space, tabular, text } from '@/theme';
import { contractProgress, formatVietnamDate, formatVnd, formatVietnamTime } from '@/utils/format';
import { buildTodos, type Todo } from '../todos';

const go = (href: string) => router.push(href as Href);
const VISIBLE = 4;

const TODO_LOOK: Record<Todo['kind'], { icon: { sf: string; md: string }; wash: string; ink: string }> = {
  registration: { icon: { sf: 'doc.text.fill', md: 'description' }, wash: colors.signTint, ink: colors.sign },
  fee: { icon: { sf: 'banknote.fill', md: 'payments' }, wash: colors.brandTint, ink: colors.primary },
  penalty: { icon: { sf: 'exclamationmark.octagon.fill', md: 'report' }, wash: colors.dangerTint, ink: colors.danger },
};

function TodoTicket({ todo }: { todo: Todo }) {
  const look = TODO_LOOK[todo.kind];
  const sub = [
    todo.amount != null ? formatVnd(todo.amount) : null,
    todo.date ? `${todo.kind === 'fee' ? 'hạn' : 'ngày'} ${formatVietnamDate(todo.date)}` : null,
    todo.slotCode ? `ô ${todo.slotCode}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      onPress={() => go(todo.path)}
      accessibilityRole="button"
      accessibilityLabel={`${todo.title}. ${sub}${todo.overdue ? '. Quá hạn' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        backgroundColor: pressed ? colors.pressed : colors.card,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, borderCurve: 'continuous', backgroundColor: look.wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={look.icon.sf} md={look.icon.md} size={19} color={look.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={[text.headline, { color: colors.ink }]}>
          {todo.title}
        </Text>
        {sub ? <Text style={[text.footnote, tabular, { color: colors.muted }]}>{sub}</Text> : null}
        {todo.note ? (
          <Text numberOfLines={2} style={[text.footnote, { color: '#2B3640' }]}>
            {todo.note}
          </Text>
        ) : null}
      </View>
      {todo.overdue ? <StatusPill label="Quá hạn" tone="danger" /> : null}
      <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
    </Pressable>
  );
}

/** The vendor's first ACTIVE contract with a permit (the web's useCurrentPermit, same keys). */
function useCurrentPermit() {
  const userId = useAuthStore((s) => s.user?.id);
  const contracts = useQuery({
    queryKey: ['side', userId, 'contracts'],
    queryFn: () => sideApi.listContracts(),
  });
  const active = (contracts.data ?? []).filter((c) => c.contractStatus === 'ACTIVE');
  const permits = useQueries({
    queries: active.map((c) => ({
      queryKey: ['side', userId, 'permit', c.contractId],
      queryFn: () => sideApi.getPermit(c.contractId),
      retry: false,
      staleTime: 0,
      gcTime: 0,
    })),
  });
  const row = active
    .map((contract, i) => ({ contract, permit: permits[i]?.data, at: permits[i]?.dataUpdatedAt }))
    .find((r) => r.permit);
  return {
    row,
    loading: contracts.isLoading || permits.some((p) => p.isLoading),
    refetch: () => {
      void contracts.refetch();
      permits.forEach((p) => void p.refetch());
    },
  };
}

function PermitMini({ row }: { row: NonNullable<ReturnType<typeof useCurrentPermit>['row']> }) {
  const { contract, permit, at } = row;
  const valid = permit!.effectiveStatus === 'VALID';
  const { label, tone } = statusLabel(permit!.effectiveStatus);
  const days = contractProgress(permit!.startDate, permit!.endDate, new Date()).daysLeft;
  return (
    <PressableScale
      onPress={() => go(`/vendor/slots/contracts/${contract.contractId}/permit`)}
      accessibilityLabel={`Giấy phép số ô ${contract.slotCode}: ${label}, còn ${days} ngày. Mở để đưa cán bộ quét`}
      style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: '0 12px 28px -18px rgba(238, 85, 0, 0.6)' }}
    >
      <LinearGradient
        colors={valid ? [colors.cta, colors.brand, colors.brandLight] : ['#5F6B7A', '#7B8794']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>Giấy phép vỉa hè</Text>
          <Text style={{ fontFamily: fonts.code, fontSize: 38, lineHeight: 44, color: colors.white, letterSpacing: 0.5 }}>
            {contract.slotCode}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.95)' }}>
            {contract.zoneName}
          </Text>
        </View>
        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="qrcode" md="qr_code_2" size={38} color={colors.ink} />
        </View>
      </LinearGradient>
      <KerbStrip height={5} segment={20} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
        <StatusPill label={label} tone={tone} />
        <Text style={[text.footnote, tabular, { flex: 1, color: colors.muted }]}>
          {valid ? `Còn ${days} ngày` : 'Không có hiệu lực'}
          {at ? `, kiểm tra lúc ${formatVietnamTime(at).slice(0, 5)}` : ''}
        </Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Mở mã</Text>
      </View>
    </PressableScale>
  );
}

const SHORTCUTS: { label: string; note: string; href: string; icon: { sf: string; md: string }; warm?: boolean }[] = [
  { label: 'Thuê ô vỉa hè', note: 'Chọn ô, giữ chỗ, nộp đơn', href: '/vendor/slots', icon: { sf: 'square.grid.3x3.fill', md: 'grid_view' }, warm: true },
  { label: 'Đăng ký kinh doanh', note: 'Hồ sơ hộ kinh doanh', href: '/vendor/home/registrations', icon: { sf: 'doc.text.fill', md: 'description' } },
  { label: 'Quét mã nhận hàng', note: 'Giao món cho khách', href: '/vendor/orders/scan', icon: { sf: 'qrcode.viewfinder', md: 'qr_code_scanner' } },
  { label: 'Cửa hàng & thực đơn', note: 'Món, giá, ATTP', href: '/vendor/home/store', icon: { sf: 'storefront.fill', md: 'storefront' } },
];

/**
 * V01 Trang chủ người bán: "the board at the counter at dawn". What waits today and how much
 * to pay, the permit as a pass to show in one tap, a slot hold counting down, the way to the
 * four jobs of the day. Pull down to check everything again.
 */
export function VendorHomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const regs = useRegistrations();
  const fees = useFeeItems();
  const penalties = usePenalties();
  const permit = useCurrentPermit();
  const { holds, refresh: refreshHolds } = useHolds();
  const unread = useNotificationUnreadCount();
  const now = useNow();
  const [expanded, setExpanded] = useState(false);

  const todos = buildTodos(regs.registrations, fees.feeItems, penalties.penalties);
  const toPay = todos.reduce((n, t) => n + (t.amount ?? 0), 0);
  const latest = [...regs.registrations].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const approved = regs.registrations.find((r) => r.registrationStatus === 'APPROVED');
  const hkd = approved ?? latest;
  const loadingBoard = regs.isLoading || fees.isLoading || penalties.isLoading;
  const firstName = (user?.fullName ?? '').trim().split(/\s+/).pop() ?? '';
  const liveHolds = holds.filter((h) => secondsUntil(h.expiresAt, now) > 0);
  const soonest = liveHolds.reduce((m, h) => Math.min(m, secondsUntil(h.expiresAt, now)), Infinity);

  const refresh = () => {
    void regs.refetch();
    void fees.refetch();
    void penalties.refetch();
    permit.refetch();
    refreshHolds();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 22, lineHeight: 28, color: colors.ink }} numberOfLines={1}>
            Chào {firstName || 'bạn'}
          </Text>
          {hkd ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: fonts.code, fontSize: 14, color: colors.muted }}>{hkdCode(hkd.registrationId)}</Text>
              {latest ? <StatusPill label={statusLabel(latest.registrationStatus).label} tone={statusLabel(latest.registrationStatus).tone} /> : null}
            </View>
          ) : (
            <Text style={[text.footnote, { color: colors.muted }]}>Hộ kinh doanh</Text>
          )}
        </View>
        <HeaderIconButton icon={{ sf: 'bubble.left.and.bubble.right.fill', md: 'chat' }} label="Tin nhắn" onPress={() => go('/vendor/home/chat')} />
        <HeaderIconButton icon={{ sf: 'bell.fill', md: 'notifications' }} label="Thông báo" badge={unread} onPress={() => go('/notifications')} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.md, paddingTop: 4, paddingBottom: 40, gap: 18 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.cta} colors={[colors.cta]} />}
      >
        {/* Today's board */}
        {loadingBoard && todos.length === 0 ? (
          <Skeleton height={150} radius={radius.card} />
        ) : todos.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="checkmark" md="check" size={22} color={colors.white} weight="bold" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.headline, { color: colors.onLeaf }]}>Không có việc cần xử lý</Text>
              <Text style={[text.footnote, { color: colors.onLeaf }]}>Phí, biên bản và yêu cầu bổ sung hồ sơ sẽ hiện ở đây.</Text>
            </View>
          </View>
        ) : (
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: '0 12px 30px -20px rgba(17, 28, 43, 0.4)' }}>
            <LinearGradient colors={[colors.cta, colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, gap: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>Việc hôm nay</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 44, lineHeight: 50, color: colors.white }, tabular]}>{todos.length}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.white }}>việc cần làm</Text>
              </View>
              {toPay > 0 ? (
                <Text style={[{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }, tabular]}>Cần trả {formatVnd(toPay)}</Text>
              ) : null}
            </LinearGradient>
            {(expanded ? todos : todos.slice(0, VISIBLE)).map((t, i) => (
              <View key={t.key} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.separator }}>
                <TodoTicket todo={t} />
              </View>
            ))}
            {todos.length > VISIBLE ? (
              <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.separator, backgroundColor: pressed ? colors.pressed : colors.card })}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary }}>
                  {expanded ? 'Thu gọn' : `Xem thêm ${todos.length - VISIBLE} việc`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* No registration yet: the way in */}
        {!regs.isLoading && regs.registrations.length === 0 ? (
          <View style={{ padding: 18, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
            <View style={{ gap: 4 }}>
              <Text style={[text.title3, { color: colors.ink }]}>Chưa có hồ sơ đăng ký</Text>
              <Text style={[text.callout, { color: colors.muted }]}>Đăng ký kinh doanh để bắt đầu thuê ô vỉa hè hợp pháp.</Text>
            </View>
            {['Nộp hồ sơ hộ kinh doanh', 'Phường duyệt, cấp mã HKD', 'Thuê ô, nhận giấy phép QR'].map((s, i) => (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? colors.cta : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: i === 0 ? colors.white : colors.muted }}>{i + 1}</Text>
                </View>
                <Text style={[text.callout, { color: colors.ink }]}>{s}</Text>
              </View>
            ))}
            <Button label="Đăng ký ngay" onPress={() => go('/vendor/home/registrations/new/type')} />
            <Pressable onPress={() => go('/vendor/home/onboarding')} hitSlop={8} accessibilityRole="link" style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Xem các bước bắt đầu</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Permit pass */}
        {permit.row ? <PermitMini row={permit.row} /> : permit.loading ? <Skeleton height={170} radius={radius.card} /> : null}

        {/* Slot hold counting down */}
        {liveHolds.length > 0 ? (
          <Pressable
            onPress={() => go('/vendor/slots')}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FFEFC2' : colors.mangoTint })}
          >
            <Icon sf="timer" md="timer" size={22} color={colors.onMango} />
            <Text style={[text.headline, tabular, { flex: 1, color: colors.onMango }]}>
              Đang giữ chỗ {liveHolds.length} ô, còn {formatCountdown(soonest)}
            </Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onMango }}>Nộp đơn ›</Text>
          </Pressable>
        ) : null}

        {/* Shortcuts */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {SHORTCUTS.map((s) => (
            <PressableScale
              key={s.href}
              onPress={() => go(s.href)}
              accessibilityLabel={`${s.label}. ${s.note}`}
              style={{ width: '47.5%', flexGrow: 1, padding: 16, gap: 10, minHeight: 124, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: s.warm ? colors.cta : colors.card }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, borderCurve: 'continuous', backgroundColor: s.warm ? 'rgba(255,255,255,0.22)' : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={s.icon.sf} md={s.icon.md} size={20} color={s.warm ? colors.white : colors.primary} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 20, color: s.warm ? colors.white : colors.ink }}>{s.label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16, color: s.warm ? 'rgba(255,255,255,0.92)' : colors.muted }}>{s.note}</Text>
              </View>
            </PressableScale>
          ))}
        </View>

        <Pressable onPress={() => go('/vendor/home/onboarding')} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card })}>
          <Icon sf="map.fill" md="map" size={20} color={colors.sign} />
          <View style={{ flex: 1 }}>
            <Text style={[text.headline, { color: colors.ink }]}>Hướng dẫn 6 bước lên phố</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>Từ tạo tài khoản tới mở gian hàng</Text>
          </View>
          <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
