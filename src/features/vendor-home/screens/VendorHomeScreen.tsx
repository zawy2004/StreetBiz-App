import { useQueries, useQuery } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StatusPill } from '@/components/status/StatusPill';
import { sideApi } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { useRegistrations } from '@/features/business-registrations/useRegistrations';
import { AssistantButton } from '@/features/assistant/components/AssistantButton';
import { useChatUnreadCount } from '@/features/chat/hooks/useChat';
import { useFeeItems, usePenalties } from '@/features/fee-schedules/useFinance';
import { useNotificationUnreadCount } from '@/features/notifications/notifications-api';
import { formatCountdown, hkdCode, secondsUntil } from '@/features/sidewalk-slots/slot-format';
import { useHolds } from '@/features/sidewalk-slots/useHolds';
import { useNow } from '@/features/sidewalk-slots/useNow';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { daypart, Pass, Plate, RoundButton, Signboard, type Daypart, useLightStatusBar } from '@/ui';
import { contractProgress, formatVietnamDate, formatVnd, formatVietnamTime } from '@/utils/format';
import type { ApiRegistration } from '@/core/api';
import { buildTodos, type SlotsNearApproval, type Todo } from '../todos';

const go = (href: string) => router.push(href as Href);
const VISIBLE = 4;

/** The street's own words for a good day's trade, by the clock in Đà Nẵng ("bán đắt" = selling well). */
const SELLING_WORD: Record<Daypart, string> = {
  morning: 'mở hàng thôi!',
  noon: 'trưa bán đắt!',
  afternoon: 'chiều bán đắt!',
  evening: 'tối bán đắt!',
  night: 'nghỉ sớm nhé!',
};

const TODO_LOOK: Record<Todo['kind'], { icon: { sf: string; md: string }; wash: string; ink: string }> = {
  registration: { icon: { sf: 'doc.text.fill', md: 'description' }, wash: colors.signTint, ink: colors.sign },
  slots: { icon: { sf: 'mappin.and.ellipse', md: 'location_on' }, wash: colors.leafTint, ink: colors.leaf },
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
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? colors.pressed : colors.card,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', backgroundColor: look.wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={look.icon.sf} md={look.icon.md} size={21} color={look.ink} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>
          {todo.title}
        </Text>
        {sub ? <Text style={[text.footnote, tabular, { color: colors.muted }]}>{sub}</Text> : null}
        {todo.note ? (
          <Text numberOfLines={2} style={[text.footnote, { color: '#2B3640' }]}>
            {todo.note}
          </Text>
        ) : null}
        {todo.overdue ? <StatusPill label="Quá hạn" tone="danger" style={{ marginTop: 3 }} /> : null}
      </View>
      <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
    </Pressable>
  );
}

/** Rental applications still in flight, or already granted (SlotConstants: Open + Approved). */
const SLOT_APPLICATION_TAKEN = new Set(['PENDING', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'APPROVED']);
/** Contracts that already give the vendor a slot. */
const SLOT_CONTRACT_HELD = new Set(['ACTIVE', 'SUSPENDED']);
/** "Gần chỗ bạn bán": a short walk from the spot the registration recorded. */
const NEAR_RADIUS_METERS = 300;

/**
 * X01 after approval (the web's hook, same keys): when the newest registration is APPROVED and the
 * vendor has no slot application or contract yet, count the free slots near the spot it recorded --
 * now, not when it was filed (a slot seen during the interview may have been rented meanwhile).
 */
