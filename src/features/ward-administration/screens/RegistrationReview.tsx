import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ScrollView } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap } from '@/components/map/LeafletMap';
import { ActionMenu, MoreButton } from '@/components/native/ActionMenu';
import { SegmentedControl } from '@/components/native/SegmentedControl';
import { StatusHeader } from '@/components/native/StatusHeader';
import { AiTag } from '@/components/status/AiTag';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, sign, statusTones, tabular, text, type StatusTone } from '@/theme';
import { Pass, Plate } from '@/ui';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { AiSuggestionCard } from '../components/ReviewParts';
import { useRegistrationIntegrity, type IntegrityFlag, type RegistrationIntegrity } from '../ward-integrity-api';
import { complianceApi, evidenceLabels, type WardEnrollmentDetail } from '../ward-api';

/** Statuses an officer can still decide on (same set as the web desk). */
export const OPEN_REGISTRATION = ['SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'];
export type RegistrationDecisionKind = 'IDENTITY' | 'APPROVE' | 'REJECT' | 'MORE_INFO';
export const enrollmentKey = (id: string | undefined) => ['ward', 'enrollment', id] as const;

type Section = 'profile' | 'docs' | 'checks';
type Ai = WardEnrollmentDetail['aiCheck'];

const decisionHref = (id: string, kind: RegistrationDecisionKind) => `/decision/registration/${id}?kind=${kind}` as Href;
const docName = (e: WardEnrollmentDetail['evidence'][number]) => (e.label && e.label !== e.type ? e.label : (evidenceLabels[e.type] ?? 'Giấy tờ khác'));
const severityTone: Record<IntegrityFlag['severity'], StatusTone> = {
  HIGH: 'danger',
  MEDIUM: 'pending',
  LOW: 'neutral',
};
const severityLabel: Record<IntegrityFlag['severity'], string> = {
  HIGH: 'Mức cao',
  MEDIUM: 'Mức trung bình',
  LOW: 'Mức thấp',
};

/**
 * W05 Thẩm định hồ sơ đăng ký (WARD-04/05/06, BR-41). Built as an app screen, not a long web
 * page: who applied and where the record stands up top, the approval gate as three steps (the
 * [AI] read, the officer's own check of the original CCCD, the decision), the record split into
 * three segments, and the decision itself in thumb reach. Writing a reason and confirming
 * happen in their own modal (`DecisionScreen`), so nothing typed is lost to a stray tap.
 */
