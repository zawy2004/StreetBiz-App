import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, KeyValueList, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { EDITABLE_STATUSES, errorMessage, VENDOR_TYPE, type ApiRegistration } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { useWards } from '@/core/auth/useWards';
import { hkdCode } from '@/features/sidewalk-slots/slot-format';
import { colors, fonts, radius, shadow, sign, text, type StatusTone } from '@/theme';
import { Plate } from '@/ui';
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

/** The household's own shop sign: street orange, its name in sign lettering, the HKD plate, the kerb. */
function HouseholdSign({ registration: r, ward }: { registration: ApiRegistration; ward?: string }) {
  const fixed = r.vendorType === VENDOR_TYPE.fixedStorefront;
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${r.displayName}, ${hkdCode(r.registrationId)}, ${vendorTypeLabel(r.vendorType)}`}
      style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.brand, boxShadow: shadow.glow }}
    >
      <View style={{ padding: 20, paddingBottom: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Plate code={hkdCode(r.registrationId)} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)' }}>
            <Icon sf={fixed ? 'storefront.fill' : 'cart.fill'} md={fixed ? 'storefront' : 'shopping_cart'} size={14} color={colors.white} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>{vendorTypeLabel(r.vendorType)}</Text>
          </View>
        </View>
        <Text maxFontSizeMultiplier={1.3} numberOfLines={3} style={[sign.title, { color: colors.white }]}>
          {r.displayName.toLocaleUpperCase('vi-VN')}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.white }}>
          {[ward, r.createdAt ? `nộp ${formatVietnamDate(r.createdAt)}` : null].filter(Boolean).join(', ')}
        </Text>
      </View>
      <KerbStrip height={10} segment={24} />
    </View>
  );
}

/** One sentence for where the file stands, from what the ward already answered. */
function verdictOf(r: ApiRegistration): { tone: StatusTone; title: string; detail?: string } {
  const status = r.registrationStatus;
  const when = r.reviewedAt ? formatVietnamDate(r.reviewedAt) : null;
  const reason = r.reviewDecisionReason;
  const said = reason ? `${reason}${when ? `\n${when}` : ''}` : undefined;
  if (status === 'MORE_INFORMATION_REQUIRED') return { tone: 'pending', title: 'Phường yêu cầu bổ sung', detail: said };
  if (status === 'REJECTED') return { tone: 'danger', title: 'Phường từ chối hồ sơ', detail: said };
  if (status === 'APPROVED') return { tone: 'ok', title: 'Hồ sơ đã được duyệt', detail: said ?? (when ? `Ngày duyệt ${when}.` : 'Bạn có thể thuê ô vỉa hè.') };
  const { label, tone } = statusLabel(status);
  if (reason) return { tone, title: 'Phản hồi của phường', detail: said };
  return { tone, title: label, detail: status === 'SUBMITTED' || status === 'UNDER_REVIEW' ? 'Phường sẽ báo kết quả cho bạn qua thông báo.' : undefined };
}

/**
 * V08 Hồ sơ đăng ký (REG-03 detail, REG-04 edit, REG-05 withdraw), v5: the household's sign,
 * the ward's answer in one line, the tracking line, then what was filed, the documents,
 * Mẫu số 01, and the two file actions in thumb reach.
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
        <View style={{ gap: 14 }} accessibilityLabel="Đang tải">
          <Skeleton height={176} radius={radius.card} />
          <Skeleton height={80} radius={radius.card} />
          <ListSkeleton rows={2} height={120} />
        </View>
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
  const canEdit = EDITABLE_STATUSES.includes(status);
  const canWithdraw = !['WITHDRAWN', 'REJECTED'].includes(status);
  const fixed = r.vendorType === VENDOR_TYPE.fixedStorefront;
  const approved = status === 'APPROVED';
  const needsMoreInfo = status === 'MORE_INFORMATION_REQUIRED';
  const ward = wards.find((w) => w.unitId === r.wardUnitId);
  const verdict = verdictOf(r);

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
      gap={18}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      footer={
        canEdit || canWithdraw ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {canWithdraw ? (
              <Button label="Rút hồ sơ" variant="secondary" size={56} loading={withdraw.isPending} onPress={confirmWithdraw} style={{ flex: 1 }} />
            ) : null}
            {canEdit ? <Button label="Cập nhật hồ sơ" size={56} icon={{ sf: 'pencil', md: 'edit' }} onPress={startEdit} style={{ flex: 1.4 }} /> : null}
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Hồ sơ đăng ký' }} />

      {/* The household's sign */}
      <HouseholdSign registration={r} ward={ward?.unitName} />

      {/* The ward's word, said once */}
      <StatusHeader
        tone={verdict.tone}
        title={verdict.title}
        detail={verdict.detail}
        action={needsMoreInfo && canEdit ? { label: 'Cập nhật hồ sơ', onPress: startEdit } : undefined}
      />

      {/* Where it stands */}
      <Card style={{ paddingVertical: 18 }}>
        <TrackLine registration={r} />
      </Card>

      {r.identityVerifiedAt ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
            <Icon sf="person.badge.shield.checkmark.fill" md="verified_user" size={18} color={colors.white} />
          </View>
          <Text style={[text.footnote, { flex: 1, color: colors.onLeaf }]}>
            <Text style={{ fontFamily: fonts.bold }}>Phường đã xác nhận danh tính ngày {formatVietnamDate(r.identityVerifiedAt)}.</Text>
            {r.identityVerificationNote ? ` ${r.identityVerificationNote}` : ''}
          </Text>
        </View>
      ) : null}

      {/* Next step */}
      {approved ? (
        <View style={{ gap: 12, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.kerbPaint, borderWidth: 1.5, borderColor: colors.brandTint }}>
          <SectionHeader title="Bước tiếp theo" note="Hồ sơ đã duyệt: bạn thuê được ô vỉa hè." />
          <Button label="Thuê ô vỉa hè" size={56} icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} onPress={() => go('/vendor/slots')} />
          {fixed ? (
            <Button label="Cập nhật địa chỉ kinh doanh" variant="secondary" icon={{ sf: 'mappin.and.ellipse', md: 'edit_location' }} onPress={() => go(`/vendor/home/registrations/${r.registrationId}/address`)} />
          ) : null}
        </View>
      ) : null}

      {/* What was filed */}
      <Card style={{ gap: 4, padding: 18 }}>
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
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          accessibilityRole="button"
          style={({ pressed }) => ({ marginTop: 6, minHeight: 44, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: pressed ? colors.brandTint : colors.kerbPaint })}
        >
          <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.primary }}>{showAll ? 'Thu gọn' : 'Xem đủ Mẫu số 01'}</Text>
          <Icon sf={showAll ? 'chevron.up' : 'chevron.down'} md={showAll ? 'expand_less' : 'expand_more'} size={13} color={colors.primary} />
        </Pressable>
      </Card>

      {/* Documents */}
      <View style={{ gap: 12 }}>
        <SectionHeader title="Giấy tờ minh chứng" note={evidence.length ? `${evidence.length} giấy tờ` : undefined} />
        {evidence.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.photo, borderCurve: 'continuous', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.card }}>
            <Icon sf="doc.badge.plus" md="note_add" size={20} color={colors.muted} />
            <Text style={[text.callout, { flex: 1, color: colors.muted }]}>Chưa có giấy tờ nào.{canEdit ? ' Chọn “Cập nhật hồ sơ” để tải lên.' : ''}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {evidence.map((e) => (
              <ProtectedFileTile key={e.evidenceId} fileUrl={e.fileUrl} label={EVIDENCE_LABELS[e.evidenceType] ?? e.evidenceType} />
            ))}
          </View>
        )}
      </View>

      {/* Mẫu số 01 */}
      <Card style={{ gap: 12, padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="doc.text.fill" md="description" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.headline, { color: colors.ink }]}>Giấy đề nghị đăng ký hộ kinh doanh (Mẫu số 01)</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>
              {approved ? 'Bản điền sẵn từ hồ sơ đã duyệt.' : 'Bản nháp có chữ “BẢN NHÁP” cho tới khi phường duyệt.'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="PDF" variant="secondary" icon={{ sf: 'arrow.down.doc', md: 'download' }} loading={downloading === 'pdf'} onPress={() => void download('pdf')} style={{ flex: 1 }} />
          <Button label="Word" variant="secondary" icon={{ sf: 'arrow.down.doc', md: 'download' }} loading={downloading === 'docx'} onPress={() => void download('docx')} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}
