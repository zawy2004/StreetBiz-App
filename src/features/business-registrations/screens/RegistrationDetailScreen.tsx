import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, KeyValueList, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { EDITABLE_STATUSES, errorMessage, VENDOR_TYPE } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { useWards } from '@/core/auth/useWards';
import { hkdCode } from '@/features/sidewalk-slots/slot-format';
import { colors, fonts, radius, text } from '@/theme';
import { formatDate, formatVietnamDate, formatVnd } from '@/utils/format';
import { TrackLine } from '../components/RegistrationParts';
import { vendorTypeLabel } from '../labels';
import { EVIDENCE_LABELS, householdMemberToDraft, useNewRegistrationStore } from '../new-registration-store';
import { useRegistrationDetail, useWithdrawRegistration } from '../useRegistrations';

const go = (href: string) => router.push(href as Href);
const GENDER: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };
const ID_TYPE: Record<string, string> = { CCCD: 'Căn cước công dân', PASSPORT: 'Hộ chiếu' };
const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');
const day = (v: string | null | undefined) => (v ? formatDate(v) : '—');

/**
 * V08 Hồ sơ đăng ký (REG-03 detail, REG-04 edit, REG-05 withdraw): the ward's answer first,
 * then what was filed, the documents, Mẫu số 01, and what to do next.
 */