export function RegistrationReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery({
    queryKey: enrollmentKey(id),
    queryFn: () => complianceApi.getEnrollment(id!),
    enabled: Boolean(id),
  });
  const integrity = useRegistrationIntegrity(id);
  const [section, setSection] = useState<Section>('profile');
  const [ocr, setOcr] = useState<Ai>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const [sectionsY, setSectionsY] = useState(0);
  /** Switch segment and bring it into view (from the warning line, the gate, the [AI] action). */
  const show = (next: Section) => {
    setSection(next);
    scroll.current?.scrollTo({ y: Math.max(0, sectionsY - 8), animated: true });
  };

  if (detail.isPending) return <ReviewSkeleton />;
  if (detail.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hồ sơ đăng ký', headerRight: () => null }} />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }

  const d = detail.data;
  const open = OPEN_REGISTRATION.includes(d.status);
  const ai = ocr ?? d.aiCheck;
  const flags = integrity.data?.flags ?? [];
  const kycWarnings = d.kycChecks.filter((k) => k.isMatch === false || Boolean(k.warnings)).length;

  const runOcr = async () => {
    setOcrBusy(true);
    show('checks');
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
  const share = (format: 'pdf' | 'docx') =>
    void shareProtectedFile(
      `/ward/enrollments/${d.id}/document?format=${format}`,
      `DangKyHKD_${d.id}.${format}`,
      format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

  return (
    <Screen
      gap={20}
      scrollRef={scroll}
      footer={
        open ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActionMenu
              title="Quyết định khác"
              accessibilityLabel="Quyết định khác: yêu cầu bổ sung hoặc từ chối"
              items={[
                {
                  id: 'more',
                  title: 'Yêu cầu bổ sung giấy tờ',
                  icon: { sf: 'doc.badge.plus', md: 'note_add' },
                  onPress: () => router.push(decisionHref(d.id, 'MORE_INFO')),
                },
                {
                  id: 'reject',
                  title: 'Từ chối hồ sơ',
                  icon: { sf: 'xmark.octagon', md: 'block' },
                  destructive: true,
                  onPress: () => router.push(decisionHref(d.id, 'REJECT')),
                },
              ]}
            >
              <View
                style={{
                  minHeight: 56,
                  paddingHorizontal: 18,
                  borderRadius: radius.full,
                  borderCurve: 'continuous',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.signTint,
                }}
              >
                <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.sign }}>Khác</Text>
                <Icon sf="chevron.up" md="expand_less" size={14} color={colors.sign} />
              </View>
            </ActionMenu>
            {d.identityVerified ? (
              <Button label="Duyệt điểm bán" variant="sign" size={56} icon={{ sf: 'checkmark.seal.fill', md: 'verified' }} onPress={() => router.push(decisionHref(d.id, 'APPROVE'))} style={{ flex: 1 }} />
            ) : (
              <Button
                label="Đối chiếu CCCD"
                variant="sign"
                size={56}
                icon={{ sf: 'person.text.rectangle', md: 'badge' }}
                onPress={() => router.push(decisionHref(d.id, 'IDENTITY'))}
                accessibilityHint="Bước bắt buộc trước khi duyệt"
                style={{ flex: 1 }}
              />
            )}
          </View>
        ) : undefined
      }
    >
      <Stack.Screen
        options={{
          title: `Hồ sơ #${d.id}`,
          headerRight: () => (
            <MoreButton
              title="Hồ sơ đăng ký"
              items={[
                {
                  id: 'pdf',
                  title: 'Tải Mẫu 01 (PDF)',
                  icon: { sf: 'doc.richtext', md: 'picture_as_pdf' },
                  onPress: () => share('pdf'),
                },
                {
                  id: 'docx',
                  title: 'Tải bản Word (.docx)',
                  icon: { sf: 'doc.text', md: 'description' },
                  onPress: () => share('docx'),
                },
                ...(open
                  ? [
                      {
                        id: 'ocr',
                        title: ai ? 'Đọc lại CCCD [AI]' : 'Đọc CCCD [AI]',
                        icon: { sf: 'sparkles', md: 'auto_awesome' },
                        disabled: ocrBusy,
                        onPress: () => void runOcr(),
                      },
                    ]
                  : []),
                {
                  id: 'legal',
                  title: 'Căn cứ pháp lý',
                  icon: { sf: 'book', md: 'menu_book' },
                  onPress: () => router.push('/legal/basis?section=cap-phuong' as Href),
                },
              ]}
            />
          ),
        }}
      />

      <Applicant d={d} onDocs={() => show('docs')} />
      <Verdict d={d} open={open} />
      {flags[0] ? (
        <StatusHeader
          tone={integrity.data?.level === 'HIGH' ? 'danger' : 'pending'}
          icon={{ sf: 'exclamationmark.triangle.fill', md: 'warning' }}
          title={`${flags.length} cảnh báo cần xem kỹ`}
          detail={flags.length > 1 ? `${flags[0].title} và ${flags.length - 1} cảnh báo khác.` : flags[0].title}
          action={{ label: 'Xem chi tiết', onPress: () => show('checks') }}
        />
      ) : null}
      {open ? <Gate d={d} ai={ai} ocrBusy={ocrBusy} onAi={() => show('checks')} /> : null}

      <View style={{ gap: 14 }} onLayout={(e) => setSectionsY(e.nativeEvent.layout.y)}>
        <SegmentedControl
          value={section}
          onChange={setSection}
          options={[
            { key: 'profile', label: 'Hồ sơ' },
            { key: 'docs', label: 'Giấy tờ', count: d.evidence.length },
            { key: 'checks', label: 'Kiểm tra', count: flags.length + kycWarnings },
          ]}
        />
        {section === 'profile' ? <ProfileSection d={d} /> : null}
        {section === 'docs' ? <DocsSection d={d} share={share} /> : null}
        {section === 'checks' ? <ChecksSection d={d} ai={ai} integrity={integrity.data} ocrBusy={ocrBusy} open={open} runOcr={() => void runOcr()} /> : null}
      </View>
    </Screen>
  );
}

