import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { env } from '@/core/config/env';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { AiSuggestionCard } from '../components/ReviewParts';
import { formatDateVn, todayVn, toApiTime, wardConfigApi, type UpsertZoneRequest, type WardPenaltyType, type WardZone, type ZoneFeeComponentInput, type ZoneImpactPreview } from '../ward-config-api';

const go = (href: string) => router.push(href as Href);
const BASIS: Record<ZoneFeeComponentInput['calcBasis'], string> = { PER_DAY: 'Theo ngày', PER_TERM: 'Mỗi kỳ', ONE_TIME: 'Một lần', DEPOSIT: 'Tiền cọc' };
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
const validTime = (t: string) => !t || /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** A heading inside a long screen (heavy, with an optional one-line note and an action). */
function Heading({ title, note, aside }: { title: string; note?: string; aside?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
        {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
      </View>
      {aside}
    </View>
  );
}

/** A white grouped surface. */
function Group({ children, padded }: { children: ReactNode; padded?: boolean }) {
  return <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card, padding: padded ? 16 : 0, gap: padded ? 12 : 0 }}>{children}</View>;
}

/** Who changed what and when (BR-46), newest first, as a thin timeline. */
function Timeline({ rows }: { rows: { key: number; what: string; detail?: string | null; meta: string }[] }) {
  return (
    <Group padded>
      <View>
        {rows.map((r, i) => (
          <View key={r.key} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 14 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: i === 0 ? colors.sign : colors.line }} />
              {i < rows.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: i < rows.length - 1 ? 16 : 0 }}>
              <Text style={[{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: colors.ink }, tabular]}>{r.what}</Text>
              {r.detail ? <Text style={[text.footnote, tabular, { color: colors.ink }]}>{r.detail}</Text> : null}
              <Text style={[text.caption, tabular, { color: colors.muted }]}>{r.meta}</Text>
            </View>
          </View>
        ))}
      </View>
    </Group>
  );
}

/**
 * A legal fine bracket as a ruler: the minimum and maximum at its ends and the rate applied
 * (the bracket's midpoint) as a marker on it. Decorative geometry; the words carry the figures.
 */
function BracketRuler({ min, max, value }: { min: number; max: number; value: number }) {
  const at = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
  return (
    <View accessible accessibilityLabel={`Khung ${formatVnd(min)} đến ${formatVnd(max)}, áp dụng ${formatVnd(value)}`} style={{ gap: 6 }}>
      <View style={{ height: 22, justifyContent: 'center' }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.brandTint }} />
        <View style={{ position: 'absolute', left: 0, width: 4, height: 18, borderRadius: 2, backgroundColor: colors.primary }} />
        <View style={{ position: 'absolute', right: 0, width: 4, height: 18, borderRadius: 2, backgroundColor: colors.primary }} />
        <View style={{ position: 'absolute', left: `${at * 100}%`, marginLeft: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.cta, borderWidth: 3, borderColor: colors.white, boxShadow: shadow.glow }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={[text.caption, tabular, { color: colors.muted }]}>{formatVnd(min)}</Text>
        <Text style={[text.caption, tabular, { color: colors.muted }]}>{formatVnd(max)}</Text>
      </View>
    </View>
  );
}

/**
 * W22 Biểu giá theo tuyến (WARD-02), v5 (screens/v5/ward-ops.md): the ward's compliance
 * thresholds as two painted figures, then each route as a price board — its code plate, the rent
 * in sign figures, how full it is, its hours and fees — standing on the painted kerb.
 */
export function PricingZonesScreen() {
  const zones = useQuery({ queryKey: ['ward', 'zones'], queryFn: wardConfigApi.listZones });
  return (
    <Screen onRefresh={() => void zones.refetch()} refreshing={zones.isRefetching} gap={14} footer={<Button label="Thêm tuyến" variant="sign" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={() => go('/ward/more/zones/new')} />}>
      <Stack.Screen options={{ title: 'Biểu giá thuê' }} />
      <CompliancePolicyCard />
      <Heading title={zones.data ? `Tuyến vỉa hè (${zones.data.length})` : 'Tuyến vỉa hè'} note="Giá thuê, giờ bán và các khoản phí của từng tuyến." />
      {zones.isPending ? (
        <View style={{ gap: 14 }}>
          <Skeleton height={190} radius={radius.card} />
          <Skeleton height={190} radius={radius.card} />
        </View>
      ) : zones.isError ? (
        <ErrorState error={zones.error} onRetry={() => void zones.refetch()} />
      ) : zones.data.length === 0 ? (
        <StateView icon={{ sf: 'signpost.right', md: 'signpost' }} title="Chưa có tuyến nào" body="Thêm tuyến vỉa hè và giá thuê để mở cho hộ kinh doanh đăng ký." action={{ label: 'Thêm tuyến', onPress: () => go('/ward/more/zones/new') }} />
      ) : (
        zones.data.map((z) => <ZoneBoard key={z.zoneId} zone={z} />)
      )}
    </Screen>
  );
}

