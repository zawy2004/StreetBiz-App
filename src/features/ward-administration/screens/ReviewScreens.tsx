import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, KeyValueList, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap } from '@/components/map/LeafletMap';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, tabular, text } from '@/theme';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { AiSuggestionCard, Blockers, DecisionDesk, RecordedDecision } from '../components/ReviewParts';
import { useRegistrationIntegrity } from '../ward-integrity-api';
import { complianceApi, evidenceLabels, type WardEnrollmentDetail } from '../ward-api';

type Busy = 'APPROVE' | 'REJECT' | 'MORE_INFO' | null;
const OPEN = ['SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'];

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

/**
 * W03 Thẩm định hồ sơ đăng ký (WARD-05, BR-41): who the applicant is, the documents, the
 * server's eKYC checks and integrity findings, an [AI] CCCD read, then the officer's own
 * identity confirmation — required before approval — and the decision.
 */
export function RegistrationReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cache = useQueryClient();
  const detail = useQuery({ queryKey: ['ward', 'enrollment', id], queryFn: () => complianceApi.getEnrollment(id!), enabled: Boolean(id) });
  const integrity = useRegistrationIntegrity(id);
  const [reason, setReason] = useState('');
  const [identityNote, setIdentityNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [ocr, setOcr] = useState<WardEnrollmentDetail['aiCheck']>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const { busy, run } = useDecide();
  const title = 'Thẩm định đăng ký';
  if (detail.isPending) return <Loading title={title} />;
  if (detail.isError) return <Failed title={title} error={detail.error} retry={() => void detail.refetch()} />;
  const d = detail.data;
  const open = OPEN.includes(d.status);
  const ai = ocr ?? d.aiCheck;
  const s = statusLabel(d.status);
  const owner = d.ownerProfile;
  const biz = d.businessProfile;

  const confirmIdentity = async () => {
    if (!identityNote.trim()) return showToast('Ghi ngắn gọn cách bạn đã đối chiếu CCCD.', 'error');
    setConfirming(true);
    try {
      const updated = await complianceApi.confirmIdentity(id!, identityNote.trim());
      cache.setQueryData(['ward', 'enrollment', id], updated);
      showToast('Đã ghi nhận xác nhận đối chiếu CCCD thủ công');
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setConfirming(false);
    }
  };
  const runOcr = async () => {
    setOcrBusy(true);
    try {
      const r = await complianceApi.aiDocumentExtract(id!);
      setOcr(r);
      if (!r.isAiGenerated) showToast(r.summary || 'Không đối soát được CCCD', 'info');
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setOcrBusy(false);
    }
  };
  const decide = (kind: Exclude<Busy, null>) => {
    if ((kind === 'REJECT' || kind === 'MORE_INFO') && !reason.trim()) return showToast('Nhập lý do quyết định.', 'error');
    if (kind === 'APPROVE' && !d.identityVerified) return showToast('Phải xác nhận đã đối chiếu CCCD thủ công trước khi duyệt.', 'error');
    const decision = kind === 'MORE_INFO' ? 'MORE_INFORMATION_REQUIRED' : kind;
    void run(kind, () => complianceApi.decideEnrollment(id!, decision, reason.trim() || 'Hồ sơ đủ điều kiện', d.status), kind === 'APPROVE' ? 'Đã duyệt hồ sơ đăng ký' : kind === 'MORE_INFO' ? 'Đã yêu cầu bổ sung giấy tờ' : 'Đã từ chối hồ sơ');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy }]}>{d.displayName || d.ownerName}</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{d.vendorType === 'FIXED_STOREFRONT' ? 'Cửa hàng cố định' : 'Hàng rong lưu động'} · Hồ sơ #{d.id}</Text>
          </View>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        {d.fastTrack ? <StatusPill label="Ưu tiên xét nhanh" tone="ok" /> : null}
        <Text style={[text.caption, { color: colors.muted }]}>Nộp {formatVietnamDateTime(d.createdAt)}</Text>
      </Card>

      {integrity.data && integrity.data.flags.length > 0 ? (
        <Banner tone={integrity.data.level === 'HIGH' ? 'danger' : 'warning'} title="Dấu hiệu cần xem kỹ">
          {integrity.data.flags.map((f) => `• ${f.title}: ${f.detail}`).join('\n')}
        </Banner>
      ) : null}

      <SectionHeader title="Chủ hộ" />
      <Card>
        <KeyValueList
          rows={[
            { label: 'Họ tên', value: d.ownerName },
            d.idNumber ? { label: 'Số CCCD', value: d.idNumber, mono: true } : null,
            owner.dateOfBirth ? { label: 'Ngày sinh', value: formatVietnamDate(owner.dateOfBirth) } : null,
            owner.gender ? { label: 'Giới tính', value: owner.gender === 'MALE' ? 'Nam' : owner.gender === 'FEMALE' ? 'Nữ' : owner.gender } : null,
            owner.idIssuedDate ? { label: 'Ngày cấp', value: `${formatVietnamDate(owner.idIssuedDate)}${owner.idIssuedPlace ? ` · ${owner.idIssuedPlace}` : ''}` } : null,
            owner.permanentAddress ? { label: 'Thường trú', value: owner.permanentAddress } : null,
            owner.contactAddress ? { label: 'Liên hệ', value: owner.contactAddress } : null,
          ]}
        />
      </Card>
      <SectionHeader title="Điểm kinh doanh" />
      <Card style={{ gap: 10 }}>
        <KeyValueList
          rows={[
            { label: 'Địa chỉ', value: d.address },
            biz.businessLine ? { label: 'Ngành nghề', value: `${biz.businessLine}${biz.businessLineCode ? ` (${biz.businessLineCode})` : ''}` } : null,
            biz.capitalAmount != null ? { label: 'Vốn', value: formatVnd(biz.capitalAmount) } : null,
            biz.laborCount != null ? { label: 'Lao động', value: String(biz.laborCount) } : null,
            biz.plannedStartDate ? { label: 'Dự kiến bắt đầu', value: formatVietnamDate(biz.plannedStartDate) } : null,
            d.foodSafetyCommitmentAt ? { label: 'Cam kết ATTP', value: formatVietnamDate(d.foodSafetyCommitmentAt) } : null,
          ]}
        />
        {d.latitude != null && d.longitude != null ? (
          <View style={{ borderRadius: 14, overflow: 'hidden' }}>
            <LeafletMap center={[d.latitude, d.longitude]} zoom={17} interactive={false} markers={[{ id: 'r', latitude: d.latitude, longitude: d.longitude, label: 'Điểm khai báo', fill: colors.cta, ink: colors.white }]} style={{ height: 140 }} />
          </View>
        ) : null}
      </Card>
      {d.householdMembers.length > 0 ? (
        <>
          <SectionHeader title={`Thành viên hộ (${d.householdMembers.length})`} />
          <Card style={{ gap: 8 }}>
            {d.householdMembers.map((m, i) => (
              <Text key={`${m.fullName}-${i}`} style={[text.footnote, { color: colors.ink }]}>
                {m.fullName}
                {m.relationshipToOwner ? ` · ${m.relationshipToOwner}` : ''}
                {m.idNumber ? ` · ${m.idNumber}` : ''}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Giấy tờ" />
      {d.evidence.length === 0 ? (
        <Text style={[text.footnote, { color: colors.muted }]}>Chưa có giấy tờ đính kèm.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {d.evidence.map((e) => (
            <ProtectedFileTile key={e.evidenceId} fileUrl={e.fileUrl} label={e.label || evidenceLabels[e.type] || e.type} />
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Mẫu 01 (PDF)" variant="secondary" icon={{ sf: 'doc.richtext', md: 'picture_as_pdf' }} onPress={() => void shareProtectedFile(`/ward/enrollments/${d.id}/document?format=pdf`, `DangKyHKD_${d.id}.pdf`, 'application/pdf')} style={{ flex: 1 }} />
        <Button label="Word" variant="secondary" onPress={() => void shareProtectedFile(`/ward/enrollments/${d.id}/document?format=docx`, `DangKyHKD_${d.id}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')} style={{ flex: 1 }} />
      </View>

      {d.kycChecks.length > 0 ? (
        <>
          <SectionHeader title="Kiểm tra eKYC của máy chủ" />
          <Card style={{ gap: 8 }}>
            {d.kycChecks.map((k, i) => (
              <View key={`${k.checkType}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon sf={k.isMatch ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'} md={k.isMatch ? 'check_circle' : 'warning'} size={18} color={k.isMatch ? colors.leaf : colors.mango} />
                <View style={{ flex: 1 }}>
                  <Text style={[text.footnote, { color: colors.ink, fontFamily: fonts.semibold }]}>{k.checkType === 'FACE_MATCH' ? 'Khớp khuôn mặt' : 'Đọc CCCD'}</Text>
                  <Text style={[text.caption, { color: colors.muted }, tabular]}>
                    {k.similarityPercent != null ? `Giống ${k.similarityPercent}% · ` : ''}
                    {k.confidencePercent != null ? `Tin cậy ${k.confidencePercent}% · ` : ''}
                    {formatVietnamDateTime(k.createdAt)}
                  </Text>
                  {k.warnings ? <Text style={[text.caption, { color: colors.onMango }]}>{k.warnings}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {ai ? (
        <AiSuggestionCard title={`Đối soát CCCD · khớp ${ai.matchPercentage}%`} aiLogId={ai.isAiGenerated ? ai.aiLogId : null}>
          <Text style={[text.footnote, { color: colors.ink }]}>{ai.summary}</Text>
          {ai.discrepancies.map((x) => (
            <Text key={x} style={[text.caption, { color: colors.onMango }]}>• {x}</Text>
          ))}
        </AiSuggestionCard>
      ) : open ? (
        <Button label="Đối soát CCCD bằng AI" variant="secondary" icon={{ sf: 'sparkles', md: 'auto_awesome' }} loading={ocrBusy} onPress={() => void runOcr()} />
      ) : null}

      <SectionHeader title="Xác nhận danh tính" note="Bắt buộc trước khi duyệt: AI chỉ đọc ảnh, không tra cơ sở dữ liệu dân cư." />
      {d.identityVerified ? (
        <Banner tone="success" title="Đã đối chiếu CCCD thủ công">
          {[d.identityVerifiedByName, d.identityVerifiedAt ? formatVietnamDateTime(d.identityVerifiedAt) : null].filter(Boolean).join(' · ')}
          {d.identityVerificationNote ? `\n${d.identityVerificationNote}` : ''}
        </Banner>
      ) : open ? (
        <Card style={{ gap: 10 }}>
          <TextField label="Cách bạn đã đối chiếu" value={identityNote} onChangeText={setIdentityNote} multiline placeholder="VD: Đã xem CCCD gắn chip bản gốc tại trụ sở, đúng người" />
          <Button label="Tôi đã đối chiếu CCCD" variant="sign" icon={{ sf: 'person.text.rectangle', md: 'badge' }} loading={confirming} onPress={() => void confirmIdentity()} />
        </Card>
      ) : null}

      {open ? (
        <DecisionDesk reason={reason} setReason={setReason} busy={busy} approveLabel={d.identityVerified ? 'Duyệt điểm bán' : 'Duyệt (cần xác nhận CCCD)'} canApprove={d.identityVerified} onApprove={() => decide('APPROVE')} onReject={() => decide('REJECT')} onMoreInfo={() => decide('MORE_INFO')} />
      ) : (
        <RecordedDecision status={d.status} reason={d.reviewReason} by={d.reviewedBy} at={d.reviewedAt} />
      )}
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
    void run(kind, () => complianceApi.decideRentalApplication(id!, kind, reason.trim() || 'Đủ điều kiện cấp phép sử dụng tạm thời vỉa hè', d.status), kind === 'APPROVE' ? 'Đã duyệt: hợp đồng, giấy phép QR và lịch thu phí đã được tạo' : 'Đã từ chối cấp phép');
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
    void run(kind, () => complianceApi.decideRenewal(id!, kind, reason.trim() || 'Đủ điều kiện gia hạn hợp đồng sử dụng tạm thời vỉa hè', d.status), kind === 'APPROVE' ? 'Đã duyệt gia hạn: hợp đồng và giấy phép đã cập nhật thời hạn mới' : 'Đã từ chối gia hạn');
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

