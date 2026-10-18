import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { AiSuggestionCard } from '../components/ReviewParts';
import { formatDateVn, todayVn, toApiTime, wardConfigApi, type UpsertZoneRequest, type WardPenaltyType, type WardZone, type ZoneFeeComponentInput, type ZoneImpactPreview } from '../ward-config-api';

const go = (href: string) => router.push(href as Href);
const BASIS: Record<ZoneFeeComponentInput['calcBasis'], string> = { PER_DAY: 'Theo ngày', PER_TERM: 'Mỗi kỳ', ONE_TIME: 'Một lần', DEPOSIT: 'Tiền cọc' };
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
const validTime = (t: string) => !t || /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** W22 Biểu giá theo tuyến (WARD-02): each route's price, hours, mode and fees; the ward's compliance thresholds. */
export function PricingZonesScreen() {
  const zones = useQuery({ queryKey: ['ward', 'zones'], queryFn: wardConfigApi.listZones });
  return (
    <Screen onRefresh={() => void zones.refetch()} refreshing={zones.isRefetching} footer={<Button label="Thêm tuyến" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={() => go('/ward/more/zones/new')} />}>
      <Stack.Screen options={{ title: 'Biểu giá thuê' }} />
      <CompliancePolicyCard />
      {zones.isPending ? (
        <ListSkeleton rows={3} height={110} />
      ) : zones.isError ? (
        <ErrorState error={zones.error} onRetry={() => void zones.refetch()} />
      ) : zones.data.length === 0 ? (
        <StateView icon={{ sf: 'signpost.right', md: 'signpost' }} title="Chưa có tuyến nào" body="Thêm tuyến vỉa hè và giá thuê để mở cho hộ kinh doanh đăng ký." />
      ) : (
        zones.data.map((z) => (
          <Pressable key={z.zoneId} onPress={() => go(`/ward/more/zones/${z.zoneId}`)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[text.headline, { flex: 1, color: colors.ink }]}>{z.zoneName}</Text>
              <StatusPill label={z.rentalMode === 'EVENT' ? 'Sự kiện' : 'Cố định'} tone={z.rentalMode === 'EVENT' ? 'pending' : 'neutral'} />
            </View>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.primary }, tabular]}>
              {z.priceDisplayUnit === 'MONTH' && z.pricePerMonth != null ? `${formatVnd(z.pricePerMonth)}/tháng` : `${formatVnd(z.pricePerDay)}/ngày`}
              {z.quarterDiscountPercent ? <Text style={[text.caption, { color: colors.onLeaf }]}> · giảm {z.quarterDiscountPercent}% từ 3 tháng</Text> : null}
            </Text>
            <Text style={[text.caption, { color: colors.muted }]}>
              {z.zoneCode ? `${z.zoneCode} · ` : ''}
              {z.availableFrom ? `${hhmm(z.availableFrom)}–${hhmm(z.availableTo)}` : 'Cả ngày'} · {z.activeSlotCount}/{z.slotCount} ô đang thuê · {z.feeComponents.length} khoản phí
            </Text>
          </Pressable>
        ))
      )}
    </Screen>
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
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon sf="gauge.with.dots.needle.67percent" md="speed" size={18} color={colors.sign} />
        <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Ngưỡng tuân thủ</Text>
        {!edit ? (
          <Pressable onPress={() => setEdit({ count: p.violationThresholdCount?.toString() ?? '', window: p.violationWindowDays?.toString() ?? '', grace: p.unpaidPenaltyGraceDays?.toString() ?? '' })} hitSlop={8}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Sửa</Text>
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
            <Button label="Lưu" loading={save.isPending} onPress={() => save.mutate()} style={{ flex: 1.4 }} />
          </View>
        </>
      ) : (
        <>
          <Text style={[text.footnote, { color: colors.ink }]}>
            {p.violationThresholdCount ? `Gợi ý xem xét thu hồi khi có ${p.violationThresholdCount} vi phạm đã xử phạt trong ${p.violationWindowDays ?? '—'} ngày.` : 'Chưa bật ngưỡng vi phạm.'}
          </Text>
          <Text style={[text.footnote, { color: colors.ink }]}>{p.unpaidPenaltyGraceDays ? `Nhắc phạt chưa nộp sau ${p.unpaidPenaltyGraceDays} ngày.` : 'Chưa bật nhắc phạt quá hạn.'}</Text>
          <Text style={[text.caption, { color: colors.muted }]}>Chỉ để cảnh báo; không tự đình chỉ hay thu hồi.{p.updatedAt ? ` Sửa lần cuối ${formatVietnamDateTime(p.updatedAt)}${p.updatedByName ? ` bởi ${p.updatedByName}` : ''}.` : ''}</Text>
        </>
      )}
    </Card>
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
        <ListSkeleton rows={4} height={80} />
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
  const valid = d.zoneName.trim() && d.zoneCode.trim() && priceOk && timesOk && docOk && d.fees.every((f) => f.componentName.trim() && Number(f.unitAmount) >= 0);
  const needImpact = !isNew && !impact;
  const sg = suggestion.data;

  return (
    <Screen footer={<Button label={needImpact ? 'Xem ảnh hưởng trước khi lưu' : isNew ? 'Tạo tuyến' : 'Lưu tuyến'} size={56} loading={preview.isPending || save.isPending} disabled={!valid} onPress={() => (needImpact ? preview.mutate() : save.mutate())} />}>
      <Stack.Screen options={{ title: isNew ? 'Thêm tuyến' : d.zoneName || 'Tuyến' }} />
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
      <Text style={[text.subhead, { color: colors.ink }]}>Hình thức thuê</Text>
      <Segments value={d.rentalMode} onChange={(v) => set({ rentalMode: v })} options={[{ key: 'STANDARD', label: 'Vị trí cố định' }, { key: 'EVENT', label: 'Khu sự kiện' }]} />
      {d.rentalMode === 'STANDARD' ? <Segments value={d.priceDisplayUnit} onChange={(v) => set({ priceDisplayUnit: v })} options={[{ key: 'MONTH', label: 'Giá theo tháng' }, { key: 'DAY', label: 'Giá theo ngày' }]} /> : null}
      {monthly ? (
        <TextField label="Giá thuê một tháng" value={d.pricePerMonth} onChangeText={(v) => set({ pricePerMonth: v.replace(/\D/g, '') })} keyboardType="number-pad" hint={Number(d.pricePerMonth) ? formatVnd(Number(d.pricePerMonth)) : undefined} />
      ) : (
        <TextField label="Giá thuê một ngày" value={d.pricePerDay} onChangeText={(v) => set({ pricePerDay: v.replace(/\D/g, '') })} keyboardType="number-pad" hint={Number(d.pricePerDay) ? formatVnd(Number(d.pricePerDay)) : undefined} />
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
      {!isNew && zone ? (
        sg ? (
          <AiSuggestionCard title={sg.direction === 'INSUFFICIENT_DATA' ? 'Chưa đủ dữ liệu để gợi ý giá' : `Gợi ý ${formatVnd(sg.suggestedPricePerDay)}/ngày`} aiLogId={sg.isAiGenerated ? sg.aiLogId : null}>
            <Text style={[text.footnote, { color: colors.ink }]}>{sg.explanation}</Text>
            <Text style={[text.caption, { color: colors.onMango }]}>Lấp đầy {sg.occupancyPercent}% trong {sg.windowDays} ngày · giới hạn {formatVnd(sg.minAllowedPricePerDay)}–{formatVnd(sg.maxAllowedPricePerDay)}</Text>
            {sg.direction !== 'INSUFFICIENT_DATA' && sg.direction !== 'KEEP' ? <Button label="Điền giá gợi ý (chưa lưu)" variant="secondary" onPress={() => set({ priceDisplayUnit: 'DAY', pricePerDay: String(sg.suggestedPricePerDay) })} /> : null}
          </AiSuggestionCard>
        ) : (
          <Button label="Gợi ý giá theo mức lấp đầy" variant="secondary" icon={{ sf: 'sparkles', md: 'auto_awesome' }} loading={suggestion.isFetching} onPress={() => void suggestion.refetch()} />
        )
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Mở cửa" optional value={d.from} onChangeText={(v) => set({ from: v })} placeholder="05:00" keyboardType="numbers-and-punctuation" error={validTime(d.from) ? undefined : 'Giờ dạng HH:mm'} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Đóng cửa" optional value={d.to} onChangeText={(v) => set({ to: v })} placeholder="22:00" keyboardType="numbers-and-punctuation" error={validTime(d.to) ? undefined : 'Giờ dạng HH:mm'} />
        </View>
      </View>
      <DateField label="Hạn nộp hồ sơ" value={d.applicationDeadline} onChange={(v) => set({ applicationDeadline: v })} />

      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Các khoản phí khác</Text>
      {d.fees.map((f, i) => (
        <Card key={i} style={{ gap: 8 }}>
          <TextField label="Tên khoản" value={f.componentName} onChangeText={(v) => set({ fees: d.fees.map((x, j) => (j === i ? { ...x, componentName: v } : x)) })} />
          <Segments value={f.calcBasis} onChange={(v) => set({ fees: d.fees.map((x, j) => (j === i ? { ...x, calcBasis: v } : x)) })} options={(Object.keys(BASIS) as ZoneFeeComponentInput['calcBasis'][]).map((k) => ({ key: k, label: BASIS[k] }))} />
          <TextField label="Số tiền" value={f.unitAmount} onChangeText={(v) => set({ fees: d.fees.map((x, j) => (j === i ? { ...x, unitAmount: v.replace(/\D/g, '') } : x)) })} keyboardType="number-pad" />
          <Pressable onPress={() => set({ fees: d.fees.filter((_, j) => j !== i) })} hitSlop={6}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.danger }}>Bỏ khoản này</Text>
          </Pressable>
        </Card>
      ))}
      <Button label="Thêm khoản phí" variant="secondary" icon={{ sf: 'plus', md: 'add' }} onPress={() => set({ fees: [...d.fees, { componentName: '', calcBasis: 'PER_TERM', unitAmount: '' }] })} />

      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Văn bản cho phép</Text>
      {!isNew ? <Segments<'KEEP' | 'NEW'> value={newDoc ? 'NEW' : 'KEEP'} onChange={(v) => { setNewDoc(v === 'NEW'); setImpact(null); }} options={[{ key: 'KEEP', label: 'Giữ văn bản cũ' }, { key: 'NEW', label: 'Văn bản mới' }]} /> : null}
      {!isNew && !newDoc && zone?.regulationRef ? <Text style={[text.footnote, { color: colors.muted }]}>{zone.regulationRef}</Text> : null}
      {newDoc ? (
        <>
          <TextField label="Số hiệu văn bản" value={d.regulationNumber} onChangeText={(v) => set({ regulationNumber: v })} placeholder="VD: 1247/QĐ-UBND" />
          <DateField label="Ngày ban hành" value={d.regulationIssuedOn} onChange={(v) => set({ regulationIssuedOn: v })} />
          <TextField label="Cơ quan ban hành" value={d.regulationIssuer} onChangeText={(v) => set({ regulationIssuer: v })} placeholder="VD: UBND phường Hải Châu" />
        </>
      ) : null}
      {!isNew ? <TextField label="Lý do thay đổi" optional value={reason} onChangeText={setReason} multiline /> : null}

      {impact ? (
        <Banner tone={impact.pendingApplications.length || impact.openRenewals.length || impact.activeContractsAffectedByHours ? 'warning' : 'success'} title="Ảnh hưởng nếu lưu">
          {[
            impact.amountChanged ? `${impact.pendingApplications.length} đơn thuê và ${impact.openRenewals.length} đơn gia hạn đang chờ sẽ tính theo giá mới (chênh ${formatVnd(impact.totalDelta)}).` : 'Giá và phí không đổi.',
            impact.hoursChanged ? `${impact.activeContractsAffectedByHours} hợp đồng đang thuê đổi giờ bán.` : null,
            impact.vendorsToNotify ? `${impact.vendorsToNotify} hộ sẽ được thông báo.` : null,
          ].filter(Boolean).join('\n')}
        </Banner>
      ) : null}

      {history.data && history.data.length ? (
        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Lịch sử thay đổi</Text>
          {history.data.slice(0, 10).map((h) => (
            <View key={h.auditId}>
              <Text style={[text.footnote, { color: colors.ink }]}>{h.action}{h.details ? ` · ${h.details}` : ''}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{h.actorName} · {formatVietnamDateTime(h.createdAt)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {zone && zone.slotCount === 0 ? (
        <Pressable onPress={() => Alert.alert(`Xoá tuyến ${zone.zoneName}?`, 'Tuyến chưa có ô nào nên xoá được.', [{ text: 'Giữ', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate() }])} style={{ alignSelf: 'center', padding: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger }}>Xoá tuyến</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

/** W24 Khung mức phạt (WARD-03): each violation type's rate in force, the next one scheduled, and its history. */
export function PenaltyScheduleScreen() {
  const overview = useQuery({ queryKey: ['ward', 'penalty-overview'], queryFn: wardConfigApi.penaltyOverview });
  return (
    <Screen onRefresh={() => void overview.refetch()} refreshing={overview.isRefetching}>
      <Stack.Screen options={{ title: 'Khung mức phạt' }} />
      <Banner tone="info">Mức phạt áp dụng là trung bình khung theo điều khoản (giảm nhẹ/tăng nặng do người ký quyết định). Mức mới có hiệu lực từ ngày chọn; vi phạm cũ giữ mức tại ngày vi phạm.</Banner>
      {overview.isPending ? (
        <ListSkeleton rows={4} height={100} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        overview.data.map((t) => (
          <Pressable key={t.violationType} onPress={() => go(`/ward/more/penalties/${t.violationType}`)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: t.hasLegalBasis ? 0 : 1.5, borderColor: colors.mango })}>
            <Text style={[text.subhead, { color: colors.ink }]}>{t.description}</Text>
            {t.current ? (
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.primary }, tabular]}>
                {formatVnd(t.current.amount)}
                {t.current.bracketMin != null && t.current.bracketMax != null ? <Text style={[text.caption, { color: colors.muted }]}> · khung {formatVnd(t.current.bracketMin)}–{formatVnd(t.current.bracketMax)}</Text> : null}
              </Text>
            ) : (
              <Text style={[text.footnote, { color: colors.onMango }]}>Chưa có mức phạt hiệu lực</Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {!t.hasLegalBasis ? <StatusPill label="Thiếu căn cứ pháp lý" tone="pending" /> : null}
              {t.scheduled ? <StatusPill label={`Mức mới từ ${formatDateVn(t.scheduled.effectiveFrom)}`} tone="neutral" /> : null}
              {!t.isActive ? <StatusPill label="Không dùng" tone="neutral" /> : null}
            </View>
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
        <ListSkeleton rows={4} height={70} />
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
    <Screen footer={<Button label="Lưu mức phạt" size={56} loading={save.isPending} disabled={!ready} onPress={() => Alert.alert('Lưu mức phạt mới?', `${formatVnd(midpoint ?? 0)} (trung bình khung) có hiệu lực từ ${formatDateVn(f.effectiveFrom)}.`, [{ text: 'Quay lại', style: 'cancel' }, { text: 'Lưu', onPress: () => save.mutate() }])} />}>
      <Stack.Screen options={{ title: 'Mức phạt' }} />
      <Text style={[text.headline, { color: colors.ink }]}>{type.description}</Text>
      {type.current ? (
        <Card>
          <KeyValueList rows={[{ label: 'Đang áp dụng', value: formatVnd(type.current.amount), emphasis: true }, type.current.legalBasis ? { label: 'Căn cứ', value: type.current.legalBasis } : null, { label: 'Hiệu lực từ', value: formatDateVn(type.current.effectiveFrom) }]} />
        </Card>
      ) : null}
      {type.scheduled ? (
        <Banner tone="info" title={`Sắp áp dụng từ ${formatDateVn(type.scheduled.effectiveFrom)}: ${formatVnd(type.scheduled.amount)}`} action={{ label: cancel.isPending ? 'Đang huỷ…' : 'Huỷ mức này', onPress: () => cancel.mutate(type.scheduled!.scheduleId) }}>
          {type.scheduled.legalBasis ?? ''}
        </Banner>
      ) : null}
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Mức mới</Text>
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
      {midpoint != null ? <Text style={[text.callout, { color: colors.primary, fontFamily: fonts.bold }, tabular]}>Mức áp dụng (trung bình khung): {formatVnd(midpoint)}</Text> : null}
      <DateField label="Hiệu lực từ" value={f.effectiveFrom} onChange={(v) => setF({ ...f, effectiveFrom: v })} />
      {f.effectiveFrom < today ? <Text style={[text.footnote, { color: colors.onDanger }]}>Ngày hiệu lực không được trước hôm nay.</Text> : null}
      {history.data && history.data.length ? (
        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Lịch sử mức phạt</Text>
          {history.data.map((h) => (
            <View key={h.scheduleId}>
              <Text style={[text.footnote, { color: colors.ink }, tabular]}>{formatVnd(h.amount)} · {formatDateVn(h.effectiveFrom)}{h.effectiveTo ? ` – ${formatDateVn(h.effectiveTo)}` : ''}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{h.actorName}{h.isInUse ? ' · đã dùng cho vi phạm' : ''}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
