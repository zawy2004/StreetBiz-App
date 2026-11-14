import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Card, KeyValueList, StatTile } from '@/components/common/Blocks';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate, Section } from '@/ui';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { Blockers, DecisionDesk, RecordedDecision } from '../components/ReviewParts';
import { complianceApi } from '../ward-api';

type Busy = 'APPROVE' | 'REJECT' | 'MORE_INFO' | null;

function useDecide() {
  const cache = useQueryClient();
  const [busy, setBusy] = useState<Busy>(null);
  const run = async (kind: Exclude<Busy, null>, call: () => Promise<unknown>, done: string) => {
    setBusy(kind);
    try {
      await call();
      showToast(done);
      await cache.invalidateQueries({ queryKey: ['ward'] });
      router.back();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

/** Skeleton in the shape of the review: name, the slot drawing, the fee card, the desk. */
function Loading({ title }: { title: string }) {
  return (
    <Screen gap={20}>
      <Stack.Screen options={{ title }} />
      <View style={{ gap: 8 }}>
        <Skeleton width="65%" height={30} />
        <Skeleton width="45%" height={16} />
      </View>
      <Skeleton height={210} radius={radius.card} />
      <Skeleton height={180} radius={radius.card} />
      <Skeleton height={240} radius={radius.card} />
    </Screen>
  );
}

function Failed({ title, error, retry }: { title: string; error: unknown; retry: () => void }) {
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <ErrorState error={error} onRetry={retry} />
    </Screen>
  );
}

/** Who asked: the name large, then the facts on their own lines (no dotted chains). */
function Applicant({ name, lines, pills }: { name: string; lines: string[]; pills: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={[text.title1, { color: colors.ink }]}>{name}</Text>
      {lines.map((l) => (
        <Text key={l} style={[text.callout, { color: colors.muted }, tabular]}>{l}</Text>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>{pills}</View>
    </View>
  );
}

const metres = (v: number) => `${String(v).replace('.', ',')} m`;

/**
 * The slot seen from above, the way the ward draws its pavement: a strip of pavement over the
 * painted kerb, the bay as a dashed orange outline in its real proportions (width along the
 * kerb, depth toward the shops), the slot's plate in the middle and its measures on the edges.
 */
function SlotBay({ code, street, width, length }: { code: string; street: string; width: number; length: number }) {
  // The bay is drawn 112 deep; its width keeps the real ratio within what a phone can show.
  const depth = 112;
  const across = Math.round(Math.min(Math.max((depth * Math.max(width, 0.1)) / Math.max(length, 0.1), 96), 200));
  return (
    <View accessible accessibilityLabel={`Ô ${code}, ${street}. Rộng ${metres(width)}, sâu ${metres(length)}`} style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon sf="mappin.and.ellipse" md="location_on" size={18} color={colors.primary} />
        <Text style={[text.headline, { flex: 1, color: colors.ink }]}>{street}</Text>
      </View>
      {/* The pavement (shops at the top, the road under the kerb) */}
      <View style={{ backgroundColor: colors.sunken, alignItems: 'center', paddingTop: 22, paddingBottom: 34 }}>
        <View style={{ width: across, minHeight: depth, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.plate, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.brand, backgroundColor: 'rgba(255, 106, 31, 0.10)' }} />
          <Plate code={code} />
          {/* Width along the kerb */}
          <Text maxFontSizeMultiplier={1.3} style={[sign.price, tabular, { position: 'absolute', top: '100%', marginTop: 6, color: colors.ink }]}>{metres(width)}</Text>
          {/* Depth toward the shops */}
          <Text maxFontSizeMultiplier={1.3} style={[sign.price, tabular, { position: 'absolute', left: '100%', marginLeft: 8, color: colors.ink }]}>{metres(length)}</Text>
        </View>
      </View>
      <KerbStrip height={10} segment={22} />
      <View style={{ minHeight: 22, backgroundColor: colors.muted }} />
    </View>
  );
}

/** W04 Thẩm định cấp phép thuê ô (WARD-07/08, BR-16/17): approval creates the contract, permit and fee schedule. */
export function RentalApplicationReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['ward', 'rental-application', id], queryFn: () => complianceApi.getRentalApplication(id!), enabled: Boolean(id) });
  const [reason, setReason] = useState('');
  const { busy, run } = useDecide();
  const title = 'Thẩm định thuê ô';
  if (detail.isPending) return <Loading title={title} />;
  if (detail.isError) return <Failed title={title} error={detail.error} retry={() => void detail.refetch()} />;
  const d = detail.data;
  const open = ['PENDING', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'].includes(d.status);
  const s = statusLabel(d.status);
  const decide = (kind: 'APPROVE' | 'REJECT') => {
    if (kind === 'REJECT' && !reason.trim()) return showToast('Nhập lý do từ chối.', 'error');
    if (kind === 'APPROVE' && !d.canApprove) return showToast(d.blockers[0] ?? 'Chưa đủ điều kiện cấp phép.', 'error');
    void run(kind, () => complianceApi.decideRentalApplication(id!, kind, reason.trim() || 'Đủ điều kiện cấp Giấy phép sử dụng tạm thời lòng đường, vỉa hè', d.status), kind === 'APPROVE' ? 'Đã duyệt: hợp đồng, giấy phép QR và lịch thu phí đã được tạo' : 'Đã từ chối cấp phép');
  };
  const reg = statusLabel(d.registrationStatus);
  return (
    <Screen gap={22}>
      <Stack.Screen options={{ title }} />
      <Applicant
        name={d.vendorName}
        lines={[d.vendorPhone, d.applicationMethod === 'AUTO_ADJACENT' ? 'Ô liền kề mặt tiền' : 'Ô mở']}
        pills={<StatusPill label={s.label} tone={s.tone} />}
      />

      <SlotBay code={d.slotCode} street={d.slotStreet} width={d.slotWidth} length={d.slotLength} />

      {/* What approving bills, the total in sign figures */}
      <Card style={{ padding: 18, gap: 4 }}>
        {d.totalFee != null ? (
          <View style={{ gap: 2, paddingBottom: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.muted }}>Tổng thu khi duyệt</Text>
            <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: colors.primary }]}>{formatVnd(d.totalFee)}</Text>
          </View>
        ) : null}
        <KeyValueList
          rows={[
            { label: 'Thời hạn đề nghị', value: `${d.requestedTermDays} ngày` },
            { label: 'Đơn giá', value: `${formatVnd(d.pricePerDay)}/ngày` },
            d.rentFee != null ? { label: 'Tiền thuê (đã trừ giảm)', value: formatVnd(d.rentFee) } : null,
            d.deposit ? { label: 'Tiền cọc (hoàn lại)', value: formatVnd(d.deposit) } : null,
            { label: 'Hồ sơ đăng ký', value: `#${d.registrationId}, ${reg.label}` },
            { label: 'Nộp lúc', value: formatVietnamDateTime(d.createdAt) },
          ]}
        />
      </Card>

      <Blockers items={d.blockers} />
      {open ? (
        <DecisionDesk reason={reason} setReason={setReason} busy={busy} approveLabel="Duyệt & cấp phép số" canApprove={d.canApprove} onApprove={() => decide('APPROVE')} onReject={() => decide('REJECT')} />
      ) : (
        <RecordedDecision status={d.status} reason={d.reviewReason} by={d.reviewedBy} at={d.reviewedAt} />
      )}
    </Screen>
  );
}