export function RegistrationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const registrationId = Number(id);
  const { registration, evidence, isLoading, isError, error, refetch, isRefetching } = useRegistrationDetail(registrationId);
  const withdraw = useWithdrawRegistration();
  const loadForEdit = useNewRegistrationStore((s) => s.loadForEdit);
  const { wards } = useWards();
  const [showAll, setShowAll] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hồ sơ đăng ký' }} />
        <ListSkeleton rows={4} height={110} />
      </Screen>
    );
  }
  if (isError || !registration) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hồ sơ đăng ký' }} />
        <ErrorState title="Không tìm thấy hồ sơ" error={error ?? new Error('Hồ sơ không tồn tại hoặc đã bị xoá.')} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const r = registration;
  const status = r.registrationStatus;
  const { label, tone } = statusLabel(status);
  const canEdit = EDITABLE_STATUSES.includes(status);
  const canWithdraw = !['WITHDRAWN', 'REJECTED'].includes(status);
  const fixed = r.vendorType === VENDOR_TYPE.fixedStorefront;
  const approved = status === 'APPROVED';
  const needsMoreInfo = status === 'MORE_INFORMATION_REQUIRED';
  const ward = wards.find((w) => w.unitId === r.wardUnitId);

  const startEdit = () => {
    loadForEdit({
      registrationId: r.registrationId,
      vendorType: r.vendorType,
      displayName: r.displayName,
      declaredAddress: r.declaredAddress ?? '',
      addressLatitude: r.addressLatitude,
      addressLongitude: r.addressLongitude,
      wardUnitId: r.wardUnitId,
      ownerDateOfBirth: r.ownerDateOfBirth ?? '',
      ownerGender: r.ownerGender ?? '',
      ownerEthnicity: r.ownerEthnicity ?? '',
      ownerNationality: r.ownerNationality ?? 'Việt Nam',
      idType: r.idType ?? 'CCCD',
      idIssuedDate: r.idIssuedDate ?? '',
      idIssuedPlace: r.idIssuedPlace ?? '',
      permanentAddress: r.permanentAddress ?? '',
      contactAddress: r.contactAddress ?? '',
      businessLine: r.businessLine ?? '',
      businessLineCode: r.businessLineCode ?? '',
      capitalAmount: r.capitalAmount != null ? String(r.capitalAmount) : '',
      laborCount: r.laborCount != null ? String(r.laborCount) : '',
      plannedStartDate: r.plannedStartDate ?? '',
      foodSafetyCommitment: r.foodSafetyCommitmentAt != null,
      householdMembers: r.householdMembers.map(householdMemberToDraft),
    });
    go('/register-business');
  };

  const confirmWithdraw = () =>
    Alert.alert('Rút hồ sơ đăng ký?', 'Bạn có thể nộp lại hồ sơ mới bất cứ lúc nào.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Rút hồ sơ',
        style: 'destructive',
        onPress: async () => {
          try {
            await withdraw.mutateAsync(r.registrationId);
            showToast('Đã rút hồ sơ.');
            router.back();
          } catch (err) {
            showToast(errorMessage(err), 'error');
          }
        },
      },
    ]);

  const download = async (format: 'pdf' | 'docx') => {
    setDownloading(format);
    await shareProtectedFile(
      `/vendor/registrations/${r.registrationId}/document?format=${format}`,
      `DangKyHKD_${r.registrationId}.${format}`,
      format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    setDownloading(null);
  };

  return (
    <Screen
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      footer={
        canEdit || canWithdraw ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {canWithdraw ? (
              <Button label="Rút hồ sơ" variant="secondary" loading={withdraw.isPending} onPress={confirmWithdraw} style={{ flex: 1 }} />
            ) : null}
            {canEdit ? <Button label="Cập nhật hồ sơ" icon={{ sf: 'pencil', md: 'edit' }} onPress={startEdit} style={{ flex: 1.4 }} /> : null}
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Hồ sơ đăng ký' }} />

      {/* Identity of the file */}
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card }}>
        <View style={{ padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[text.title2, { color: colors.ink }]}>{r.displayName}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>
                {vendorTypeLabel(r.vendorType)}, {hkdCode(r.registrationId)}
              </Text>
            </View>
            <StatusPill label={label} tone={tone} />
          </View>
          <TrackLine registration={r} />
        </View>
        <KerbStrip height={5} segment={20} />
      </View>

      {/* The ward's word */}
      {r.reviewDecisionReason ? (
        <Banner
          tone={needsMoreInfo ? 'warning' : status === 'REJECTED' ? 'danger' : approved ? 'success' : 'info'}
          title={needsMoreInfo ? 'Phường yêu cầu bổ sung' : status === 'REJECTED' ? 'Phường từ chối hồ sơ' : 'Phản hồi của phường'}
          action={needsMoreInfo && canEdit ? { label: 'Cập nhật hồ sơ', onPress: startEdit } : undefined}
        >
          {`${r.reviewDecisionReason}${r.reviewedAt ? `\n${formatVietnamDate(r.reviewedAt)}` : ''}`}
        </Banner>
      ) : approved ? (
        <Banner tone="success" title="Hồ sơ đã được duyệt">
          {r.reviewedAt ? `Ngày duyệt ${formatVietnamDate(r.reviewedAt)}.` : 'Bạn có thể thuê ô vỉa hè.'}
        </Banner>
      ) : null}

      {r.identityVerifiedAt ? (
        <Banner tone="success" icon={{ sf: 'person.badge.shield.checkmark.fill', md: 'verified_user' }}>
          {`Phường đã xác nhận danh tính ngày ${formatVietnamDate(r.identityVerifiedAt)}.${r.identityVerificationNote ? ` ${r.identityVerificationNote}` : ''}`}
        </Banner>
      ) : null}

      {/* Next step */}
      {approved ? (
        <Card style={{ gap: 10 }}>
          <SectionHeader title="Bước tiếp theo" />
          {fixed ? (
            <Button label="Cập nhật địa chỉ kinh doanh" variant="secondary" icon={{ sf: 'mappin.and.ellipse', md: 'edit_location' }} onPress={() => go(`/vendor/home/registrations/${r.registrationId}/address`)} />
          ) : null}
          <Button label="Thuê ô vỉa hè" icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} onPress={() => go('/vendor/slots')} />
        </Card>
      ) : null}

      {/* What was filed */}
      <Card style={{ gap: 4 }}>
        <SectionHeader title="Thông tin đã nộp" />
        <KeyValueList
          rows={[
            { label: 'Tên hộ kinh doanh', value: r.displayName },
            { label: 'Loại hình', value: vendorTypeLabel(r.vendorType) },
            { label: 'Phường/xã', value: ward?.unitName ?? `#${r.wardUnitId}` },
            { label: 'Địa chỉ kinh doanh', value: dash(r.declaredAddress) },
            { label: 'Ngành, nghề', value: dash(r.businessLine) },
            {
              label: 'Vốn / lao động',
              value: `${r.capitalAmount != null ? formatVnd(r.capitalAmount) : '—'} / ${r.laborCount ?? '—'} người`,
            },
            { label: 'Cam kết ATTP', value: r.foodSafetyCommitmentAt ? `Đã cam kết ${formatVietnamDate(r.foodSafetyCommitmentAt)}` : 'Chưa' },
            { label: 'Ưu tiên xử lý nhanh', value: r.fastTrackFlag ? 'Có' : 'Không' },
            ...(showAll
              ? [
                  { label: 'Ngày sinh', value: day(r.ownerDateOfBirth) },
                  { label: 'Giới tính', value: r.ownerGender ? (GENDER[r.ownerGender] ?? r.ownerGender) : '—' },
                  { label: 'Dân tộc', value: dash(r.ownerEthnicity) },
                  { label: 'Quốc tịch', value: dash(r.ownerNationality) },
                  { label: 'Giấy tờ pháp lý', value: r.idType ? (ID_TYPE[r.idType] ?? r.idType) : '—' },
                  { label: 'Ngày cấp', value: day(r.idIssuedDate) },
                  { label: 'Nơi cấp', value: dash(r.idIssuedPlace) },
                  { label: 'Địa chỉ thường trú', value: dash(r.permanentAddress) },
                  { label: 'Địa chỉ liên lạc', value: dash(r.contactAddress) },
                  { label: 'Dự kiến bắt đầu', value: day(r.plannedStartDate) },
                  ...(r.businessLineCode ? [{ label: 'Mã ngành', value: r.businessLineCode }] : []),
                  ...r.householdMembers.map((m, i) => ({
                    label: `Thành viên ${i + 1}`,
                    value: [m.fullName, m.relationshipToOwner, m.capitalContribution != null ? formatVnd(m.capitalContribution) : null].filter(Boolean).join(', '),
                  })),
                ]
              : []),
          ]}
        />
        <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button" style={{ alignSelf: 'center', paddingTop: 8 }} hitSlop={8}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{showAll ? 'Thu gọn' : 'Xem đủ Mẫu số 01'}</Text>
        </Pressable>
      </Card>

      {/* Documents */}
      <View style={{ gap: 10 }}>
        <SectionHeader title="Giấy tờ minh chứng" />
        {evidence.length === 0 ? (
          <Text style={[text.callout, { color: colors.muted }]}>Chưa có giấy tờ nào.{canEdit ? ' Chọn “Cập nhật hồ sơ” để tải lên.' : ''}</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {evidence.map((e) => (
              <ProtectedFileTile key={e.evidenceId} fileUrl={e.fileUrl} label={EVIDENCE_LABELS[e.evidenceType] ?? e.evidenceType} />
            ))}
          </View>
        )}
      </View>

      {/* Mẫu số 01 */}
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon sf="doc.text.fill" md="description" size={20} color={colors.sign} />
          <Text style={[text.headline, { flex: 1, color: colors.ink }]}>Giấy đề nghị đăng ký hộ kinh doanh (Mẫu số 01)</Text>
        </View>
        <Text style={[text.footnote, { color: colors.muted }]}>
          {approved ? 'Bản điền sẵn từ hồ sơ đã duyệt.' : 'Bản nháp có chữ “BẢN NHÁP” cho tới khi phường duyệt.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="PDF" variant="secondary" icon={{ sf: 'arrow.down.doc', md: 'download' }} loading={downloading === 'pdf'} onPress={() => void download('pdf')} style={{ flex: 1 }} />
          <Button label="Word" variant="secondary" icon={{ sf: 'arrow.down.doc', md: 'download' }} loading={downloading === 'docx'} onPress={() => void download('docx')} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}
