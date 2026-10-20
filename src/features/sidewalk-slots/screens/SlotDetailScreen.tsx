import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
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
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
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

/** Heavy section title in the v5 rhythm. */
function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.ink }}>
      {children}
    </Text>
  );
}

/**
 * V12 Chi tiết ô (SIDE-02/03A), v5: the slot's photos full width with its street plate, large,
 * across their lower edge; the rent in sign figures; the bay drawn from above with its frontage
 * and depth; where it is, who at the ward to call; and the rental counter: term, live quote, the
 * two commitments, a 15-minute hold counting down and the application. Everything is decided by
 * the server (BR-16 eligibility, the hold, the price); the screen only shows it.
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
      <Screen padded={false} gap={0}>
        <Stack.Screen options={{ title: 'Chi tiết ô' }} />
        <Skeleton height={230} radius={0} />
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton width={150} height={62} radius={radius.plate} style={{ marginTop: -46 }} />
          <Skeleton width="70%" height={28} />
          <Skeleton width="45%" height={34} />
          <ListSkeleton rows={2} height={110} />
        </View>
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

  const myHoldSeconds = myHold ? secondsUntil(myHold.expiresAt, nowMs) : 0;
  const showCounter = canRent && !!registration;

  const footer = showCounter ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {myHold ? (
        <Pressable
          onPress={() => release.mutate(slot.slotId)}
          disabled={release.isPending}
          accessibilityRole="button"
          accessibilityLabel={`Nhả chỗ, còn ${formatCountdown(myHoldSeconds)}`}
          style={({ pressed }) => ({ alignItems: 'center', gap: 2, minWidth: 56, opacity: pressed || release.isPending ? 0.6 : 1 })}
        >
          <HoldRing heldAt={myHold.heldAt} expiresAt={myHold.expiresAt} nowMs={nowMs} size={50} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.muted }}>Nhả chỗ</Text>
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

      {/* The street plate, large, across the photo's lower edge: the slot's name on the street */}
      <View style={{ marginTop: -38, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <BigPlate code={slot.slotCode} />
        <View style={{ paddingBottom: 6 }}>
          <SlotStateChip state={state} />
        </View>
      </View>

      <View style={{ padding: 16, paddingTop: 14, gap: 26 }}>
        <View style={{ gap: 6 }}>
          <Text style={[text.title2, { color: colors.ink }]} numberOfLines={2}>
            {slot.zoneName}
          </Text>
          <RentFigure slot={slot} size={26} />
          {discount != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sticker, backgroundColor: colors.sticker, transform: [{ rotate: '-3deg' }] }}>
                <Text style={[sign.price, { fontSize: 15, lineHeight: 19, color: colors.plate }, tabular]}>-{discount}%</Text>
              </View>
              <Text style={[text.footnote, { color: colors.onLeaf, fontFamily: fonts.semibold }]}>Thuê từ 3 tháng giảm {discount}% tiền thuê</Text>
            </View>
          ) : null}
        </View>

        {myHold ? <HoldTicket seconds={myHoldSeconds} /> : null}
        {heldByOther && slot.holdExpiresAt ? (
          <Banner tone="warning" icon={{ sf: 'timer', md: 'timer' }}>
            Ô đang được hộ khác giữ chỗ (còn {formatCountdown(secondsUntil(slot.holdExpiresAt, nowMs))}). Bạn có thể quay lại sau.
          </Banner>
        ) : null}

        <BayPlan slot={slot} />

        <Card>
          <KeyValueList
            rows={[
              { label: 'Giờ hoạt động', value: formatHours(slot.availableFrom, slot.availableTo) },
              { label: 'Ngành hàng', value: slot.businessCategory ? BUSINESS_CATEGORY_LABELS[slot.businessCategory] : 'Chưa phân ngành' },
              slot.tenantName ? { label: 'Hộ đang thuê', value: slot.tenantName } : null,
              { label: 'Hình thức', value: slot.rentalMode === 'EVENT' ? 'Khu sự kiện, thuê theo ngày' : 'Vị trí cố định, thuê theo tháng' },
            ]}
          />
          <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: 12 }} />
          <Text style={[text.subhead, { color: colors.ink, marginBottom: 10 }]}>Hạ tầng</Text>
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

        {zone?.contactName ? <WardContact zone={zone} /> : null}
      </View>
    </Screen>
  );
}

/** The slot's street plate at full size: ink, white rim, the code in sign figures. */
function BigPlate({ code }: { code: string }) {
  return (
    <View
      accessibilityLabel={`Ô ${code}`}
      style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingVertical: 4, minHeight: 66, borderRadius: radius.plate, backgroundColor: colors.plate, borderWidth: 3, borderColor: colors.white, boxShadow: shadow.raised }}
    >
      <Text maxFontSizeMultiplier={1.2} style={[sign.price, { color: colors.white, opacity: 0.8 }]}>Ô</Text>
      <Text maxFontSizeMultiplier={1.2} style={[sign.figure, { color: colors.white, letterSpacing: 1 }, tabular]}>
        {code}
      </Text>
    </View>
  );
}