function ReviewSkeleton() {
  return (
    <Screen gap={20}>
      <Stack.Screen options={{ title: 'Hồ sơ đăng ký', headerRight: () => null }} />
      <Skeleton height={236} radius={radius.pass} />
      <Skeleton height={190} radius={radius.card} />
      <Skeleton height={36} radius={18} />
      <Skeleton height={260} radius={radius.card} />
    </Screen>
  );
}

/** The paint on the dossier's band: orange while it is open, then the colour of the decision. */
const passAccent = (status: string) =>
  status === 'APPROVED' ? colors.leaf : status === 'REJECTED' ? colors.danger : status === 'MORE_INFORMATION_REQUIRED' ? colors.sticker : colors.brand;

/**
 * The dossier as a filed ticket (v5 `Pass`): its number on a street plate, who applied, how they
 * trade, the owner; under the tear line where it stands and how many papers are attached (a tap
 * opens them).
 */
function Applicant({ d, onDocs }: { d: WardEnrollmentDetail; onDocs: () => void }) {
  const s = statusLabel(d.status);
  const name = d.displayName || d.ownerName;
  const fixed = d.vendorType === 'FIXED_STOREFRONT';
  return (
    <Pass
      accent={passAccent(d.status)}
      head={
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Plate code={`#${d.id}`} prefix="HỒ SƠ" />
            <View style={{ flex: 1 }} />
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf={fixed ? 'storefront.fill' : 'figure.walk'} md={fixed ? 'storefront' : 'directions_walk'} size={21} color={colors.primary} />
            </View>
          </View>
          <Text selectable style={[text.title1, { color: colors.ink }]}>
            {name}
          </Text>
          <View style={{ gap: 2 }}>
            <Text style={[text.callout, { color: colors.ink, fontFamily: fonts.semibold }]}>{fixed ? 'Cửa hàng cố định' : 'Hàng rong lưu động'}</Text>
            {d.displayName && d.ownerName ? <Text style={[text.callout, { color: colors.muted }]}>Chủ hộ {d.ownerName}</Text> : null}
            <Text style={[text.footnote, { color: colors.muted }, tabular]}>Nộp {formatVietnamDateTime(d.createdAt)}</Text>
          </View>
        </View>
      }
      stub={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <StatusPill label={s.label} tone={s.tone} />
            {d.fastTrack ? <StatusPill label="Ưu tiên xét nhanh" tone="ok" /> : null}
          </View>
          <Pressable
            onPress={onDocs}
            accessibilityRole="button"
            accessibilityLabel={`${d.evidence.length} giấy tờ đính kèm. Xem giấy tờ`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: pressed ? colors.sticker : colors.mangoTint })}
          >
            <Icon sf="doc.on.doc.fill" md="folder_open" size={15} color={colors.onMango} />
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 14, color: colors.onMango }, tabular]}>{d.evidence.length} giấy tờ</Text>
          </Pressable>
        </View>
      }
    />
  );
}

