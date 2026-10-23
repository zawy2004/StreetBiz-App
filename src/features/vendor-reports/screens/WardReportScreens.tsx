import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile } from '@/components/common/ProtectedFile';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { ApiError, errorMessage } from '@/core/api';
import type { VendorReportType } from '@/features/vendor-map/community-api';
import { AiSuggestionCard } from '@/features/ward-administration/components/ReviewParts';
import { colors, fonts, radius, shadow, sign, tabular, text, type StatusTone } from '@/theme';
import { Pass, Plate } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { NOTE_MAX, REPORT_TYPE_ICONS, reportStatusLabel, reportTypeLabel, resolveErrors, type ResolveChoice } from '../report-view';
import { WARD_REPORTS_PAGE_SIZE, wardReportKeys, wardReportsApi, type PermitPrecheck, type WardReportFilter, type WardReportStatus, type WardVendorReport, type WardVendorReportSummary } from '../ward-reports-api';

const go = (href: string) => router.push(href as Href);

type StatusTab = WardReportStatus | 'ALL';
type TypeTab = VendorReportType | 'ALL';

const TYPE_FILTERS: { key: TypeTab; label: string }[] = [
  { key: 'ALL', label: 'Mọi loại' },
  { key: 'OVERCHARGE', label: 'Bán quá giá' },
  { key: 'PRICE_NOT_POSTED', label: 'Không treo bảng giá' },
  { key: 'GENERAL', label: 'Phản ánh khác' },
];

const TYPE_INK: Record<VendorReportType, { ink: string; wash: string }> = {
  OVERCHARGE: { ink: colors.danger, wash: colors.dangerTint },
  PRICE_NOT_POSTED: { ink: colors.onMango, wash: colors.mangoTint },
  GENERAL: { ink: colors.sign, wash: colors.signTint },
};

const typeLook = (type: string) => TYPE_INK[type as VendorReportType] ?? TYPE_INK.GENERAL;
const typeIcon = (type: string) => REPORT_TYPE_ICONS[type as VendorReportType] ?? REPORT_TYPE_ICONS.GENERAL;

/** The officer's words for each flag the system raises beside a report (AIB-01; computed, not AI). */
const FLAG_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  NO_PHOTO: { label: 'Phản ánh không kèm ảnh', tone: 'neutral' },
  NO_PERMIT_VISIBLE_IN_PHOTO: { label: 'Không thấy giấy phép trong ảnh', tone: 'pending' },
  SIGNAGE_DIFFERS_FROM_REGISTERED_NAME: { label: 'Tên trên biển hiệu khác tên đã đăng ký', tone: 'pending' },
  PERMIT_NOT_VALID: { label: 'Giấy phép đã quét không còn hiệu lực', tone: 'danger' },
  PERMIT_SLOT_MISMATCH: { label: 'Giấy phép thuộc ô khác với ô được nêu', tone: 'danger' },
};
const PERMIT_VISIBLE_LABELS: Record<string, string> = {
  YES: 'Có thấy giấy phép / mã QR trong ảnh',
  NO: 'Không thấy giấy phép / mã QR trong ảnh',
  UNCLEAR: 'Chưa rõ có giấy phép trong ảnh hay không',
};
const permitSentence = (check: PermitPrecheck) => `Giấy phép #${check.permitId}${check.slotCode ? ` (ô ${check.slotCode})` : ''} ${check.validNow ? 'còn hiệu lực' : 'không còn hiệu lực'}.`;

/** "Hạn 25/10/2026 23:59" or "Quá hạn từ …", the internal handling target (not a statutory deadline). */
function dueLine(r: { status: string; dueAt: string | null; isOverdue: boolean }): string | null {
  if (r.status !== 'PENDING' || !r.dueAt) return null;
  return r.isOverdue ? `Quá hạn từ ${formatVietnamDateTime(r.dueAt)}` : `Hạn xử lý ${formatVietnamDateTime(r.dueAt)}`;
}

/**
 * W-Phản ánh (WARD-19), from Hộp duyệt: citizens' reports about the ward's stalls, overdue first,
 * then nearest due time (the server's order), filtered by state, type and "quá hạn". The due time
 * is the ward's internal target. Nothing here closes a report; the officer opens one and decides.
 */
