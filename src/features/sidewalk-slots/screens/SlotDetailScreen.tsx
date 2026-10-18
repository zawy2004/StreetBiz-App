import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap } from '@/components/map/LeafletMap';
import { apiAssetUrl } from '@/core/api/asset-url';
import { sideApi, SideApiError, type FeeQuoteLine, type SidewalkSlot, type SidewalkZone } from '@/core/api/side-api';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { LEGAL_ROUTES, SLOT_COMMITMENTS } from '@/features/legal/legal-content';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { AmenityRow, EligibilityMissing, EligibilityOk, RentFigure, SlotStateChip } from '../components/SlotParts';
import { HoldRing } from '../components/HoldRing';
import { HOLD_WARNING_SECONDS } from '../plan-labels';
import { formatAreaSqm, formatCountdown, formatHours, formatShortVnd, formatSize, hkdCode, secondsUntil } from '../slot-format';
import { BUSINESS_CATEGORY_LABELS, slotDisplayState } from '../slot-stats';
import { SLOT_STATE } from '../slot-tones';
import { useHolds } from '../useHolds';
import { useDebouncedValue, useNow } from '../useNow';

const TERM_MONTHS = [1, 3, 6, 12] as const;
const MONTH_DAYS = 30;
const MAX_TERM_DAYS = 365;

function quoteLineLabel(line: FeeQuoteLine, termDays: number): string {
  switch (line.kind) {
    case 'RENT':
      return line.calcBasis === 'PER_MONTH'
        ? `Tiền thuê ô (${formatShortVnd(line.unitAmount)}/tháng × ${line.quantity} tháng)`
        : `Tiền thuê ô (${formatShortVnd(line.unitAmount)}/ngày × ${line.quantity} ngày)`;
    case 'DISCOUNT':
      return line.label ?? 'Giảm giá';
    case 'DEPOSIT':
      return `${line.label} (hoàn lại khi kết thúc)`;
    default:
      if (line.calcBasis !== 'PER_DAY') return `${line.label} (một lần)`;
      return termDays % MONTH_DAYS === 0
        ? `${line.label} (${formatShortVnd(line.unitAmount * MONTH_DAYS)}/tháng × ${termDays / MONTH_DAYS} tháng)`
        : `${line.label} (${formatShortVnd(line.unitAmount)}/ngày × ${line.quantity} ngày)`;
  }
}

/**
 * V12 Chi tiết ô (SIDE-02/03A): the slot's photos, size, hours and utilities, where it is,
 * who at the ward to call, and the rental counter: term, live quote, the two commitments,
 * a 15-minute hold and the application. Everything is decided by the server (BR-16 eligibility,
 * the hold, the price); the screen only shows it.
 */
export function SlotDetailScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const id = Number(slotId);
  const userId = useAuthStore((s) => s.user?.id);
  const slot = useQuery({
    queryKey: ['side', userId, 'slot', id],
    queryFn: () => sideApi.getSlot(id),
    enabled: Number.isFinite(id),
  });
  const zone = useQuery({
    queryKey: ['side', userId, 'zone', slot.data?.zoneId],
    queryFn: () => sideApi.getZone(slot.data!.zoneId),
    enabled: !!slot.data,
  });

  if (!Number.isFinite(id)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Chi tiết ô' }} />
        <ErrorState error={new Error('Mã ô không hợp lệ.')} />
      </Screen>
    );
  }
  if (slot.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Chi tiết ô' }} />
        <ListSkeleton rows={1} height={220} />
        <ListSkeleton rows={2} height={90} />
      </Screen>
    );
  }
  if (slot.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Chi tiết ô' }} />
        <ErrorState error={slot.error} onRetry={() => void slot.refetch()} />
      </Screen>
    );
  }
  return <SlotDetail slot={slot.data} zone={zone.data} onRefresh={() => void Promise.all([slot.refetch(), zone.refetch()])} refreshing={slot.isRefetching} />;
}