/**
 * The hold the vendor has on this slot, as a mango ticket with the time left in big figures.
 * Under two minutes it turns red and says so (the same words the warning used to say).
 */
function HoldTicket({ seconds }: { seconds: number }) {
  const ending = seconds <= HOLD_WARNING_SECONDS;
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={ending ? `Sắp hết giữ chỗ, còn ${formatCountdown(seconds)}. Nộp đơn ngay để không mất ô.` : `Bạn đang giữ ô này, còn ${formatCountdown(seconds)} để nộp đơn.`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: ending ? colors.dangerTint : colors.mangoTint, borderWidth: 1.5, borderColor: ending ? colors.danger : colors.sticker }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: ending ? colors.danger : colors.sticker, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
        <Icon sf="timer" md="timer" size={22} color={ending ? colors.white : colors.plate} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 22, color: ending ? colors.onDanger : colors.onMango }}>
          {ending ? 'Sắp hết giữ chỗ' : 'Bạn đang giữ ô này'}
        </Text>
        <Text style={[text.footnote, { color: ending ? colors.onDanger : colors.onMango }]}>
          {ending ? 'Nộp đơn ngay để không mất ô.' : 'Nộp đơn trước khi hết giờ giữ chỗ.'}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1.3} style={[sign.title, { color: ending ? colors.onDanger : colors.plate }, tabular]}>
        {formatCountdown(seconds)}
      </Text>
    </View>
  );
}

/**
 * The bay seen from above, drawn to its proportions: the frontage along the painted kerb, the
 * depth up to the building line, the area in sign figures. Unmeasured slots say so, never guess.
 */
function BayPlan({ slot }: { slot: SidewalkSlot }) {
  const size = formatSize(slot.widthMeters, slot.lengthMeters);
  const area = formatAreaSqm(slot.widthMeters, slot.lengthMeters);
  const w = slot.widthMeters;
  const l = slot.lengthMeters;
  const scale = w != null && l != null ? Math.min(120 / Math.max(w, 0.1), 84 / Math.max(l, 0.1)) : 0;
  const bayW = w != null && l != null ? Math.max(48, w * scale) : 96;
  const bayH = w != null && l != null ? Math.max(40, l * scale) : 64;
  const metres = (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m`;
  return (
    <View style={{ gap: 14 }}>
      <Heading>Kích thước ô</Heading>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, overflow: 'hidden' }}>
        <View accessible accessibilityLabel={size ? `Mặt tiền ${metres(w!)}, sâu ${metres(l!)}` : 'Chưa đo kích thước'} style={{ width: 168, backgroundColor: colors.kerbPaint }}>
          <View style={{ height: 8, backgroundColor: colors.line }} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 14, paddingBottom: 6, gap: 4 }}>
            <View style={{ width: bayW, height: bayH, borderRadius: radius.plate, borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.cta, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text maxFontSizeMultiplier={1.2} style={[sign.plate, { color: colors.primary }]}>{slot.slotCode}</Text>
            </View>
            {w != null ? <Text style={[text.caption, tabular, { color: colors.ink }]}>mặt tiền {metres(w)}</Text> : null}
          </View>
          <KerbStrip height={7} segment={14} />
          <View style={{ height: 18, backgroundColor: colors.line }} />
        </View>
        <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 6 }}>
          {size ? (
            <>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { color: colors.ink }, tabular]}>
                {area}
              </Text>
              <Text style={[text.footnote, { color: colors.muted }]}>Diện tích</Text>
              <Text style={[text.subhead, tabular, { color: colors.ink }]}>{size}</Text>
              {l != null ? <Text style={[text.caption, tabular, { color: colors.muted }]}>sâu {metres(l)}</Text> : null}
            </>
          ) : (
            <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Chưa đo kích thước</Text>
          )}
        </View>
      </View>
    </View>
  );
}

/** The slot's photos as a swipeable strip, or the bay drawn on the pavement when there are none. */
function SlotMedia({ slot }: { slot: SidewalkSlot }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const height = Math.round(width * 0.62);
  if (slot.imageUrls.length === 0) {
    const size = formatSize(slot.widthMeters, slot.lengthMeters);
    return (
      <View style={{ minHeight: Math.round(height * 0.78), backgroundColor: colors.kerbPaint }}>
        <View style={{ height: 14, backgroundColor: colors.line }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 }}>
          <View style={{ minWidth: 150, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.plate, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.cta, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandTint }}>
            <Text maxFontSizeMultiplier={1.3} style={[sign.title, { color: colors.primary }]}>{slot.slotCode}</Text>
            {size ? <Text style={[text.caption, { color: colors.primary }, tabular]}>{size}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 26 }}>
            <Icon sf="camera" md="photo_camera" size={13} color={colors.muted} />
            <Text style={[text.caption, { color: colors.muted }]}>Phường chưa thêm ảnh ô này</Text>
          </View>
        </View>
        <KerbStrip height={9} segment={24} />
        <View style={{ height: 22, backgroundColor: colors.line }} />
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
        <View style={{ position: 'absolute', right: 12, top: 12, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(17, 28, 43, 0.62)' }}>
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
  const markers = useMemo(
    () => [{ id: String(slot.slotId), latitude: slot.latitude, longitude: slot.longitude, label: slot.slotCode, fill: colors.cta, ink: colors.white, selected: false }],
    [slot.slotId, slot.latitude, slot.longitude, slot.slotCode],
  );
  const openMaps = () => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${slot.latitude},${slot.longitude}`);
  return (
    <View style={{ gap: 14 }}>
      <Heading>Vị trí</Heading>
      <Card padded={false}>
        <LeafletMap center={[slot.latitude, slot.longitude]} zoom={18} markers={markers} interactive={false} style={{ height: 160 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.subhead, { color: colors.ink }]}>{slot.zoneName}</Text>
            <Text style={[text.caption, { color: colors.muted }, tabular]}>
              {slot.latitude.toFixed(5)}, {slot.longitude.toFixed(5)}
            </Text>
          </View>
          <Pressable
            onPress={openMaps}
            accessibilityRole="link"
            accessibilityLabel="Chỉ đường đến ô bằng ứng dụng bản đồ"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: pressed ? colors.brandTint : colors.kerbPaint, borderWidth: 1.5, borderColor: colors.brandTint })}
          >
            <Icon sf="arrow.triangle.turn.up.right.diamond.fill" md="directions" size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: colors.primary }}>Chỉ đường</Text>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