export function WardReportsScreen() {
  const [status, setStatus] = useState<StatusTab>('PENDING');
  const [type, setType] = useState<TypeTab>('ALL');
  const [overdue, setOverdue] = useState(false);
  const filter: WardReportFilter = {
    status: status === 'ALL' ? undefined : status,
    type: type === 'ALL' ? undefined : type,
    overdue: overdue && (status === 'PENDING' || status === 'ALL') ? true : undefined,
  };
  const list = useInfiniteQuery({
    queryKey: wardReportKeys.list(filter),
    queryFn: ({ pageParam }) => wardReportsApi.list(filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length >= WARD_REPORTS_PAGE_SIZE ? all.length + 1 : undefined),
  });
  const rows = list.data?.pages.flat() ?? [];
  const overdueShown = status === 'PENDING' || status === 'ALL';

  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching && !list.isFetchingNextPage} gap={14}>
      <Stack.Screen options={{ title: 'Phản ánh của người dân' }} />
      <Segments<StatusTab>
        value={status}
        onChange={setStatus}
        options={[
          { key: 'PENDING', label: 'Đang chờ' },
          { key: 'REVIEWED', label: 'Đã xử lý' },
          { key: 'DISMISSED', label: 'Đã bác' },
          { key: 'ALL', label: 'Tất cả' },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16, flexGrow: 0 }}>
        {overdueShown ? (
          <Chip label="Quá hạn" icon={{ sf: 'exclamationmark.circle.fill', md: 'error' }} selected={overdue} accessibilityRole="switch" onPress={() => setOverdue((o) => !o)} />
        ) : null}
        {TYPE_FILTERS.map((t) => (
          <Chip key={t.key} label={t.label} selected={type === t.key} accessibilityRole="radio" onPress={() => setType(t.key)} />
        ))}
      </ScrollView>
      <Text style={[text.footnote, { color: colors.muted, marginHorizontal: 4 }]}>Hạn xử lý là hạn nội bộ của phường (7 ngày làm việc), không phải hạn luật định.</Text>
      {list.isPending ? (
        <ListSkeleton rows={4} height={112} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <StateView icon={{ sf: 'tray', md: 'inbox' }} tone="neutral" title="Không có phản ánh" body={status === 'PENDING' ? 'Phản ánh mới của người dân về quầy trong phường sẽ hiện ở đây.' : 'Không có phản ánh nào khớp bộ lọc.'} />
      ) : (
        <>
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
            {rows.map((r, i) => (
              <ReportRow key={r.reportId} report={r} first={i === 0} />
            ))}
          </View>
          {list.hasNextPage ? <Button label="Tải thêm" variant="secondary" loading={list.isFetchingNextPage} onPress={() => void list.fetchNextPage()} /> : null}
        </>
      )}
    </Screen>
  );
}