function SlotDetail({ slot, zone, onRefresh, refreshing }: { slot: SidewalkSlot; zone: SidewalkZone | undefined; onRefresh: () => void; refreshing: boolean }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { registration, holds, hold, release, refresh } = useHolds();
  const myHold = holds.find((h) => h.slotId === slot.slotId);
  const nowMs = useNow(myHold || slot.holdExpiresAt ? 1000 : 30_000);
  const state = slotDisplayState(slot, nowMs);
  const heldByOther = state === 'HELD' && !myHold;
  const canRent = state === 'AVAILABLE' || state === 'HELD';

  const isMonthly = slot.rentalMode === 'STANDARD';
  const [termDays, setTermDays] = useState(isMonthly ? String(3 * MONTH_DAYS) : '30');
  const [accepted, setAccepted] = useState(false);
  const [agreeError, setAgreeError] = useState<string>();
  // An EVENT zone's term may never outrun its event window (the backend's EventZoneBlocker).
  const eventDaysLeft =
    slot.rentalMode === 'EVENT' && slot.eventEndDate
      ? Math.max(1, Math.ceil((Date.parse(slot.eventEndDate) - nowMs) / 86_400_000) + 1)
      : null;
  const maxTermDays = eventDaysLeft ?? MAX_TERM_DAYS;
  const days = Number(termDays);
  const validDays = Number.isInteger(days) && days >= 1 && days <= maxTermDays;
  const typedDays = useDebouncedValue(days);
  const quoteDays = isMonthly ? days : typedDays;
  const discount = isMonthly ? slot.quarterDiscountPercent : null;

  // A hold lapses on its own: when the countdown reaches zero, re-read the holds and the slot.
  const holdLapsed = myHold != null && Date.parse(myHold.expiresAt) <= nowMs;
  useEffect(() => {
    if (holdLapsed) refresh();
  }, [holdLapsed, refresh]);

  const quote = useQuery({
    queryKey: ['side', userId, 'quote', slot.slotId, quoteDays],
    queryFn: () => sideApi.getSlotQuote(slot.slotId, quoteDays),
    enabled: canRent && validDays && quoteDays === days,
    placeholderData: (previous) => previous,
  });

  const apply = useMutation({
    mutationFn: () =>
      sideApi.submitOpenSlotApplication({
        registrationId: registration!.registrationId,
        slotId: slot.slotId,
        requestedTermDays: days,
        commitmentsAccepted: accepted,
      }),
    onSuccess: (result) => {
      showToast(result.message);
      refresh();
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'applications'] });
      router.replace(`/vendor/slots/rental-applications/${result.data.applicationId}` as Href);
    },
    onError: (error) => {
      showToast(error instanceof SideApiError ? error.message : 'Không gửi được đơn thuê.', 'error');
      refresh();
    },
  });

  const submit = () => {
    if (!accepted) {
      setAgreeError('Hãy đồng ý hai cam kết trước khi nộp đơn.');
      return;
    }
    apply.mutate();
  };

  const size = formatSize(slot.widthMeters, slot.lengthMeters);
  const area = formatAreaSqm(slot.widthMeters, slot.lengthMeters);
  const myHoldSeconds = myHold ? secondsUntil(myHold.expiresAt, nowMs) : 0;
  const showCounter = canRent && !!registration;

  const footer = showCounter ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {myHold ? (
        <Pressable
          onPress={() => release.mutate(slot.slotId)}
          disabled={release.isPending}
          accessibilityRole="button"
          accessibilityLabel={`Nhả chỗ, còn ${formatCountdown(myHoldSeconds)}`}
          style={({ pressed }) => ({ alignItems: 'center', gap: 2, opacity: pressed || release.isPending ? 0.6 : 1 })}
        >
          <HoldRing heldAt={myHold.heldAt} expiresAt={myHold.expiresAt} nowMs={nowMs} size={46} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted }}>Nhả chỗ</Text>
        </Pressable>
      ) : (
        <Button
          label="Giữ 15'"
          variant="secondary"
          size={56}
          icon={{ sf: 'bookmark', md: 'bookmark_border' }}
          loading={hold.isPending}
          disabled={heldByOther}
          onPress={() => hold.mutate(slot.slotId)}
          style={{ paddingHorizontal: 18 }}
          accessibilityHint="Giữ ô này cho bạn trong 15 phút"
        />
      )}
      <Button
        label="Nộp đơn thuê"
        size={56}
        icon={{ sf: 'checkmark.circle.fill', md: 'check_circle' }}
        loading={apply.isPending}
        disabled={!validDays || heldByOther}
        onPress={submit}
        style={{ flex: 1 }}
      />
    </View>
  ) : undefined;

  return (
    <Screen padded={false} gap={0} footer={footer} onRefresh={onRefresh} refreshing={refreshing}>
      <Stack.Screen options={{ title: `Ô ${slot.slotCode}` }} />
      <SlotMedia slot={slot} />
      <View style={{ padding: 16, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <SlotPlate code={slot.slotCode} />
            <SlotStateChip state={state} />
          </View>
          <Text style={[text.title2, { color: colors.ink }]} numberOfLines={2}>
            {slot.zoneName}
          </Text>
          <RentFigure slot={slot} size={22} />
          {discount != null ? (
            <Text style={[text.footnote, { color: colors.onLeaf, fontFamily: fonts.semibold }]}>Thuê từ 3 tháng giảm {discount}% tiền thuê</Text>
          ) : null}
        </View>

        <Card>
          <KeyValueList
            rows={[
              { label: 'Kích thước', value: size ? `${size}${area ? ` (${area})` : ''}` : 'Chưa đo kích thước' },
              { label: 'Giờ hoạt động', value: formatHours(slot.availableFrom, slot.availableTo) },
              { label: 'Ngành hàng', value: slot.businessCategory ? BUSINESS_CATEGORY_LABELS[slot.businessCategory] : 'Chưa phân ngành' },
              slot.tenantName ? { label: 'Hộ đang thuê', value: slot.tenantName } : null,
              { label: 'Hình thức', value: slot.rentalMode === 'EVENT' ? 'Khu sự kiện, thuê theo ngày' : 'Vị trí cố định, thuê theo tháng' },
            ]}
          />
          <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: 12 }} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.muted, marginBottom: 8 }}>HẠ TẦNG</Text>
          <AmenityRow slot={slot} />
        </Card>

        <PlaceCard slot={slot} />

        {canRent ? (
          registration ? (
            <RentalCounter
              slot={slot}
              registrationCode={hkdCode(registration.registrationId)}
              registrationName={registration.displayName ?? ''}
              isMonthly={isMonthly}
              discount={discount}
              termDays={termDays}
              setTermDays={setTermDays}
              validDays={validDays}
              days={days}
              maxTermDays={maxTermDays}
              quote={quote.data}
              quoteError={quote.error}
              accepted={accepted}
              setAccepted={(v) => {
                setAccepted(v);
                setAgreeError(undefined);
              }}
              agreeError={agreeError}
            />
          ) : (
            <EligibilityMissing />
          )
        ) : (
          <ClosedNotice state={state} />
        )}

        {heldByOther && slot.holdExpiresAt ? (
          <Banner tone="warning" icon={{ sf: 'timer', md: 'timer' }}>
            Ô đang được hộ khác giữ chỗ (còn {formatCountdown(secondsUntil(slot.holdExpiresAt, nowMs))}). Bạn có thể quay lại sau.
          </Banner>
        ) : null}
        {myHold && myHoldSeconds <= HOLD_WARNING_SECONDS ? (
          <Banner tone="danger" icon={{ sf: 'timer', md: 'timer' }}>
            Sắp hết giữ chỗ. Nộp đơn ngay để không mất ô.
          </Banner>
        ) : null}

        {zone?.contactName ? <WardContact zone={zone} /> : null}
      </View>
    </Screen>
  );
}