/** The decision already on the record (BR-46: who and when), or the last request for more papers. */
function Verdict({ d, open }: { d: WardEnrollmentDetail; open: boolean }) {
  if (open && !d.reviewReason) return null;
  const tone: StatusTone = d.status === 'APPROVED' ? 'ok' : d.status === 'REJECTED' ? 'danger' : d.status === 'MORE_INFORMATION_REQUIRED' ? 'pending' : 'neutral';
  const title = d.status === 'APPROVED' ? 'Đã duyệt' : d.status === 'REJECTED' ? 'Đã từ chối' : d.status === 'MORE_INFORMATION_REQUIRED' ? 'Đã yêu cầu bổ sung' : statusLabel(d.status).label;
  const by = d.reviewedBy ? (/^\d+$/.test(d.reviewedBy) ? `Cán bộ mã ${d.reviewedBy}` : d.reviewedBy) : null;
  const meta = [by, d.reviewedAt ? formatVietnamDateTime(d.reviewedAt) : null].filter(Boolean).join(', ');
  return <StatusHeader tone={tone} title={title} detail={[d.reviewReason, meta].filter(Boolean).join('\n') || undefined} />;
}

type StepState = 'done' | 'warn' | 'todo' | 'locked' | 'idle' | 'busy';

/**
 * BR-41 as the officer meets it: three steps in order. Only step 2 (a person checking the
 * original CCCD) unlocks approval; the [AI] read is optional help and never opens the gate.
 */
function Gate({ d, ai, ocrBusy, onAi }: { d: WardEnrollmentDetail; ai: Ai; ocrBusy: boolean; onAi: () => void }) {
  const aiState: StepState = ocrBusy ? 'busy' : !ai ? 'idle' : ai.isAiGenerated && !ai.needsManualVerification && ai.matchPercentage >= 85 ? 'done' : 'warn';
  const aiNote = ocrBusy ? 'Đang đọc ảnh CCCD…' : !ai ? 'Chưa chạy, không bắt buộc' : ai.isAiGenerated ? `Khớp ${ai.matchPercentage}%, chỉ để tham khảo` : 'Chưa dùng được AI, đối chiếu thủ công';
  const who = [d.identityVerifiedByName, d.identityVerifiedAt ? formatVietnamDateTime(d.identityVerifiedAt) : null].filter(Boolean).join(', ');
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.ink }}>Cổng duyệt</Text>
        <Text style={[text.footnote, { color: colors.muted }]}>AI chỉ đọc ảnh, không tra cơ sở dữ liệu dân cư.</Text>
      </View>
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: colors.card,
          overflow: 'hidden',
          boxShadow: shadow.card,
        }}
      >
        <GateStep n={1} state={aiState} title="[AI] Đọc & đối chiếu CCCD" note={aiNote} onPress={onAi} />
        <GateStep
          n={2}
          state={d.identityVerified ? 'done' : 'todo'}
          title="Cán bộ đối chiếu CCCD gốc"
          note={d.identityVerified ? who || 'Đã xác nhận' : 'Bắt buộc trước khi duyệt'}
          extra={d.identityVerified && d.identityVerificationNote ? d.identityVerificationNote : undefined}
          onPress={d.identityVerified ? undefined : () => router.push(decisionHref(d.id, 'IDENTITY'))}
        />
        <GateStep n={3} state={d.identityVerified ? 'todo' : 'locked'} title="Quyết định" note={d.identityVerified ? 'Đã mở khoá duyệt' : 'Mở khi xong bước 2'} last />
      </View>
    </View>
  );
}