function ClosedNotice({ state }: { state: ReturnType<typeof slotDisplayState> }) {
  const t = SLOT_STATE[state];
  const words = state === 'ACTIVE' ? 'Ô này đã có người thuê.' : state === 'PENDING' ? 'Ô này đang có đơn chờ phường duyệt.' : 'Ô này đang tạm ngưng cho thuê.';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: t.wash }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.swatch, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
        <Icon sf={t.icon.sf} md={t.icon.md} size={21} color={t.onSwatch} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 22, color: t.ink }}>{words}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.primary }}>Chọn ô khác</Text>
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
      <Heading>Thuê ô này</Heading>
      <EligibilityOk code={props.registrationCode} name={props.registrationName} />

      {isMonthly ? (
        <View style={{ gap: 10 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Thời hạn thuê</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
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
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 72,
                    paddingVertical: 8,
                    borderRadius: radius.control,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? colors.cta : pressed ? colors.brandTint : colors.card,
                    boxShadow: on ? shadow.glow : shadow.card,
                  })}
                >
                  <Text maxFontSizeMultiplier={1.3} style={[sign.title, { fontSize: 28, lineHeight: 34, color: on ? colors.white : colors.ink }, tabular]}>
                    {months}
                  </Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.white : colors.muted }}>tháng</Text>
                  {discounted ? (
                    <View style={{ position: 'absolute', top: -8, right: -4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sticker, backgroundColor: colors.sticker, transform: [{ rotate: '6deg' }] }}>
                      <Text style={[{ fontFamily: fonts.code, fontSize: 12, color: colors.plate }, tabular]}>-{discount}%</Text>
                    </View>
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

      {/* The quote as a counter slip: lines, a torn rule, the total in sign figures */}
      <View style={{ padding: 18, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Báo giá tạm tính</Text>
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
            <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.line, marginVertical: 2 }} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <Text style={[text.subhead, { color: colors.ink }]}>Tạm tính</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { fontSize: 30, lineHeight: 38, color: colors.primary, flexShrink: 1 }, tabular]}>
                {formatVnd(quote.total)}
              </Text>
            </View>
            <Text style={[text.caption, { color: colors.muted }]}>
              Ước tính, chốt khi Phường duyệt.{quote.deposit > 0 ? ` Gồm ${formatVnd(quote.deposit)} tiền cọc được hoàn lại.` : ''}
            </Text>
          </>
        ) : (
          <View style={{ gap: 8 }}>
            <Skeleton height={16} />
            <Skeleton width="70%" height={16} />
            <Skeleton width="50%" height={30} style={{ alignSelf: 'flex-end' }} />
          </View>
        )}
      </View>

      <View style={{ gap: 10, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Cam kết khi thuê ô</Text>
        {SLOT_COMMITMENTS.map((c) => (
          <View key={c} style={{ flexDirection: 'row', gap: 10 }}>
            <Icon sf="checkmark.circle.fill" md="check_circle" size={17} color={colors.leaf} style={{ marginTop: 1 }} />
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.signTint }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf="headphones" md="support_agent" size={20} color={colors.sign} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.headline, { color: colors.ink }]}>{zone.contactName}</Text>
        <Text style={[text.footnote, { color: colors.muted }]}>Cán bộ {zone.wardName}</Text>
        {zone.contactPhone ? <Text style={[text.footnote, tabular, { color: colors.ink }]}>{zone.contactPhone}</Text> : null}
      </View>
      {zone.contactPhone ? (
        <Pressable
          onPress={() => void Linking.openURL(`tel:${zone.contactPhone!.replace(/\s/g, '')}`)}
          accessibilityRole="button"
          accessibilityLabel={`Gọi ${zone.contactName}`}
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sign, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          <Icon sf="phone.fill" md="call" size={19} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}