/** One route as a price board: code plate and mode, name, rent in sign figures, occupancy, hours and fees. */
function ZoneBoard({ zone: z }: { zone: WardZone }) {
  const monthly = z.priceDisplayUnit === 'MONTH' && z.pricePerMonth != null;
  const occupancy = z.slotCount ? z.activeSlotCount / z.slotCount : 0;
  return (
    <Pressable
      onPress={() => go(`/ward/more/zones/${z.zoneId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${z.zoneName}, ${monthly ? `${formatVnd(z.pricePerMonth!)} một tháng` : `${formatVnd(z.pricePerDay)} một ngày`}, ${z.activeSlotCount} trên ${z.slotCount} ô đang thuê`}
      style={({ pressed }) => ({ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: pressed ? colors.kerbPaint : colors.card, boxShadow: shadow.card })}
    >
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {z.zoneCode ? <Plate code={z.zoneCode} /> : null}
          <View style={{ flex: 1 }} />
          <StatusPill label={z.rentalMode === 'EVENT' ? 'Sự kiện' : 'Cố định'} tone={z.rentalMode === 'EVENT' ? 'pending' : 'neutral'} />
          <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
        </View>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>{z.zoneName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 6 }}>
          <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: colors.primary }]}>{formatVnd(monthly ? z.pricePerMonth! : z.pricePerDay)}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 30, color: colors.primary }}>{monthly ? '/tháng' : '/ngày'}</Text>
        </View>
        {z.quarterDiscountPercent ? (
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.leafTint }}>
            <Icon sf="arrow.down.circle.fill" md="arrow_circle_down" size={13} color={colors.onLeaf} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.onLeaf }}>{`Giảm ${z.quarterDiscountPercent}% từ 3 tháng`}</Text>
          </View>
        ) : null}
        <View style={{ gap: 6 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sunken, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(occupancy * 100)}%`, height: 8, borderRadius: 4, backgroundColor: colors.brand }} />
          </View>
          <Text style={[text.footnote, tabular, { color: colors.ink }]}>{`${z.activeSlotCount}/${z.slotCount} ô đang thuê`}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon sf="clock.fill" md="schedule" size={14} color={colors.muted} />
            <Text style={[text.footnote, tabular, { color: colors.muted }]}>{z.availableFrom ? `${hhmm(z.availableFrom)}–${hhmm(z.availableTo)}` : 'Cả ngày'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon sf="list.bullet.rectangle.fill" md="receipt_long" size={14} color={colors.muted} />
            <Text style={[text.footnote, tabular, { color: colors.muted }]}>{`${z.feeComponents.length} khoản phí`}</Text>
          </View>
        </View>
      </View>
      <KerbStrip height={6} segment={20} />
    </Pressable>
  );
}

/** Phase A: the ward opts in to an advisory "consider revoking" flag and an overdue-penalty reminder. */
function CompliancePolicyCard() {
  const cache = useQueryClient();
  const policy = useQuery({ queryKey: ['ward', 'compliance-policy'], queryFn: wardConfigApi.getCompliancePolicy });
  const [edit, setEdit] = useState<{ count: string; window: string; grace: string } | null>(null);
  const save = useMutation({
    mutationFn: () => wardConfigApi.upsertCompliancePolicy({ violationThresholdCount: edit!.count ? Number(edit!.count) : null, violationWindowDays: edit!.window ? Number(edit!.window) : null, unpaidPenaltyGraceDays: edit!.grace ? Number(edit!.grace) : null }),
    onSuccess: (p) => {
      cache.setQueryData(['ward', 'compliance-policy'], p);
      setEdit(null);
      showToast('Đã lưu ngưỡng tuân thủ');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const p = policy.data;
  if (!p) return null;
  return (
    <Group padded>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="gauge.with.dots.needle.67percent" md="speed" size={19} color={colors.sign} />
        </View>
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Ngưỡng tuân thủ</Text>
        {!edit ? (
          <Pressable onPress={() => setEdit({ count: p.violationThresholdCount?.toString() ?? '', window: p.violationWindowDays?.toString() ?? '', grace: p.unpaidPenaltyGraceDays?.toString() ?? '' })} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.sign }}>Sửa</Text>
          </Pressable>
        ) : null}
      </View>
      {edit ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField label="Số vi phạm" optional value={edit.count} onChangeText={(v) => setEdit({ ...edit, count: v.replace(/\D/g, '') })} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Trong (ngày)" optional value={edit.window} onChangeText={(v) => setEdit({ ...edit, window: v.replace(/\D/g, '') })} keyboardType="number-pad" />
            </View>
          </View>
          <TextField label="Nhắc phạt quá hạn sau (ngày)" optional value={edit.grace} onChangeText={(v) => setEdit({ ...edit, grace: v.replace(/\D/g, '') })} keyboardType="number-pad" hint="Để trống để tắt tính năng" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Huỷ" variant="secondary" onPress={() => setEdit(null)} style={{ flex: 1 }} />
            <Button label="Lưu" variant="sign" loading={save.isPending} onPress={() => save.mutate()} style={{ flex: 1.4 }} />
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, padding: 12, gap: 2, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: p.violationThresholdCount ? colors.signTint : colors.sunken }}>
              <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: p.violationThresholdCount ? colors.sign : colors.muted }]}>{p.violationThresholdCount ?? 'Tắt'}</Text>
              <Text style={[text.footnote, { color: colors.ink }]}>{p.violationThresholdCount ? `vi phạm đã xử phạt trong ${p.violationWindowDays ?? '—'} ngày thì gợi ý xem xét thu hồi` : 'Chưa bật ngưỡng vi phạm.'}</Text>
            </View>
            <View style={{ flex: 1, padding: 12, gap: 2, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: p.unpaidPenaltyGraceDays ? colors.signTint : colors.sunken }}>
              <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: p.unpaidPenaltyGraceDays ? colors.sign : colors.muted }]}>{p.unpaidPenaltyGraceDays ?? 'Tắt'}</Text>
              <Text style={[text.footnote, { color: colors.ink }]}>{p.unpaidPenaltyGraceDays ? 'ngày phạt chưa nộp thì nhắc' : 'Chưa bật nhắc phạt quá hạn.'}</Text>
            </View>
          </View>
          <Text style={[text.caption, { color: colors.muted }]}>Chỉ để cảnh báo; không tự đình chỉ hay thu hồi.{p.updatedAt ? ` Sửa lần cuối ${formatVietnamDateTime(p.updatedAt)}${p.updatedByName ? ` bởi ${p.updatedByName}` : ''}.` : ''}</Text>
        </>
      )}
    </Group>
  );
}

type Draft = {
  zoneName: string;
  zoneCode: string;
  rentalMode: 'STANDARD' | 'EVENT';
  priceDisplayUnit: 'DAY' | 'MONTH';
  pricePerDay: string;
  pricePerMonth: string;
  discount: string;
  from: string;
  to: string;
  eventStartDate: string;
  eventEndDate: string;
  segmentFrom: string;
  segmentTo: string;
  applicationDeadline: string;
  regulationNumber: string;
  regulationIssuedOn: string;
  regulationIssuer: string;
  fees: { componentName: string; calcBasis: ZoneFeeComponentInput['calcBasis']; unitAmount: string }[];
};
const draftOf = (z?: WardZone): Draft => ({
  zoneName: z?.zoneName ?? '',
  zoneCode: z?.zoneCode ?? '',
  rentalMode: z?.rentalMode ?? 'STANDARD',
  priceDisplayUnit: z?.priceDisplayUnit ?? 'MONTH',
  pricePerDay: z ? String(z.pricePerDay) : '',
  pricePerMonth: z?.pricePerMonth != null ? String(z.pricePerMonth) : '',
  discount: z?.quarterDiscountPercent != null ? String(z.quarterDiscountPercent) : '',
  from: hhmm(z?.availableFrom ?? null),
  to: hhmm(z?.availableTo ?? null),
  eventStartDate: z?.eventStartDate ?? '',
  eventEndDate: z?.eventEndDate ?? '',
  segmentFrom: z?.segmentFrom ?? '',
  segmentTo: z?.segmentTo ?? '',
  applicationDeadline: z?.applicationDeadline ?? '',
  regulationNumber: '',
  regulationIssuedOn: '',
  regulationIssuer: '',
  fees: z?.feeComponents.map((c) => ({ componentName: c.componentName, calcBasis: c.calcBasis, unitAmount: String(c.unitAmount) })) ?? [],
});

/**
 * The route's price board as the officer types it: name, code and the rent in sign figures on
 * the street's orange, the painted kerb under it. It is the draft, not what vendors see yet.
 */
function PriceBoard({ name, code, amount, unit, discount }: { name: string; code: string; amount: number; unit: string; discount: string }) {
  return (
    <View accessible accessibilityLabel={`Bản nháp: ${name || 'Tuyến mới'}, ${amount ? `${formatVnd(amount)} ${unit}` : 'chưa có giá'}`} style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', boxShadow: shadow.glow }}>
      <View style={{ backgroundColor: colors.brand, padding: 18, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {code ? <Plate code={code} /> : null}
          <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.white }}>{name || 'Tuyến mới'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 6 }}>
          <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: colors.white }]}>{amount ? formatVnd(amount) : '— đ'}</Text>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 36, color: colors.plate }}>{unit}</Text>
        </View>
        {discount ? <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.white }}>{`Giảm ${discount}% khi thuê từ 3 tháng`}</Text> : null}
      </View>
      <KerbStrip height={8} segment={22} />
    </View>
  );
}

/** W23 Sửa tuyến: price and hours with an impact preview before saving, fees, the permitting document, history. */
export function ZoneEditScreen() {
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>();
  const isNew = zoneId === 'new';
  const cache = useQueryClient();
  const zones = useQuery({ queryKey: ['ward', 'zones'], queryFn: wardConfigApi.listZones });
  const zone = isNew ? undefined : zones.data?.find((z) => z.zoneId === Number(zoneId));
  const history = useQuery({ queryKey: ['ward', 'zone-history', zoneId], queryFn: () => wardConfigApi.zoneHistory(Number(zoneId)), enabled: Boolean(zone) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reason, setReason] = useState('');
  const [newDoc, setNewDoc] = useState(isNew);
  const [impact, setImpact] = useState<ZoneImpactPreview | null>(null);
  const d = draft ?? draftOf(zone);
  const set = (patch: Partial<Draft>) => {
    setDraft({ ...d, ...patch });
    setImpact(null);
  };
  const monthly = d.rentalMode === 'STANDARD' && d.priceDisplayUnit === 'MONTH';
  const request = (): UpsertZoneRequest => ({
    zoneName: d.zoneName.trim(),
    zoneCode: d.zoneCode.trim(),
    pricePerDay: Number(d.pricePerDay) || 0,
    priceDisplayUnit: d.rentalMode === 'EVENT' ? 'DAY' : d.priceDisplayUnit,
    pricePerMonth: monthly ? Number(d.pricePerMonth) || null : null,
    quarterDiscountPercent: d.rentalMode === 'STANDARD' && d.discount ? Number(d.discount) : null,
    rentalMode: d.rentalMode,
    eventStartDate: d.rentalMode === 'EVENT' ? d.eventStartDate || null : null,
    eventEndDate: d.rentalMode === 'EVENT' ? d.eventEndDate || null : null,
    availableFrom: toApiTime(d.from),
    availableTo: toApiTime(d.to),
    regulationNumber: newDoc ? d.regulationNumber.trim() : null,
    regulationIssuedOn: newDoc ? d.regulationIssuedOn || null : null,
    regulationIssuer: newDoc ? d.regulationIssuer.trim() : null,
    segmentFrom: d.segmentFrom.trim() || null,
    segmentTo: d.segmentTo.trim() || null,
    applicationDeadline: d.applicationDeadline || null,
    feeComponents: d.fees.map((f) => ({ componentName: f.componentName.trim(), calcBasis: f.calcBasis, unitAmount: Number(f.unitAmount) || 0 })),
    changeReason: reason.trim() || null,
    versionToken: zone?.versionToken ?? null,
  });
  const preview = useMutation({
    mutationFn: () => {
      const r = request();
      return wardConfigApi.previewZoneImpact(zone!.zoneId, r.pricePerDay, r.availableFrom, r.availableTo, r.feeComponents, { priceDisplayUnit: r.priceDisplayUnit, pricePerMonth: r.pricePerMonth, quarterDiscountPercent: r.quarterDiscountPercent });
    },
    onSuccess: setImpact,
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const save = useMutation({
    mutationFn: () => (isNew ? wardConfigApi.createZone(request()) : wardConfigApi.updateZone(zone!.zoneId, request())),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['ward'] });
      showToast(isNew ? 'Đã tạo tuyến' : 'Đã lưu tuyến');
      router.back();
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: () => wardConfigApi.deleteZone(zone!),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['ward'] });
      showToast('Đã xoá tuyến');
      router.back();
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const suggestion = useQuery({ queryKey: ['ward', 'zone-price-suggestion', zoneId], queryFn: () => wardConfigApi.priceSuggestion(Number(zoneId)), enabled: false });

  if (!isNew && zones.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tuyến' }} />
        <Skeleton height={150} radius={radius.card} />
        <ListSkeleton rows={4} height={64} />
      </Screen>
    );
  }
  if (!isNew && !zone) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tuyến' }} />
        <ErrorState error={zones.error ?? new Error('Không tìm thấy tuyến.')} onRetry={() => void zones.refetch()} />
      </Screen>
    );
  }
  const timesOk = validTime(d.from) && validTime(d.to) && (!d.from === !d.to);
  const priceOk = monthly ? Number(d.pricePerMonth) > 0 : Number(d.pricePerDay) > 0;
  const docOk = !newDoc || (d.regulationNumber.trim() && d.regulationIssuedOn && d.regulationIssuer.trim());
  // Every update needs a reason (the server refuses one without), a new zone does not.
  const reasonOk = isNew || reason.trim().length > 0;
  const valid = d.zoneName.trim() && d.zoneCode.trim() && priceOk && timesOk && docOk && reasonOk && d.fees.every((f) => f.componentName.trim() && Number(f.unitAmount) >= 0);
  const needImpact = !isNew && !impact;
  const sg = suggestion.data;
  const impactNotable = impact ? impact.pendingApplications.length > 0 || impact.openRenewals.length > 0 || impact.activeContractsAffectedByHours > 0 : false;

  return (
    <Screen footer={<Button label={needImpact ? 'Xem ảnh hưởng trước khi lưu' : isNew ? 'Tạo tuyến' : 'Lưu tuyến'} variant="sign" size={56} loading={preview.isPending || save.isPending} disabled={!valid} onPress={() => (needImpact ? preview.mutate() : save.mutate())} />}>
      <Stack.Screen options={{ title: isNew ? 'Thêm tuyến' : d.zoneName || 'Tuyến' }} />
      <PriceBoard name={d.zoneName.trim()} code={d.zoneCode.trim()} amount={monthly ? Number(d.pricePerMonth) || 0 : Number(d.pricePerDay) || 0} unit={monthly ? '/tháng' : '/ngày'} discount={d.rentalMode === 'STANDARD' ? d.discount : ''} />

      <Heading title="Tuyến" />
      <TextField label="Tên tuyến" value={d.zoneName} onChangeText={(v) => set({ zoneName: v })} placeholder="VD: Đường Nguyễn Văn Linh" />
      <TextField label="Mã tuyến" value={d.zoneCode} onChangeText={(v) => set({ zoneCode: v.toUpperCase() })} autoCapitalize="characters" placeholder="VD: HC1-NVL" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Từ đoạn" optional value={d.segmentFrom} onChangeText={(v) => set({ segmentFrom: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Đến đoạn" optional value={d.segmentTo} onChangeText={(v) => set({ segmentTo: v })} />
        </View>
      </View>

      <Heading title="Hình thức thuê và giá" />
      <Segments value={d.rentalMode} onChange={(v) => set({ rentalMode: v })} options={[{ key: 'STANDARD', label: 'Vị trí cố định' }, { key: 'EVENT', label: 'Khu sự kiện' }]} />
      {d.rentalMode === 'STANDARD' ? <Segments value={d.priceDisplayUnit} onChange={(v) => set({ priceDisplayUnit: v })} options={[{ key: 'MONTH', label: 'Giá theo tháng' }, { key: 'DAY', label: 'Giá theo ngày' }]} /> : null}
      {monthly ? (
        <TextField label="Giá thuê một tháng" value={d.pricePerMonth} onChangeText={(v) => set({ pricePerMonth: v.replace(/\D/g, '') })} keyboardType="number-pad" hint={Number(d.pricePerMonth) ? formatVnd(Number(d.pricePerMonth)) : undefined} trailing={<Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.muted }}>đ</Text>} />
      ) : (
        <TextField label="Giá thuê một ngày" value={d.pricePerDay} onChangeText={(v) => set({ pricePerDay: v.replace(/\D/g, '') })} keyboardType="number-pad" hint={Number(d.pricePerDay) ? formatVnd(Number(d.pricePerDay)) : undefined} trailing={<Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.muted }}>đ</Text>} />
      )}
      {d.rentalMode === 'STANDARD' ? <TextField label="Giảm giá thuê từ 3 tháng (%)" optional value={d.discount} onChangeText={(v) => set({ discount: v.replace(/\D/g, '').slice(0, 2) })} keyboardType="number-pad" /> : null}
      {d.rentalMode === 'EVENT' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <DateField label="Bắt đầu sự kiện" value={d.eventStartDate} onChange={(v) => set({ eventStartDate: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="Kết thúc sự kiện" value={d.eventEndDate} onChange={(v) => set({ eventEndDate: v })} />
          </View>
        </View>
      ) : null}
      {!isNew && zone && env.enableAiCompliance ? (
        sg ? (
          <AiSuggestionCard title={sg.direction === 'INSUFFICIENT_DATA' ? 'Chưa đủ dữ liệu để gợi ý giá' : `Gợi ý ${formatVnd(sg.suggestedPricePerDay)}/ngày`} aiLogId={sg.isAiGenerated ? sg.aiLogId : null}>
            <Text style={[text.footnote, { color: colors.ink }]}>{sg.explanation}</Text>
            <Text style={[text.caption, tabular, { color: colors.onMango }]}>{`Lấp đầy ${sg.occupancyPercent}% trong ${sg.windowDays} ngày, giới hạn ${formatVnd(sg.minAllowedPricePerDay)}–${formatVnd(sg.maxAllowedPricePerDay)}`}</Text>
            {sg.direction !== 'INSUFFICIENT_DATA' && sg.direction !== 'KEEP' ? <Button label="Điền giá gợi ý (chưa lưu)" variant="secondary" onPress={() => set({ priceDisplayUnit: 'DAY', pricePerDay: String(sg.suggestedPricePerDay) })} /> : null}
          </AiSuggestionCard>
        ) : (
          <Button label="Gợi ý giá theo mức lấp đầy" variant="secondary" icon={{ sf: 'sparkles', md: 'auto_awesome' }} loading={suggestion.isFetching} onPress={() => void suggestion.refetch()} />
        )
      ) : null}

      <Heading title="Giờ bán và hạn nộp hồ sơ" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Mở cửa" optional value={d.from} onChangeText={(v) => set({ from: v })} placeholder="05:00" keyboardType="numbers-and-punctuation" error={validTime(d.from) ? undefined : 'Giờ dạng HH:mm'} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Đóng cửa" optional value={d.to} onChangeText={(v) => set({ to: v })} placeholder="22:00" keyboardType="numbers-and-punctuation" error={validTime(d.to) ? undefined : 'Giờ dạng HH:mm'} />
        </View>
      </View>
      <DateField label="Hạn nộp hồ sơ" value={d.applicationDeadline} onChange={(v) => set({ applicationDeadline: v })} />

      <Heading title="Các khoản phí khác" note={d.fees.length ? undefined : 'Chưa có khoản phí nào ngoài giá thuê.'} />
      {d.fees.map((f, i) => (
        <Group key={i} padded>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 13.5, color: colors.primary }, tabular]}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 15.5, color: colors.ink }} numberOfLines={1}>{f.componentName.trim() || 'Khoản phí mới'}</Text>
            <Pressable onPress={() => set({ fees: d.fees.filter((_, j) => j !== i) })} accessibilityRole="button" accessibilityLabel="Bỏ khoản này" hitSlop={6} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.danger }}>Bỏ khoản này</Text>
            </Pressable>
          </View>
          <TextField label="Tên khoản" value={f.componentName} onChangeText={(v) => set({ fees: d.fees.map((x, j) => (j === i ? { ...x, componentName: v } : x)) })} />
          <Segments value={f.calcBasis} onChange={(v) => set({ fees: d.fees.map((x, j) => (j === i ? { ...x, calcBasis: v } : x)) })} options={(Object.keys(BASIS) as ZoneFeeComponentInput['calcBasis'][]).map((k) => ({ key: k, label: BASIS[k] }))} />
          <TextField label="Số tiền" value={f.unitAmount} onChangeText={(v) => set({ fees: d.fees.map((x, j) => (j === i ? { ...x, unitAmount: v.replace(/\D/g, '') } : x)) })} keyboardType="number-pad" hint={Number(f.unitAmount) ? formatVnd(Number(f.unitAmount)) : undefined} />
        </Group>
      ))}
      <Button label="Thêm khoản phí" variant="secondary" icon={{ sf: 'plus', md: 'add' }} onPress={() => set({ fees: [...d.fees, { componentName: '', calcBasis: 'PER_TERM', unitAmount: '' }] })} />

      <Heading title="Văn bản cho phép" />
      {!isNew ? <Segments<'KEEP' | 'NEW'> value={newDoc ? 'NEW' : 'KEEP'} onChange={(v) => { setNewDoc(v === 'NEW'); setImpact(null); }} options={[{ key: 'KEEP', label: 'Giữ văn bản cũ' }, { key: 'NEW', label: 'Văn bản mới' }]} /> : null}
      {!isNew && !newDoc && zone?.regulationRef ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.signTint }}>
          <Icon sf="doc.text.fill" md="description" size={18} color={colors.sign} />
          <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>{zone.regulationRef}</Text>
        </View>
      ) : null}
      {newDoc ? (
        <>
          <TextField label="Số hiệu văn bản" value={d.regulationNumber} onChangeText={(v) => set({ regulationNumber: v })} placeholder="VD: 1247/QĐ-UBND" />
          <DateField label="Ngày ban hành" value={d.regulationIssuedOn} onChange={(v) => set({ regulationIssuedOn: v })} />
          <TextField label="Cơ quan ban hành" value={d.regulationIssuer} onChangeText={(v) => set({ regulationIssuer: v })} placeholder="VD: UBND phường Hải Châu" />
        </>
      ) : null}
      {!isNew ? <TextField label="Lý do thay đổi" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline placeholder="Bắt buộc khi sửa tuyến" hint={`${reason.length}/500`} /> : null}

      {impact ? (
        <StatusHeader
          tone={impactNotable ? 'pending' : 'ok'}
          title="Ảnh hưởng nếu lưu"
          detail={[
            impact.amountChanged ? `${impact.pendingApplications.length} đơn thuê và ${impact.openRenewals.length} đơn gia hạn đang chờ sẽ tính theo giá mới (chênh ${formatVnd(impact.totalDelta)}).` : 'Giá và phí không đổi.',
            impact.hoursChanged ? `${impact.activeContractsAffectedByHours} hợp đồng đang thuê đổi giờ bán.` : null,
            impact.vendorsToNotify ? `${impact.vendorsToNotify} hộ sẽ được thông báo.` : null,
          ].filter(Boolean).join('\n')}
        />
      ) : null}

      {history.data && history.data.length ? (
        <>
          <Heading title="Lịch sử thay đổi" />
          <Timeline rows={history.data.slice(0, 10).map((h) => ({ key: h.auditId, what: h.action, detail: h.details, meta: `${h.actorName}, ${formatVietnamDateTime(h.createdAt)}` }))} />
        </>
      ) : null}
      {zone && zone.slotCount === 0 ? (
        <Pressable onPress={() => Alert.alert(`Xoá tuyến ${zone.zoneName}?`, 'Tuyến chưa có ô nào nên xoá được.', [{ text: 'Giữ', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate() }])} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 }}>
          <Icon sf="trash" md="delete" size={16} color={colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger }}>Xoá tuyến</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

/**
 * W24 Khung mức phạt (WARD-03), v5: each violation type as a card with the rate in force in
 * sign figures and its legal bracket drawn as a ruler (the rate is the bracket's midpoint); a
 * type with no legal basis is outlined in mango. The next scheduled rate shows as a pill.
 */
export function PenaltyScheduleScreen() {
  const overview = useQuery({ queryKey: ['ward', 'penalty-overview'], queryFn: wardConfigApi.penaltyOverview });
  return (
    <Screen onRefresh={() => void overview.refetch()} refreshing={overview.isRefetching} gap={14}>
      <Stack.Screen options={{ title: 'Khung mức phạt' }} />
      <Banner tone="info">Mức phạt áp dụng là trung bình khung theo điều khoản (giảm nhẹ/tăng nặng do người ký quyết định). Mức mới có hiệu lực từ ngày chọn; vi phạm cũ giữ mức tại ngày vi phạm.</Banner>
      {overview.isPending ? (
        <View style={{ gap: 14 }}>
          <Skeleton height={150} radius={radius.card} />
          <Skeleton height={150} radius={radius.card} />
          <Skeleton height={150} radius={radius.card} />
        </View>
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : overview.data.length === 0 ? (
        <StateView icon={{ sf: 'list.bullet.rectangle', md: 'receipt_long' }} tone="neutral" title="Chưa có loại vi phạm" body="Danh mục hành vi vi phạm sẽ hiện ở đây khi hệ thống được cấu hình." />
      ) : (
        overview.data.map((t) => (
          <Pressable
            key={t.violationType}
            onPress={() => go(`/ward/more/penalties/${t.violationType}`)}
            accessibilityRole="button"
            style={({ pressed }) => ({ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.kerbPaint : colors.card, borderWidth: t.hasLegalBasis ? 0 : 2, borderColor: colors.mango, boxShadow: shadow.card })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 16, lineHeight: 22, color: colors.ink }}>{t.description}</Text>
              <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} style={{ marginTop: 4 }} />
            </View>
            {t.current ? (
              <>
                <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: colors.primary }]}>{formatVnd(t.current.amount)}</Text>
                {t.current.bracketMin != null && t.current.bracketMax != null ? <BracketRuler min={t.current.bracketMin} max={t.current.bracketMax} value={t.current.amount} /> : null}
              </>
            ) : (
              <Text style={[text.callout, { fontFamily: fonts.bold, color: colors.onMango }]}>Chưa có mức phạt hiệu lực</Text>
            )}
            {!t.hasLegalBasis || t.scheduled || !t.isActive ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {!t.hasLegalBasis ? <StatusPill label="Thiếu căn cứ pháp lý" tone="pending" /> : null}
                {t.scheduled ? <StatusPill label={`Mức mới từ ${formatDateVn(t.scheduled.effectiveFrom)}`} tone="neutral" /> : null}
                {!t.isActive ? <StatusPill label="Không dùng" tone="neutral" /> : null}
              </View>
            ) : null}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

/** W25 Đặt mức phạt: the legal basis clause by clause, the bracket, the date it takes effect; history; cancel a scheduled rate. */
export function PenaltyRateScreen() {
  const { violationType } = useLocalSearchParams<{ violationType: string }>();
  const cache = useQueryClient();
  const overview = useQuery({ queryKey: ['ward', 'penalty-overview'], queryFn: wardConfigApi.penaltyOverview });
  const history = useQuery({ queryKey: ['ward', 'penalty-history', violationType], queryFn: () => wardConfigApi.penaltyHistory(violationType!) });
  const type: WardPenaltyType | undefined = overview.data?.find((t) => t.violationType === violationType);
  const today = todayVn();
  const [f, setF] = useState({ documentRef: '', article: '', clause: '', point: '', behavior: '', min: '', max: '', effectiveFrom: today });
  const min = Number(f.min);
  const max = Number(f.max);
  const bracketError = f.min && f.max && max < min ? 'Mức tối đa không nhỏ hơn mức tối thiểu.' : undefined;
  const midpoint = f.min && f.max && !bracketError ? Math.floor((min + max) / 2) : null;
  const ready = f.documentRef.trim() && f.article.trim() && f.clause.trim() && f.behavior.trim() && midpoint != null && f.effectiveFrom >= today;
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ['ward', 'penalty-overview'] });
    void cache.invalidateQueries({ queryKey: ['ward', 'penalty-history', violationType] });
    void cache.invalidateQueries({ queryKey: ['ward', 'penalty-schedules'] });
  };
  const save = useMutation({
    mutationFn: () => wardConfigApi.setPenaltyRate({ violationType: violationType!, documentRef: f.documentRef.trim(), article: f.article.trim(), clause: f.clause.trim(), point: f.point.trim() || null, behavior: f.behavior.trim(), bracketMin: min, bracketMax: max, effectiveFrom: f.effectiveFrom, expectedCurrentScheduleId: type?.current && !type.current.effectiveTo ? type.current.scheduleId : null }),
    onSuccess: () => {
      refresh();
      showToast('Đã lưu mức phạt');
      router.back();
    },
    onError: (e) => {
      refresh();
      showToast(errorMessage(e), 'error');
    },
  });
  const cancel = useMutation({
    mutationFn: (scheduleId: number) => wardConfigApi.cancelPenaltyRate(scheduleId),
    onSuccess: () => {
      refresh();
      showToast('Đã huỷ mức sắp áp dụng');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  if (overview.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Mức phạt' }} />
        <Skeleton height={140} radius={radius.card} />
        <ListSkeleton rows={3} height={64} />
      </Screen>
    );
  }
  if (!type) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Mức phạt' }} />
        <ErrorState error={overview.error ?? new Error('Không tìm thấy loại vi phạm.')} onRetry={() => void overview.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen footer={<Button label="Lưu mức phạt" variant="sign" size={56} loading={save.isPending} disabled={!ready} onPress={() => Alert.alert('Lưu mức phạt mới?', `${formatVnd(midpoint ?? 0)} (trung bình khung) có hiệu lực từ ${formatDateVn(f.effectiveFrom)}.`, [{ text: 'Quay lại', style: 'cancel' }, { text: 'Lưu', onPress: () => save.mutate() }])} />}>
      <Stack.Screen options={{ title: 'Mức phạt' }} />
      <Text style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>{type.description}</Text>
      {type.current ? (
        <Group padded>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Đang áp dụng</Text>
            <Text maxFontSizeMultiplier={1.3} style={[sign.figure, tabular, { color: colors.primary }]}>{formatVnd(type.current.amount)}</Text>
          </View>
          <KeyValueList rows={[type.current.legalBasis ? { label: 'Căn cứ', value: type.current.legalBasis } : null, { label: 'Hiệu lực từ', value: formatDateVn(type.current.effectiveFrom) }]} />
        </Group>
      ) : null}
      {type.scheduled ? (
        <Banner tone="info" title={`Sắp áp dụng từ ${formatDateVn(type.scheduled.effectiveFrom)}: ${formatVnd(type.scheduled.amount)}`} action={{ label: cancel.isPending ? 'Đang huỷ…' : 'Huỷ mức này', onPress: () => cancel.mutate(type.scheduled!.scheduleId) }}>
          {type.scheduled.legalBasis ?? ''}
        </Banner>
      ) : null}

      <Heading title="Mức mới" note="Chép đúng điều khoản; mức áp dụng là trung bình khung." />
      <TextField label="Văn bản (số hiệu)" value={f.documentRef} onChangeText={(v) => setF({ ...f, documentRef: v })} placeholder="Nghị định 168/2024/NĐ-CP" maxLength={150} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Điều" value={f.article} onChangeText={(v) => setF({ ...f, article: v })} maxLength={10} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Khoản" value={f.clause} onChangeText={(v) => setF({ ...f, clause: v })} maxLength={10} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Điểm" optional value={f.point} onChangeText={(v) => setF({ ...f, point: v })} maxLength={10} />
        </View>
      </View>
      <TextField label="Hành vi theo văn bản" value={f.behavior} onChangeText={(v) => setF({ ...f, behavior: v })} multiline maxLength={300} hint="Chép đúng mô tả hành vi trong điều khoản." />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Khung tối thiểu" value={f.min} onChangeText={(v) => setF({ ...f, min: v.replace(/\D/g, '') })} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Khung tối đa" value={f.max} onChangeText={(v) => setF({ ...f, max: v.replace(/\D/g, '') })} keyboardType="number-pad" error={bracketError} />
        </View>
      </View>
      {midpoint != null ? (
        <Group padded>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Mức áp dụng (trung bình khung)</Text>
            <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: colors.primary }]}>{formatVnd(midpoint)}</Text>
          </View>
          <BracketRuler min={min} max={max} value={midpoint} />
        </Group>
      ) : null}
      <DateField label="Hiệu lực từ" value={f.effectiveFrom} onChange={(v) => setF({ ...f, effectiveFrom: v })} />
      {f.effectiveFrom < today ? <Text style={[text.footnote, { color: colors.onDanger }]}>Ngày hiệu lực không được trước hôm nay.</Text> : null}
      {history.data && history.data.length ? (
        <>
          <Heading title="Lịch sử mức phạt" />
          <Timeline rows={history.data.map((h) => ({ key: h.scheduleId, what: formatVnd(h.amount), detail: `${formatDateVn(h.effectiveFrom)}${h.effectiveTo ? ` – ${formatDateVn(h.effectiveTo)}` : ''}`, meta: `${h.actorName}${h.isInUse ? ', đã dùng cho vi phạm' : ''}` }))} />
        </>
      ) : null}
    </Screen>
  );
}