function GateStep({ n, state, title, note, extra, onPress, last }: { n: number; state: StepState; title: string; note: string; extra?: string; onPress?: () => void; last?: boolean }) {
  const mark =
    state === 'done'
      ? { bg: colors.leaf, fg: colors.white, icon: { sf: 'checkmark', md: 'check' } }
      : state === 'warn'
        ? {
            bg: colors.mangoTint,
            fg: colors.onMango,
            icon: { sf: 'exclamationmark', md: 'priority_high' },
          }
        : state === 'locked'
          ? { bg: colors.sunken, fg: colors.muted, icon: { sf: 'lock.fill', md: 'lock' } }
          : state === 'todo'
            ? { bg: colors.sign, fg: colors.white, icon: null }
            : { bg: colors.sunken, fg: colors.muted, icon: null };
  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        gap: 14,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: last ? 14 : 0,
        backgroundColor: pressed ? colors.pressed : colors.card,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: mark.bg,
          }}
        >
          {state === 'busy' ? (
            <ActivityIndicator size="small" color={colors.onMango} />
          ) : mark.icon ? (
            <Icon sf={mark.icon.sf} md={mark.icon.md} size={17} color={mark.fg} weight="bold" />
          ) : (
            <Text maxFontSizeMultiplier={1.2} style={[sign.price, { color: mark.fg }]}>{n}</Text>
          )}
        </View>
        {last ? null : (
          <View
            style={{
              width: 2,
              flex: 1,
              minHeight: 12,
              marginTop: 4,
              backgroundColor: state === 'done' ? colors.leaf : colors.line,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 2, paddingBottom: last ? 0 : 14, paddingTop: 4 }}>
        <Text style={[text.headline, { color: state === 'locked' || state === 'idle' ? colors.muted : colors.ink }]}>{title}</Text>
        <Text
          style={[
            text.footnote,
            {
              color: state === 'todo' ? colors.sign : state === 'done' ? colors.onLeaf : state === 'warn' ? colors.onMango : colors.muted,
            },
            tabular,
          ]}
        >
          {note}
        </Text>
        {extra ? (
          <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={3}>
            “{extra}”
          </Text>
        ) : null}
      </View>
      {onPress ? <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} style={{ marginTop: 12 }} /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Bước ${n}: ${title}. ${note}`}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** Label above value, like a contact card: long addresses wrap instead of being cut. */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View accessible style={{ paddingHorizontal: 16, paddingVertical: 11, gap: 2, backgroundColor: colors.card }}>
      <Text style={[text.footnote, { color: colors.muted }]}>{label}</Text>
      <Text selectable style={[text.body, { color: colors.ink }, mono ? [tabular, { fontFamily: fonts.semibold, letterSpacing: 0.5 }] : null]}>
        {value}
      </Text>
    </View>
  );
}

function Fields({ title, rows, footer }: { title: string; rows: ({ label: string; value: string | null | undefined; mono?: boolean } | false | null | undefined)[]; footer?: ReactNode }) {
  const shown = rows.filter((r): r is { label: string; value: string; mono?: boolean } => !!r && !!r.value && r.value.trim() !== '');
  if (shown.length === 0 && !footer) return null;
  return (
    <ListGroup title={title} inset={16}>
      {shown.map((r) => (
        <Field key={r.label} label={r.label} value={r.value} mono={r.mono} />
      ))}
      {footer ? <View key="footer">{footer}</View> : null}
    </ListGroup>
  );
}

function ProfileSection({ d }: { d: WardEnrollmentDetail }) {
  const owner = d.ownerProfile;
  const biz = d.businessProfile;
  const gender = owner.gender === 'MALE' ? 'Nam' : owner.gender === 'FEMALE' ? 'Nữ' : owner.gender;
  return (
    <View style={{ gap: 20 }}>
      <Fields
        title="Chủ hộ (Mẫu 01)"
        rows={[
          { label: 'Họ tên', value: d.ownerName },
          { label: 'Số CCCD', value: d.idNumber, mono: true },
          {
            label: 'Ngày sinh',
            value: owner.dateOfBirth ? formatVietnamDate(owner.dateOfBirth) : null,
          },
          { label: 'Giới tính', value: gender },
          {
            label: 'Ngày cấp CCCD',
            value: owner.idIssuedDate ? `${formatVietnamDate(owner.idIssuedDate)}${owner.idIssuedPlace ? `, ${owner.idIssuedPlace}` : ''}` : null,
          },
          { label: 'Thường trú', value: owner.permanentAddress },
          { label: 'Chỗ ở hiện tại', value: owner.contactAddress },
        ]}
      />
      <Fields
        title="Điểm kinh doanh vỉa hè"
        rows={[
          { label: 'Địa chỉ', value: d.address },
          {
            label: 'Ngành nghề',
            value: biz.businessLine ? `${biz.businessLine}${biz.businessLineCode ? ` (${biz.businessLineCode})` : ''}` : null,
          },
          {
            label: 'Vốn kinh doanh',
            value: biz.capitalAmount != null ? formatVnd(biz.capitalAmount) : null,
          },
          { label: 'Số lao động', value: biz.laborCount != null ? String(biz.laborCount) : null },
          {
            label: 'Dự kiến bắt đầu',
            value: biz.plannedStartDate ? formatVietnamDate(biz.plannedStartDate) : null,
          },
          {
            label: 'Cam kết an toàn thực phẩm',
            value: d.foodSafetyCommitmentAt ? `Đã ký ${formatVietnamDate(d.foodSafetyCommitmentAt)}` : null,
          },
        ]}
        footer={
          d.latitude != null && d.longitude != null ? (
            <LeafletMap
              center={[d.latitude, d.longitude]}
              zoom={17}
              interactive={false}
              markers={[
                {
                  id: 'r',
                  latitude: d.latitude,
                  longitude: d.longitude,
                  label: 'Điểm khai báo',
                  fill: colors.cta,
                  ink: colors.white,
                },
              ]}
              style={{ height: 150 }}
            />
          ) : undefined
        }
      />
      {d.householdMembers.length > 0 ? (
        <ListGroup title={`Thành viên hộ (${d.householdMembers.length})`} inset={16}>
          {d.householdMembers.map((m, i) => (
            <ListRow key={`${m.fullName}-${i}`} title={m.fullName} subtitle={[m.relationshipToOwner, m.idNumber].filter(Boolean).join(', ') || undefined} />
          ))}
        </ListGroup>
      ) : null}
    </View>
  );
}

function DocsSection({ d, share }: { d: WardEnrollmentDetail; share: (f: 'pdf' | 'docx') => void }) {
  return (
    <View style={{ gap: 20 }}>
      {d.evidence.length === 0 ? (
        <StatusHeader tone="neutral" icon={{ sf: 'doc', md: 'draft' }} title="Chưa có giấy tờ đính kèm" detail="Có thể yêu cầu bổ sung bằng nút Khác." />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {d.evidence.map((e) => (
            <ProtectedFileTile key={e.evidenceId} fileUrl={e.fileUrl} label={docName(e)} />
          ))}
        </View>
      )}
      <ListGroup title="Bản hồ sơ để lưu, in" footer="Mở bảng chia sẻ của máy để lưu vào Tệp, gửi hoặc in.">
        <ListRow title="Mẫu 01 (PDF)" icon={{ sf: 'doc.richtext', md: 'picture_as_pdf' }} tint={colors.danger} tileColor={colors.dangerTint} onPress={() => share('pdf')} />
        <ListRow title="Bản Word (.docx)" icon={{ sf: 'doc.text', md: 'description' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => share('docx')} />
      </ListGroup>
    </View>
  );
}

function ChecksSection({
  d,
  ai,
  integrity,
  ocrBusy,
  open,
  runOcr,
}: {
  d: WardEnrollmentDetail;
  ai: Ai;
  integrity: RegistrationIntegrity | undefined;
  ocrBusy: boolean;
  open: boolean;
  runOcr: () => void;
}) {
  return (
    <View style={{ gap: 20 }}>
      <IntegrityPanel data={integrity} />

      {d.kycChecks.length > 0 ? (
        <ListGroup title="eKYC của máy chủ (FPT.AI)">
          {d.kycChecks.map((k, i) => {
            const bad = k.isMatch === false;
            const warn = bad || Boolean(k.warnings);
            const figures = [k.similarityPercent != null ? `Giống ${k.similarityPercent}%` : null, k.confidencePercent != null ? `Tin cậy ${k.confidencePercent}%` : null].filter(Boolean).join(', ');
            return (
              <ListRow
                key={`${k.checkType}-${i}`}
                title={k.checkType === 'FACE_MATCH' ? 'Khớp khuôn mặt' : 'Đọc thông tin CCCD'}
                subtitle={[figures, k.warnings].filter(Boolean).join('\n') || formatVietnamDateTime(k.createdAt)}
                icon={warn ? { sf: 'exclamationmark.triangle.fill', md: 'warning' } : { sf: 'checkmark.circle.fill', md: 'check_circle' }}
                tint={bad ? colors.danger : warn ? colors.onMango : colors.leaf}
                tileColor={bad ? colors.dangerTint : warn ? colors.mangoTint : colors.leafTint}
              />
            );
          })}
        </ListGroup>
      ) : null}

      {ai || open ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginLeft: 4 }}>Đối soát CCCD bằng AI</Text>
          {ai ? (
            <AiSuggestionCard title={ai.isAiGenerated ? `Khớp ${ai.matchPercentage}% với hồ sơ` : 'Chưa xác minh bằng AI'} aiLogId={ai.isAiGenerated ? ai.aiLogId : null}>
              <Text style={[text.footnote, { color: colors.ink }]}>{ai.summary}</Text>
              {ai.discrepancies.map((x) => (
                <Text key={x} style={[text.footnote, { color: colors.onMango }]}>
                  • {x}
                </Text>
              ))}
            </AiSuggestionCard>
          ) : (
            <View
              style={{
                gap: 10,
                padding: 14,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                backgroundColor: colors.card,
              }}
            >
              <AiTag label="Không bắt buộc" />
              <Text style={[text.footnote, { color: colors.ink }]}>AI đọc ảnh CCCD và so với thông tin khai báo. Kết quả chỉ để tham khảo.</Text>
              <Button label={ocrBusy ? 'Đang đọc CCCD…' : 'Đọc CCCD [AI]'} variant="secondary" icon={{ sf: 'sparkles', md: 'auto_awesome' }} loading={ocrBusy} disabled={ocrBusy} onPress={runOcr} />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** AIC-03, the server's duplicate check (rules, not AI: no [AI] label). Hidden while loading or failed, never blocks the review. */
function IntegrityPanel({ data }: { data: RegistrationIntegrity | undefined }) {
  if (!data) return null;
  if (data.flags.length === 0) {
    return data.hasIdNumber ? (
      <StatusHeader tone="ok" icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} title="Không phát hiện hồ sơ trùng lặp" detail={data.basis} />
    ) : (
      <StatusHeader tone="neutral" title="Chưa đối chiếu được hồ sơ trùng lặp" detail="Hồ sơ chưa có số CCCD để đối chiếu." />
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginLeft: 4 }}>Đối chiếu hồ sơ trùng lặp: {data.flags.length} cảnh báo</Text>
      {data.flags.map((f) => (
        <View
          key={f.code}
          style={{
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.card,
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: 14, gap: 6 }}>
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radius.full,
                backgroundColor: statusTones[severityTone[f.severity]].wash,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 12,
                  color: statusTones[severityTone[f.severity]].ink,
                }}
              >
                {severityLabel[f.severity]}
              </Text>
            </View>
            <Text style={[text.headline, { color: colors.ink }]}>{f.title}</Text>
            <Text style={[text.footnote, { color: colors.ink }]}>{f.detail}</Text>
          </View>
          {f.related.map((r, i) =>
            r.registrationId != null ? (
              <View key={`${r.registrationId}-${i}`} style={{ borderTopWidth: 1, borderTopColor: colors.separator }}>
                <ListRow
                  title={r.businessName ?? `Hồ sơ #${r.registrationId}`}
                  subtitle={`#${r.registrationId}, ${statusLabel(r.status).label}`}
                  onPress={() => router.push(`/ward/inbox/registrations/${r.registrationId}` as Href)}
                />
              </View>
            ) : (
              <View
                key={`other-${i}`}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.separator,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text style={[text.footnote, { color: colors.muted }]}>
                  Hồ sơ ở {r.wardName}, {statusLabel(r.status).label}
                </Text>
              </View>
            ),
          )}
        </View>
      ))}
      <Text style={[text.footnote, { color: colors.muted, marginHorizontal: 4 }]}>{data.basis}</Text>
    </View>
  );
}