function ReportRow({ report: r, first }: { report: WardVendorReportSummary; first: boolean }) {
  const s = reportStatusLabel(r);
  const look = typeLook(r.reportType);
  const icon = typeIcon(r.reportType);
  const due = dueLine(r);
  const edge = r.status !== 'PENDING' ? 'transparent' : r.isOverdue ? colors.danger : colors.mango;
  return (
    <Pressable
      onPress={() => go(`/ward/inbox/reports/${r.reportId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${reportTypeLabel(r.reportType)}: ${r.vendorName ?? 'Hộ kinh doanh'}${r.slotCode ? `, ô ${r.slotCode}` : ''}, ${s.label}${due ? `, ${due}` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: 14, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: first ? 0 : 1, borderTopColor: colors.separator, borderLeftWidth: 5, borderLeftColor: edge })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: look.wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={19} color={look.ink} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }} numberOfLines={1}>{r.vendorName ?? 'Hộ kinh doanh'}</Text>
          <Text style={[text.footnote, { fontFamily: fonts.semibold, color: look.ink }]}>{reportTypeLabel(r.reportType)}</Text>
        </View>
        <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>{r.reason}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {r.slotCode ? <Plate code={r.slotCode} /> : null}
          <StatusPill label={s.label} tone={s.tone} />
          {r.hasPhoto ? <Icon sf="photo.fill" md="image" size={15} color={colors.muted} /> : null}
        </View>
        {due ? <Text style={[text.caption, tabular, { color: r.isOverdue ? colors.onDanger : colors.onMango }]}>{due}</Text> : null}
        <Text style={[text.caption, tabular, { color: colors.muted }]}>{`Gửi ${formatVietnamDateTime(r.createdAt)}`}</Text>
      </View>
      <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} style={{ marginTop: 16 }} />
    </Pressable>
  );
}

function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ gap: 2, marginTop: 6 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
      {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
    </View>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>{children}</View>;
}

type Action = ResolveChoice | 'VIOLATION';

/**
 * W-Phản ánh, chi tiết (WARD-19): the report, its photo (only the ward sees it), the price evidence
 * the server computed for an overcharge, how many reports this vendor had in 90 days (context only,
 * never a score), the system's checks and the [AI] reading of the photo (advice only). Then the
 * officer closes it one of three ways: "Bác" with a reason the reporter will read, "Đã hòa giải"
 * with a note and an optional refund no larger than the amount charged, or "Lập biên bản" in the
 * patrol's record form, prefilled from this report. Nothing is decided automatically (BR-41/43).
 */
export function WardReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportId = Number(id);
  const cache = useQueryClient();
  const key = wardReportKeys.detail(reportId);
  const detail = useQuery({ queryKey: key, queryFn: () => wardReportsApi.get(reportId), enabled: Number.isSafeInteger(reportId) && reportId > 0 });
  const [action, setAction] = useState<Action>('DISMISSED');
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState('');
  const [errors, setErrors] = useState<{ note?: string; refund?: string }>({});
  const apply = (next: WardVendorReport) => {
    cache.setQueryData(key, next);
    void cache.invalidateQueries({ queryKey: [...wardReportKeys.all, 'list'] });
    void cache.invalidateQueries({ queryKey: ['ward', 'dashboard'] });
  };
  const assist = useMutation({
    mutationFn: () => wardReportsApi.assist(reportId),
    onSuccess: (next) => cache.setQueryData(key, next),
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const resolve = useMutation({
    mutationFn: (outcome: ResolveChoice) => {
      const d = detail.data!;
      const amount = outcome === 'MEDIATED' && refund.trim() ? Number(refund.trim()) : undefined;
      return wardReportsApi.resolve(reportId, { expectedStatus: d.status, outcome, note: note.trim(), ...(amount != null ? { refundAmount: amount } : {}) });
    },
    onSuccess: (next, outcome) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      apply(next);
      setNote('');
      setRefund('');
      showToast(outcome === 'DISMISSED' ? 'Đã bác phản ánh. Người phản ánh nhận thông báo kèm lý do.' : 'Đã ghi nhận hòa giải. Người phản ánh và người bán nhận thông báo.');
    },
    onError: (e) => {
      showToast(errorMessage(e), 'error');
      // 409: another officer closed it first; show where it stands now.
      if (e instanceof ApiError && e.status === 409) void detail.refetch();
    },
  });

  if (detail.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Phản ánh' }} />
        <Skeleton height={88} radius={radius.card} />
        <Skeleton height={260} radius={radius.pass} />
        <ListSkeleton rows={2} height={110} />
      </Screen>
    );
  }
  if (detail.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Phản ánh' }} />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  const d = detail.data;
  const s = reportStatusLabel({ status: d.status, resolution: d.outcome?.resolution, isOverdue: d.isOverdue });
  const pending = d.status === 'PENDING';
  const look = typeLook(d.reportType);
  const e = d.priceEvidence;
  const a = d.assist;

  const submit = () => {
    if (action === 'VIOLATION') return go(`/ward/patrol/violations/new?sourceReportId=${d.reportId}`);
    const next = resolveErrors(action, note, refund, e?.chargedAmount);
    setErrors(next);
    if (next.note || next.refund) return;
    const amount = action === 'MEDIATED' && refund.trim() ? Number(refund.trim()) : null;
    Alert.alert(
      action === 'DISMISSED' ? `Bác phản ánh #${d.reportId}?` : `Ghi nhận đã hòa giải phản ánh #${d.reportId}?`,
      action === 'DISMISSED'
        ? 'Phản ánh được đóng. Người phản ánh nhận thông báo kèm lý do bạn ghi; người bán nhận thông báo đã đóng.'
        : `Phản ánh được đóng là đã hòa giải${amount ? `, khách được hoàn ${formatVnd(amount)}` : ''}. Người phản ánh và người bán nhận thông báo.`,
      [
        { text: 'Quay lại', style: 'cancel' },
        { text: action === 'DISMISSED' ? 'Bác phản ánh' : 'Ghi nhận', style: action === 'DISMISSED' ? 'destructive' : 'default', onPress: () => resolve.mutate(action) },
      ],
    );
  };

  return (
    <Screen onRefresh={() => void detail.refetch()} refreshing={detail.isRefetching}>
      <Stack.Screen options={{ title: `Phản ánh #${d.reportId}` }} />
      <StatusHeader
        tone={s.tone}
        title={s.label}
        detail={
          pending
            ? d.dueAt
              ? `${d.isOverdue ? 'Quá hạn từ' : 'Hạn xử lý'} ${formatVietnamDateTime(d.dueAt)}. Hạn nội bộ của phường, không phải hạn luật định.`
              : undefined
            : d.outcome?.reviewedAt
              ? `${d.outcome.reviewedByName ? `${d.outcome.reviewedByName}, ` : ''}${formatVietnamDateTime(d.outcome.reviewedAt)}`
              : undefined
        }
      />

      {/* The report as it came in */}
      <Pass
        accent={look.ink}
        head={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon sf={typeIcon(d.reportType).sf} md={typeIcon(d.reportType).md} size={16} color={look.ink} />
              <Text style={[text.subhead, { flex: 1, color: look.ink }]}>{reportTypeLabel(d.reportType)}</Text>
              {d.slotCode ? <Plate code={d.slotCode} /> : null}
            </View>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{d.vendorName ?? 'Hộ kinh doanh'}</Text>
            <Text style={[text.callout, { color: colors.ink }]}>{d.reason}</Text>
          </View>
        }
        stub={
          <View style={{ gap: 12 }}>
            <KeyValueList
              rows={[
                { label: 'Gửi lúc', value: formatVietnamDateTime(d.createdAt) },
                d.scannedPermitId ? { label: 'Giấy phép đã quét', value: `#${d.scannedPermitId}` } : null,
                d.aiExtractedLocation ? { label: 'Nơi nhận ra từ ảnh', value: `[AI] ${d.aiExtractedLocation}` } : null,
                { label: 'Phản ánh về người bán (90 ngày)', value: String(d.reportsAgainstVendor90Days) },
              ]}
            />
            <Text style={[text.caption, { fontFamily: fonts.regular, color: colors.muted }]}>Số phản ánh 90 ngày chỉ để tham khảo, không phải điểm và không là căn cứ xử lý.</Text>
            {d.evidenceUrl ? (
              <View style={{ flexDirection: 'row' }}>
                <ProtectedFileTile fileUrl={d.evidenceUrl} label="Ảnh người phản ánh gửi" />
              </View>
            ) : null}
          </View>
        }
      />

      {e ? (
        <>
          <Heading title="Bằng chứng giá" note="Máy chủ tính từ lịch sử bảng giá tại thời điểm mua; khách không tự khai giá niêm yết." />
          <Panel>
            <KeyValueList
              rows={[
                { label: 'Món', value: e.itemName },
                { label: 'Giá niêm yết lúc mua', value: `${formatVnd(e.postedUnitPrice)} / ${e.priceUnit}` },
                { label: 'Bảng giá', value: `Bản số ${e.priceVersion}, ${formatVietnamDateTime(e.priceVersionAt)}` },
                { label: 'Lúc mua', value: formatVietnamDateTime(e.purchasedAt) },
                { label: 'Niêm yết × số lượng', value: `${formatVnd(e.postedUnitPrice)} × ${e.quantity} = ${formatVnd(e.postedAmount)}` },
                { label: 'Khách bị tính', value: formatVnd(e.chargedAmount), emphasis: true },
                {
                  label: 'Chênh lệch',
                  value: <Text style={[sign.price, tabular, { color: colors.danger }]}>{`+${formatVnd(e.difference)}`}</Text>,
                },
              ]}
            />
          </Panel>
        </>
      ) : null}

      {/* The system's checks: computed from the records, not AI */}
      {a.flags.length > 0 || a.permitCheck ? (
        <>
          <Heading title="Ghi chú của hệ thống" note="Đối chiếu từ hồ sơ giấy phép và hợp đồng." />
          <Panel>
            {a.flags.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {a.flags.map((f) => {
                  const fl = FLAG_LABELS[f] ?? { label: f, tone: 'neutral' as StatusTone };
                  return <StatusPill key={f} label={fl.label} tone={fl.tone} />;
                })}
              </View>
            ) : null}
            <Text style={[text.footnote, { color: colors.ink }]}>{a.permitCheck ? permitSentence(a.permitCheck) : 'Phản ánh này không kèm mã QR giấy phép nào đã quét.'}</Text>
          </Panel>
        </>
      ) : null}

      {/* [AI] reading of the photo (AIB-01): advice only */}
      {a.aiAvailable ? (
        <AiSuggestionCard title="Đọc từ ảnh" aiLogId={a.aiLogId}>
          {a.signageText ? <Text style={[text.footnote, { color: colors.ink }]}>{`Chữ trên biển hiệu: ${a.signageText}`}</Text> : null}
          {a.locationText ? <Text style={[text.footnote, { color: colors.ink }]}>{`Nơi nhận ra: ${a.locationText}`}</Text> : null}
          {a.permitVisible ? <Text style={[text.footnote, { color: colors.ink }]}>{PERMIT_VISIBLE_LABELS[a.permitVisible] ?? a.permitVisible}</Text> : null}
          {a.description ? <Text style={[text.footnote, { color: colors.ink }]}>{a.description}</Text> : null}
          {a.generatedAt ? <Text style={[text.caption, { color: colors.onMango }]}>{`Đọc lúc ${formatVietnamDateTime(a.generatedAt)}`}</Text> : null}
        </AiSuggestionCard>
      ) : d.evidenceUrl ? (
        <Text style={[text.footnote, { color: colors.muted }]}>Chưa có phân tích từ ảnh. Bạn có thể nhờ [AI] đọc ảnh để tham khảo.</Text>
      ) : null}
      {d.evidenceUrl ? (
        <Button label={a.aiAvailable ? '[AI] Đọc lại ảnh' : '[AI] Phân tích ảnh'} variant="secondary" icon={{ sf: 'sparkles', md: 'auto_awesome' }} loading={assist.isPending} onPress={() => assist.mutate()} />
      ) : null}
      <Text style={[text.caption, { fontFamily: fonts.regular, color: colors.muted }]}>{a.disclaimer}</Text>

      {pending ? (
        <>
          <Heading title="Xử lý phản ánh" note="Bạn là người quyết định. Người phản ánh nhận thông báo kết quả." />
          <Segments<Action>
            value={action}
            onChange={(next) => {
              setAction(next);
              setErrors({});
            }}
            options={[
              { key: 'DISMISSED', label: 'Bác' },
              { key: 'MEDIATED', label: 'Đã hòa giải' },
              { key: 'VIOLATION', label: 'Lập biên bản' },
            ]}
          />
          <Panel>
            {action === 'DISMISSED' ? (
              <TextField
                label="Lý do bác"
                value={note}
                onChangeText={(v) => {
                  setNote(v.slice(0, NOTE_MAX));
                  setErrors((x) => ({ ...x, note: undefined }));
                }}
                multiline
                placeholder="Viết để người phản ánh đọc hiểu, VD: Đã kiểm tra tại quầy, giá bán đúng bảng giá niêm yết."
                hint={`${note.trim().length}/${NOTE_MAX} ký tự. Người phản ánh sẽ đọc lý do này.`}
                error={errors.note}
              />
            ) : action === 'MEDIATED' ? (
              <>
                <TextField
                  label="Ghi chú hòa giải"
                  value={note}
                  onChangeText={(v) => {
                    setNote(v.slice(0, NOTE_MAX));
                    setErrors((x) => ({ ...x, note: undefined }));
                  }}
                  multiline
                  placeholder="VD: Người bán đã xin lỗi và hoàn phần chênh lệch cho khách."
                  hint={`${note.trim().length}/${NOTE_MAX} ký tự`}
                  error={errors.note}
                />
                <TextField
                  label="Số tiền hoàn cho khách"
                  optional
                  value={refund}
                  onChangeText={(v) => {
                    setRefund(v.replace(/[^0-9]/g, '').slice(0, 10));
                    setErrors((x) => ({ ...x, refund: undefined }));
                  }}
                  keyboardType="number-pad"
                  trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>}
                  hint={e ? `Không vượt số tiền khách bị tính (${formatVnd(e.chargedAmount)}). Chênh lệch: ${formatVnd(e.difference)}.` : refund ? formatVnd(Number(refund)) : undefined}
                  error={errors.refund}
                />
                {e ? <Chip label={`Hoàn đúng chênh lệch ${formatVnd(e.difference)}`} icon={{ sf: 'plus', md: 'add' }} onPress={() => setRefund(String(e.difference))} /> : null}
              </>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={[text.callout, { color: colors.ink }]}>
                  Mở màn lập biên bản đã điền sẵn người bán, ô, mô tả, ảnh và loại vi phạm gợi ý
                  {d.suggestedViolationType ? ` (${d.suggestedViolationType === 'PRICE_ABOVE_POSTED' ? 'bán cao hơn giá niêm yết' : d.suggestedViolationType === 'PRICE_NOT_POSTED' ? 'không niêm yết giá' : d.suggestedViolationType})` : ''}.
                </Text>
                <Text style={[text.footnote, { color: colors.muted }]}>Khi lưu biên bản, phản ánh này được đóng là “Đã lập biên bản” cùng lúc. Mỗi phản ánh chỉ lập một biên bản.</Text>
              </View>
            )}
            <Button
              label={action === 'DISMISSED' ? 'Bác phản ánh' : action === 'MEDIATED' ? 'Ghi nhận đã hòa giải' : 'Mở biên bản vi phạm'}
              variant={action === 'DISMISSED' ? 'danger' : action === 'VIOLATION' ? 'sign' : 'primary'}
              size={56}
              icon={action === 'DISMISSED' ? { sf: 'xmark.circle.fill', md: 'cancel' } : action === 'MEDIATED' ? { sf: 'hands.clap.fill', md: 'handshake' } : { sf: 'doc.badge.plus', md: 'gavel' }}
              loading={resolve.isPending}
              disabled={resolve.isPending}
              onPress={submit}
            />
          </Panel>
        </>
      ) : d.outcome ? (
        <>
          <Heading title="Kết quả xử lý" />
          <Panel>
            <KeyValueList
              rows={[
                { label: 'Kết quả', value: s.label, emphasis: true },
                d.outcome.refundAmount ? { label: 'Hoàn cho khách', value: formatVnd(d.outcome.refundAmount) } : null,
                d.outcome.reviewedByName ? { label: 'Cán bộ', value: d.outcome.reviewedByName } : null,
                d.outcome.reviewedAt ? { label: 'Lúc', value: formatVietnamDateTime(d.outcome.reviewedAt) } : null,
              ]}
            />
            {d.outcome.note ? (
              <View style={{ gap: 4 }}>
                <Text style={[text.caption, { color: colors.muted }]}>{d.outcome.resolution === 'DISMISSED' ? 'Lý do (người phản ánh đọc được)' : d.outcome.resolution === 'VIOLATION_RECORDED' ? 'Biên bản' : 'Ghi chú hòa giải'}</Text>
                <Text style={[text.callout, { color: colors.ink }]}>{d.outcome.note}</Text>
              </View>
            ) : null}
            {d.violationId ? <Button label="Xem biên bản" variant="secondary" icon={{ sf: 'doc.plaintext.fill', md: 'article' }} onPress={() => go(`/ward/patrol/violations/${d.violationId}`)} /> : null}
          </Panel>
        </>
      ) : (
        <Banner tone="neutral">Phản ánh đã được xem xét trước khi có bước đóng phản ánh.</Banner>
      )}
    </Screen>
  );
}