function useSlotsNearApproval(registrations: ApiRegistration[]): SlotsNearApproval | null {
  const userId = useAuthStore((s) => s.user?.id);
  const latest = [...registrations].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const approved = latest?.registrationStatus === 'APPROVED' ? latest : null;
  const enabled = approved != null;
  const applications = useQuery({ queryKey: ['side', userId, 'applications'], queryFn: () => sideApi.listApplications(), enabled });
  const contracts = useQuery({ queryKey: ['side', userId, 'contracts'], queryFn: () => sideApi.listContracts(), enabled });
  const hasSlot = (applications.data ?? []).some((a) => SLOT_APPLICATION_TAKEN.has(a.applicationStatus)) || (contracts.data ?? []).some((c) => SLOT_CONTRACT_HELD.has(c.contractStatus));
  const lat = approved?.addressLatitude ?? null;
  const lng = approved?.addressLongitude ?? null;
  const ready = enabled && applications.isSuccess && contracts.isSuccess && !hasSlot;
  const near = useQuery({
    queryKey: ['side', userId, 'slots', { lat, lng, radiusMeters: NEAR_RADIUS_METERS }],
    queryFn: () => sideApi.searchSlots({ lat: lat!, lng: lng!, radiusMeters: NEAR_RADIUS_METERS, take: 50 }),
    enabled: ready && lat != null && lng != null,
  });

  if (!ready || !approved) return null;
  if (lat == null || lng == null) return { registrationId: approved.registrationId, displayName: approved.displayName, count: 0, nearest: null };
  if (!near.isSuccess) return null;
  const free = [...near.data].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  return {
    registrationId: approved.registrationId,
    displayName: approved.displayName,
    count: free.length,
    nearest: free[0] ? { zoneId: free[0].zoneId, slotId: free[0].slotId, zoneName: free[0].zoneName } : null,
  };
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

/**
 * The permit as the pass the vendor hands the officer (v5 `Pass`): the slot code large in sign
 * lettering, the street, a QR tile; under the tear line, whether it holds today and "Mở mã".
 * Validity is always the server's answer from this fetch (BR-39): the time it was checked shows.
 */
function PermitPass({ row }: { row: NonNullable<ReturnType<typeof useCurrentPermit>['row']> }) {
  const { contract, permit, at } = row;
  const valid = permit!.effectiveStatus === 'VALID';
  const { label, tone } = statusLabel(permit!.effectiveStatus);
  const days = contractProgress(permit!.startDate, permit!.endDate, new Date()).daysLeft;
  return (
    <PressableScale
      onPress={() => go(`/vendor/slots/contracts/${contract.contractId}/permit`)}
      accessibilityLabel={`Giấy phép số ô ${contract.slotCode}: ${label}, còn ${days} ngày. Mở để đưa cán bộ quét`}
    >
      <Pass
        accent={valid ? colors.brand : colors.muted}
        head={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Giấy phép vỉa hè</Text>
              <Text maxFontSizeMultiplier={1.3} style={[sign.figure, { color: valid ? colors.ink : colors.muted }]}>
                {contract.slotCode}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>
                {contract.zoneName}
              </Text>
            </View>
            <View style={{ width: 76, height: 76, borderRadius: 18, borderCurve: 'continuous', backgroundColor: valid ? colors.brandTint : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="qrcode" md="qr_code_2" size={46} color={colors.ink} />
            </View>
          </View>
        }
        stub={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <StatusPill label={label} tone={tone} />
              <Text style={[text.footnote, tabular, { color: colors.muted }]}>
                {valid ? `Còn ${days} ngày` : 'Không có hiệu lực'}
                {at ? `, kiểm tra lúc ${formatVietnamTime(at).slice(0, 5)}` : ''}
              </Text>
            </View>
            <View style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.glow }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.white }}>Mở mã</Text>
            </View>
          </View>
        }
      />
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
 * V01 Trang chủ người bán, v5 "Biển hiệu phố" (screens/v5/vendor-home.md): the stall's own
 * orange signboard greets the vendor by the time of day and paints today's two figures (jobs,
 * money owed); the permit pass lies across the sign's edge, one tap from the officer's scan;
 * then a slot hold counting down, today's list, the four jobs of the day. Pull to refresh.
 */
export function VendorHomeScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const user = useAuthStore((s) => s.user);
  const regs = useRegistrations();
  const fees = useFeeItems();
  const penalties = usePenalties();
  const permit = useCurrentPermit();
  const { holds, refresh: refreshHolds } = useHolds();
  const unread = useNotificationUnreadCount();
  const chatUnread = useChatUnreadCount().data ?? 0;
  const now = useNow();
  const [expanded, setExpanded] = useState(false);

  const slotsNear = useSlotsNearApproval(regs.registrations);
  const todos = buildTodos(regs.registrations, fees.feeItems, penalties.penalties, slotsNear);
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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40, gap: 26 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.cta} colors={[colors.cta]} progressViewOffset={insets.top} />}
      >
        {/* The stall's signboard: who, today's count and what is owed; the permit pass on its edge */}
        <Signboard
          top={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {hkd ? <Plate code={hkdCode(hkd.registrationId)} /> : null}
                {latest ? <StatusPill label={statusLabel(latest.registrationStatus).label} tone={statusLabel(latest.registrationStatus).tone} /> : null}
              </View>
              <AssistantButton tone="onSign" />
              <RoundButton icon={{ sf: 'bubble.left.and.bubble.right.fill', md: 'chat' }} label="Tin nhắn" badge={chatUnread || undefined} onPress={() => go('/vendor/home/chat')} />
              <RoundButton icon={{ sf: 'bell.fill', md: 'notifications' }} label="Thông báo" badge={unread || undefined} onPress={() => go('/notifications')} />
            </View>
          }
          line1={`Chào ${firstName || 'bạn'},`}
          line2={SELLING_WORD[daypart()]}
          overlap={
            permit.row ? (
              <PermitPass row={permit.row} />
            ) : permit.loading ? (
              <Skeleton height={190} radius={radius.pass} />
            ) : undefined
          }
        >
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            {/* While the board loads, the figures say so instead of a false "0". */}
            <SignFigure
              value={loadingBoard && todos.length === 0 ? '…' : String(todos.length)}
              label={loadingBoard && todos.length === 0 ? 'đang tải việc' : todos.length ? 'việc cần làm' : 'không có việc'}
            />
            <SignFigure value={loadingBoard && todos.length === 0 ? '…' : formatVnd(toPay)} label="cần trả" />
          </View>
        </Signboard>

        <View style={{ paddingHorizontal: 20, gap: 26 }}>
          {/* Slot hold counting down */}
          {liveHolds.length > 0 ? (
            <Pressable
              onPress={() => go('/vendor/slots')}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sticker : colors.mangoTint, borderWidth: 1.5, borderColor: colors.sticker })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sticker, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="timer" md="timer" size={22} color={colors.plate} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 15.5, color: colors.onMango }}>Đang giữ chỗ {liveHolds.length} ô</Text>
                <Text style={[{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.onMango }, tabular]}>Còn {formatCountdown(soonest)} để nộp đơn</Text>
              </View>
              <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.onMango} />
            </Pressable>
          ) : null}

          {/* Today's list */}
          {loadingBoard && todos.length === 0 ? (
            <Skeleton height={220} radius={radius.card} />
          ) : todos.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
                <Icon sf="checkmark" md="check" size={22} color={colors.white} weight="bold" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.onLeaf }}>Không có việc cần xử lý</Text>
                <Text style={[text.footnote, { color: colors.onLeaf }]}>Phí, biên bản và yêu cầu bổ sung hồ sơ sẽ hiện ở đây.</Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>Việc cần làm</Text>
              <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
                {(expanded ? todos : todos.slice(0, VISIBLE)).map((t, i) => (
                  <View key={t.key} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.separator, marginLeft: i === 0 ? 0 : 0 }}>
                    <TodoTicket todo={t} />
                  </View>
                ))}
                {todos.length > VISIBLE ? (
                  <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: colors.separator, backgroundColor: pressed ? colors.brandTint : colors.kerbPaint })}>
                    <Text style={[{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary }, tabular]}>
                      {expanded ? 'Thu gọn' : `Xem thêm ${todos.length - VISIBLE} việc`}
                    </Text>
                    <Icon sf={expanded ? 'chevron.up' : 'chevron.down'} md={expanded ? 'expand_less' : 'expand_more'} size={14} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

          {/* No registration yet: the way in */}
          {!regs.isLoading && regs.registrations.length === 0 ? (
            <View style={{ padding: 20, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink }}>Chưa có hồ sơ đăng ký</Text>
                <Text style={[text.callout, { color: colors.muted }]}>Đăng ký kinh doanh để bắt đầu thuê ô vỉa hè hợp pháp.</Text>
              </View>
              {['Nộp hồ sơ hộ kinh doanh', 'Phường duyệt, cấp mã HKD', 'Thuê ô, nhận giấy phép QR'].map((s, i) => (
                <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: i === 0 ? colors.cta : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.heavy, fontSize: 13.5, color: i === 0 ? colors.white : colors.muted }}>{i + 1}</Text>
                  </View>
                  <Text style={[text.callout, { color: colors.ink }]}>{s}</Text>
                </View>
              ))}
              <Button label="Nói để đăng ký" icon={{ sf: 'mic.fill', md: 'mic' }} onPress={() => go('/register-business/voice')} />
              <Button label="Tự điền từng bước" variant="secondary" onPress={() => go('/register-business')} />
              <Pressable onPress={() => go('/vendor/home/onboarding')} hitSlop={8} accessibilityRole="link" style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.primary }}>Xem các bước bắt đầu</Text>
              </Pressable>
            </View>
          ) : null}

          {/* The four jobs of the day */}
          <View style={{ gap: 14 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>Lối tắt</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {SHORTCUTS.map((s) => (
                <PressableScale
                  key={s.href}
                  onPress={() => go(s.href)}
                  accessibilityLabel={`${s.label}. ${s.note}`}
                  style={{ width: '47.5%', flexGrow: 1, padding: 16, gap: 12, minHeight: 132, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: s.warm ? colors.cta : colors.card, boxShadow: s.warm ? shadow.glow : shadow.card }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: s.warm ? 'rgba(255,255,255,0.24)' : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={s.icon.sf} md={s.icon.md} size={22} color={s.warm ? colors.white : colors.primary} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 21, color: s.warm ? colors.white : colors.ink }}>{s.label}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: s.warm ? colors.white : colors.muted }}>{s.note}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>

          <Pressable onPress={() => go('/vendor/home/onboarding')} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.signTint : colors.card, boxShadow: shadow.card })}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="map.fill" md="map" size={20} color={colors.sign} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink }}>Hướng dẫn 6 bước lên phố</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>Từ tạo tài khoản tới mở gian hàng</Text>
            </View>
            <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/** A figure painted on the signboard: white Archivo number, its words under it. */
function SignFigure({ value, label }: { value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.18)', gap: 2 }}>
      <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { color: colors.white }, tabular]}>
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.white }}>{label}</Text>
    </View>
  );
}