/** The slot's photos as a swipeable strip, or the bay drawn in its state colour when there are none. */
function SlotMedia({ slot }: { slot: SidewalkSlot }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const height = Math.round(width * 0.62);
  if (slot.imageUrls.length === 0) {
    return (
      <View style={{ height: height * 0.7, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <View style={{ width: 120, height: 84, borderRadius: 12, borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
          <Text style={{ fontFamily: fonts.code, fontSize: 24, color: colors.ink }}>{slot.slotCode}</Text>
          {formatSize(slot.widthMeters, slot.lengthMeters) ? (
            <Text style={[text.caption, { color: colors.muted }, tabular]}>{formatSize(slot.widthMeters, slot.lengthMeters)}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon sf="camera" md="photo_camera" size={13} color={colors.muted} />
          <Text style={[text.caption, { color: colors.muted }]}>Phường chưa thêm ảnh ô này</Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {slot.imageUrls.map((url, i) => (
          <Image
            key={url}
            source={{ uri: apiAssetUrl(url) }}
            style={{ width, height }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`Ảnh ô ${slot.slotCode}, ${i + 1} trên ${slot.imageUrls.length}`}
          />
        ))}
      </ScrollView>
      {slot.imageUrls.length > 1 ? (
        <View style={{ position: 'absolute', right: 12, bottom: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(17, 28, 43, 0.62)' }}>
          <Text style={[{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }, tabular]}>
            {page + 1}/{slot.imageUrls.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Where the slot is: a still map and a way to the phone's own map app. */
function PlaceCard({ slot }: { slot: SidewalkSlot }) {
  const t = SLOT_STATE.AVAILABLE;
  const markers = useMemo(
    () => [{ id: String(slot.slotId), latitude: slot.latitude, longitude: slot.longitude, label: slot.slotCode, fill: colors.cta, ink: colors.white, selected: false }],
    [slot.slotId, slot.latitude, slot.longitude, slot.slotCode],
  );
  const openMaps = () => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${slot.latitude},${slot.longitude}`);
  return (
    <Card padded={false}>
      <LeafletMap center={[slot.latitude, slot.longitude]} zoom={18} markers={markers} interactive={false} style={{ height: 150 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.wash, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="mappin.and.ellipse" md="location_on" size={18} color={t.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>{slot.zoneName}</Text>
          <Text style={[text.caption, { color: colors.muted }, tabular]}>
            {slot.latitude.toFixed(5)}, {slot.longitude.toFixed(5)}
          </Text>
        </View>
        <Pressable
          onPress={openMaps}
          accessibilityRole="link"
          accessibilityLabel="Chỉ đường đến ô bằng ứng dụng bản đồ"
          hitSlop={6}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: pressed ? colors.brandTint : colors.kerbPaint, borderWidth: 1, borderColor: colors.brandTint })}
        >
          <Icon sf="arrow.triangle.turn.up.right.diamond.fill" md="directions" size={15} color={colors.primary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>Chỉ đường</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function ClosedNotice({ state }: { state: ReturnType<typeof slotDisplayState> }) {
  const t = SLOT_STATE[state];
  const words = state === 'ACTIVE' ? 'Ô này đã có người thuê.' : state === 'PENDING' ? 'Ô này đang có đơn chờ phường duyệt.' : 'Ô này đang tạm ngưng cho thuê.';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: t.wash }}>
      <Icon sf={t.icon.sf} md={t.icon.md} size={22} color={t.ink} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[text.callout, { color: t.ink, fontFamily: fonts.semibold }]}>{words}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Chọn ô khác</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RentalCounter(props: {
  slot: SidewalkSlot;
  registrationCode: string;
  registrationName: string;
  isMonthly: boolean;
  discount: number | null;
  termDays: string;
  setTermDays: (v: string) => void;
  validDays: boolean;
  days: number;
  maxTermDays: number;
  quote: import('@/core/api/side-api').FeeQuote | undefined;
  quoteError: Error | null;
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  agreeError?: string;
}) {
  const { slot, isMonthly, discount, termDays, setTermDays, validDays, days, maxTermDays, quote, quoteError } = props;
  return (
    <View style={{ gap: 14 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink }}>
        Thuê ô này
      </Text>
      <EligibilityOk code={props.registrationCode} name={props.registrationName} />

      {isMonthly ? (
        <View style={{ gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Thời hạn thuê</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TERM_MONTHS.map((months) => {
              const on = days === months * MONTH_DAYS;
              const discounted = discount != null && months % 3 === 0;
              return (
                <Pressable
                  key={months}
                  onPress={() => setTermDays(String(months * MONTH_DAYS))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${months} tháng${discounted ? `, giảm ${discount}%` : ''}`}
                  style={{
                    flex: 1,
                    minHeight: 56,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    backgroundColor: on ? colors.brandTint : colors.card,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? colors.cta : colors.line,
                  }}
                >
                  <Text style={{ fontFamily: on ? fonts.heavy : fonts.semibold, fontSize: 15, color: on ? colors.primary : colors.ink }}>{months} tháng</Text>
                  {discounted ? (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onLeaf }}>-{discount}%</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <TextField
          label="Số ngày thuê"
          value={termDays}
          onChangeText={(v) => setTermDays(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          error={validDays ? undefined : `Nhập từ 1 đến ${maxTermDays} ngày.`}
          hint={slot.eventEndDate ? `Khu sự kiện: thuê được đến hết ngày ${new Date(slot.eventEndDate).toLocaleDateString('vi-VN')}.` : undefined}
        />
      )}

      <Card style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.muted }}>BÁO GIÁ TẠM TÍNH</Text>
        {!validDays ? (
          <Text style={[text.footnote, { color: colors.onDanger }]}>{isMonthly ? 'Chọn thời hạn thuê.' : `Nhập 1 – ${maxTermDays} ngày.`}</Text>
        ) : quoteError ? (
          <Text style={[text.footnote, { color: colors.onDanger }]}>{quoteError instanceof SideApiError ? quoteError.message : 'Không tính được báo giá.'}</Text>
        ) : quote ? (
          <>
            {quote.lines.map((line, i) => (
              <View key={`${line.kind}-${i}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Text style={[text.footnote, { flex: 1, color: line.kind === 'DISCOUNT' ? colors.onLeaf : colors.ink, fontFamily: line.kind === 'DISCOUNT' ? fonts.semibold : fonts.regular }]}>
                  {quoteLineLabel(line, quote.termDays)}
                </Text>
                <Text style={[text.footnote, { color: line.kind === 'DISCOUNT' ? colors.onLeaf : colors.ink, fontFamily: fonts.semibold }, tabular]}>{formatVnd(line.amount)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.separator }} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={[text.subhead, { color: colors.ink }]}>Tạm tính</Text>
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 22, color: colors.primary }, tabular]}>{formatVnd(quote.total)}</Text>
            </View>
            <Text style={[text.caption, { color: colors.muted }]}>
              Ước tính, chốt khi Phường duyệt.{quote.deposit > 0 ? ` Gồm ${formatVnd(quote.deposit)} tiền cọc được hoàn lại.` : ''}
            </Text>
          </>
        ) : (
          <ListSkeleton rows={1} height={60} />
        )}
      </Card>

      <View style={{ gap: 8, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
        <Text style={[text.subhead, { color: colors.ink }]}>Cam kết khi thuê ô</Text>
        {SLOT_COMMITMENTS.map((c) => (
          <View key={c} style={{ flexDirection: 'row', gap: 8 }}>
            <Icon sf="checkmark.circle" md="check_circle" size={15} color={colors.leaf} style={{ marginTop: 2 }} />
            <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>{c}</Text>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: 4 }} />
        <Checkbox checked={props.accepted} onChange={props.setAccepted} error={props.agreeError}>
          <Text style={[text.footnote, { color: colors.ink }]}>
            Tôi đồng ý các cam kết trên,{' '}
            <Text style={{ color: colors.primary, fontFamily: fonts.semibold }} onPress={() => router.push(LEGAL_ROUTES.slotRules as Href)}>
              Quy định thuê ô
            </Text>{' '}
            và{' '}
            <Text style={{ color: colors.primary, fontFamily: fonts.semibold }} onPress={() => router.push(LEGAL_ROUTES.terms as Href)}>
              Điều khoản sử dụng
            </Text>
            .
          </Text>
        </Checkbox>
      </View>
    </View>
  );
}

function WardContact({ zone }: { zone: SidewalkZone }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.signTint }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf="headphones" md="support_agent" size={20} color={colors.sign} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[text.subhead, { color: colors.ink }]}>{zone.contactName}</Text>
        <Text style={[text.caption, { color: colors.muted }]}>
          Cán bộ {zone.wardName}
          {zone.contactPhone ? ` · ${zone.contactPhone}` : ''}
        </Text>
      </View>
      {zone.contactPhone ? (
        <Pressable
          onPress={() => void Linking.openURL(`tel:${zone.contactPhone!.replace(/\s/g, '')}`)}
          accessibilityRole="button"
          accessibilityLabel={`Gọi ${zone.contactName}`}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: pressed ? '#0A4F8C' : colors.sign, alignItems: 'center', justifyContent: 'center' })}
        >
          <Icon sf="phone.fill" md="call" size={18} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}
