import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, KeyValueList, SectionHeader } from '@/components/common/Blocks';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, tabular, text } from '@/theme';
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

function Loading({ title }: { title: string }) {
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <ListSkeleton rows={1} height={200} />
      <ListSkeleton rows={3} height={80} />
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
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy }]}>{d.vendorName}</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{d.vendorPhone} · {d.applicationMethod === 'AUTO_ADJACENT' ? 'Ô liền kề mặt tiền' : 'Ô mở'}</Text>
          </View>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SlotPlate code={d.slotCode} />
          <Text style={[text.footnote, { color: colors.ink }]}>{d.slotStreet}</Text>
        </View>
      </Card>
      <Card>
        <KeyValueList
          rows={[
            { label: 'Kích thước ô', value: `${d.slotWidth} × ${d.slotLength} m` },
            { label: 'Thời hạn đề nghị', value: `${d.requestedTermDays} ngày` },
            { label: 'Đơn giá', value: `${formatVnd(d.pricePerDay)}/ngày` },
            d.rentFee != null ? { label: 'Tiền thuê (đã trừ giảm)', value: formatVnd(d.rentFee) } : null,
            d.deposit ? { label: 'Tiền cọc (hoàn lại)', value: formatVnd(d.deposit) } : null,
            d.totalFee != null ? { label: 'Tổng thu khi duyệt', value: formatVnd(d.totalFee), emphasis: true } : null,
            { label: 'Hồ sơ đăng ký', value: `#${d.registrationId} · ${statusLabel(d.registrationStatus).label}` },
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
    <Screen>
      <Stack.Screen options={{ title }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy }]}>{d.vendorName}</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{d.vendorPhone} · HĐ #{d.contractId}</Text>
          </View>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <SlotPlate code={d.slotCode} />
          {d.isFastTrackEligible ? <StatusPill label="[AI] Đủ điều kiện xét nhanh" tone="ok" /> : null}
          {d.isOverdue ? <StatusPill label="Quá hạn xử lý" tone="danger" /> : null}
        </View>
      </Card>
      <Card>
        <KeyValueList
          rows={[
            { label: 'Hết hạn hiện tại', value: formatVietnamDate(d.currentEndDate) },
            { label: 'Gia hạn thêm', value: `${d.requestedTermDays} ngày` },
            { label: 'Hết hạn mới (dự kiến)', value: formatVietnamDate(d.proposedEndDate) },
            { label: 'Còn lại trên HĐ', value: `${d.remainingDaysOnCurrentContract} ngày` },
            { label: 'Đơn giá', value: `${formatVnd(d.pricePerDay)}/ngày` },
            { label: 'Phí dự tính', value: formatVnd(d.totalEstimatedFee), emphasis: true },
            { label: 'Hạn xử lý', value: formatVietnamDateTime(d.slaDueAt) },
          ]}
        />
      </Card>
      <SectionHeader title="Hồ sơ tuân thủ" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Lần kiểm tra" value={sc.totalInspections} />
        <Stat label="Vi phạm" value={sc.violationCount} warn={sc.violationCount > 0} />
        <Stat label="Phạt chưa nộp" value={sc.unpaidPenaltyCount} warn={sc.unpaidPenaltyCount > 0} />
        <Stat label="Phản ánh" value={sc.reportCount} warn={sc.reportCount > 0} />
      </View>
      {sc.isCleanRecord ? <Banner tone="success">Không có vi phạm hay phạt chưa nộp trong hợp đồng này.</Banner> : null}
      <Blockers items={d.blockers} />
      {open ? (
        <DecisionDesk reason={reason} setReason={setReason} busy={busy} approveLabel="Duyệt gia hạn" canApprove={d.canApprove} onApprove={() => decide('APPROVE')} onReject={() => decide('REJECT')} />
      ) : (
        <RecordedDecision status={d.status} reason={d.reviewReason} by={d.reviewedBy} at={d.reviewedAt} />
      )}
    </Screen>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={{ flex: 1, padding: 10, gap: 2, borderRadius: 14, borderCurve: 'continuous', backgroundColor: warn ? colors.mangoTint : colors.card, alignItems: 'center' }}>
      <Text style={[{ fontFamily: fonts.code, fontSize: 22, color: warn ? colors.onMango : colors.ink }, tabular]}>{value}</Text>
      <Text style={[text.caption, { color: warn ? colors.onMango : colors.muted, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