/**
 * The term as a ruler: the days still left on the contract (grey) then the days asked for
 * (orange), the two end dates under the ends and "+N ngày" painted large.
 */
function TermRuler({ code, street, remaining, added, currentEnd, proposedEnd }: { code: string; street: string; remaining: number; added: number; currentEnd: string; proposedEnd: string }) {
  const left = Math.max(remaining, 0);
  const plus = Math.max(added, 1);
  return (
    <View
      accessible
      accessibilityLabel={`Ô ${code}. Còn ${left} ngày, hết hạn ${formatVietnamDate(currentEnd)}. Gia hạn thêm ${added} ngày, hết hạn mới ${formatVietnamDate(proposedEnd)}`}
      style={{ padding: 18, gap: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Plate code={code} />
        <Text numberOfLines={2} style={[text.subhead, { flex: 1, color: colors.ink }]}>{street}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Text maxFontSizeMultiplier={1.3} style={[sign.figure, tabular, { color: colors.primary }]}>+{added}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 34, color: colors.primary }}>ngày</Text>
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', height: 14, borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.sunken }}>
          {left > 0 ? <View style={{ flex: left, backgroundColor: colors.line }} /> : null}
          <View style={{ width: 3, backgroundColor: colors.card }} />
          <View style={{ flex: plus, backgroundColor: colors.brand }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ gap: 1 }}>
            <Text style={[text.caption, { color: colors.muted }]}>Hết hạn hiện tại</Text>
            <Text style={[text.subhead, tabular, { color: colors.ink }]}>{formatVietnamDate(currentEnd)}</Text>
            <Text style={[text.caption, tabular, { color: colors.muted }]}>còn {left} ngày</Text>
          </View>
          <View style={{ gap: 1, alignItems: 'flex-end' }}>
            <Text style={[text.caption, { color: colors.primary }]}>Hết hạn mới (dự kiến)</Text>
            <Text style={[text.subhead, tabular, { color: colors.primary, fontFamily: fonts.heavy }]}>{formatVietnamDate(proposedEnd)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** W05 Thẩm định gia hạn (WARD-09): the vendor's record on this contract, the new term and fee. */
export function RenewalReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['ward', 'renewal', id], queryFn: () => complianceApi.getRenewal(id!), enabled: Boolean(id) });
  const [reason, setReason] = useState('');
  const { busy, run } = useDecide();
  const title = 'Thẩm định gia hạn';
  if (detail.isPending) return <Loading title={title} />;
  if (detail.isError) return <Failed title={title} error={detail.error} retry={() => void detail.refetch()} />;
  const d = detail.data;
  const open = d.status === 'PENDING' || d.status === 'UNDER_REVIEW';
  const s = statusLabel(d.status);
  const sc = d.scorecard;
  const decide = (kind: 'APPROVE' | 'REJECT') => {
    if (kind === 'REJECT' && !reason.trim()) return showToast('Nhập lý do từ chối gia hạn.', 'error');
    if (kind === 'APPROVE' && !d.canApprove) return showToast(d.blockers[0] ?? 'Chưa đủ điều kiện gia hạn.', 'error');
    void run(kind, () => complianceApi.decideRenewal(id!, kind, reason.trim() || 'Đủ điều kiện gia hạn hợp đồng sử dụng tạm thời hè phố', d.status), kind === 'APPROVE' ? 'Đã duyệt gia hạn: hợp đồng và giấy phép đã cập nhật thời hạn mới' : 'Đã từ chối gia hạn');
  };
  return (
    <Screen gap={22}>
      <Stack.Screen options={{ title }} />
      <Applicant
        name={d.vendorName}
        lines={[d.vendorPhone, `Hợp đồng #${d.contractId}`]}
        pills={
          <>
            <StatusPill label={s.label} tone={s.tone} />
            {d.isFastTrackEligible ? <StatusPill label="[AI] Đủ điều kiện xét nhanh" tone="ok" /> : null}
            {d.isOverdue ? <StatusPill label="Quá hạn xử lý" tone="danger" /> : null}
          </>
        }
      />

      <TermRuler code={d.slotCode} street={d.slotStreet} remaining={d.remainingDaysOnCurrentContract} added={d.requestedTermDays} currentEnd={d.currentEndDate} proposedEnd={d.proposedEndDate} />

      <Card style={{ padding: 18 }}>
        <KeyValueList
          rows={[
            { label: 'Đơn giá', value: `${formatVnd(d.pricePerDay)}/ngày` },
            { label: 'Phí dự tính', value: formatVnd(d.totalEstimatedFee), emphasis: true },
            { label: 'Hạn xử lý', value: formatVietnamDateTime(d.slaDueAt) },
          ]}
        />
      </Card>

      <Section title="Hồ sơ tuân thủ" inset={0}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile value={String(sc.totalInspections)} label="Lần kiểm tra" icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} tone="sign" />
            <StatTile value={String(sc.violationCount)} label="Vi phạm" icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} tone={sc.violationCount > 0 ? 'warn' : 'ink'} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile value={String(sc.unpaidPenaltyCount)} label="Phạt chưa nộp" icon={{ sf: 'banknote.fill', md: 'payments' }} tone={sc.unpaidPenaltyCount > 0 ? 'warn' : 'ink'} />
            <StatTile value={String(sc.reportCount)} label="Phản ánh" icon={{ sf: 'megaphone.fill', md: 'campaign' }} tone={sc.reportCount > 0 ? 'warn' : 'ink'} />
          </View>
        </View>
      </Section>
      {sc.isCleanRecord ? <StatusHeader tone="ok" title="Không có vi phạm hay phạt chưa nộp trong hợp đồng này." /> : null}

      <Blockers items={d.blockers} />
      {open ? (
        <DecisionDesk reason={reason} setReason={setReason} busy={busy} approveLabel="Duyệt gia hạn" canApprove={d.canApprove} onApprove={() => decide('APPROVE')} onReject={() => decide('REJECT')} />
      ) : (
        <RecordedDecision status={d.status} reason={d.reviewReason} by={d.reviewedBy} at={d.reviewedAt} />
      )}
    </Screen>
  );
}
