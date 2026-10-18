import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, Stack, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Card, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import { Banner } from '@/components/feedback/Banner';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { AiTag, aiPanel } from '@/components/status/AiTag';
import {
  ApiError,
  errorMessage,
  EVIDENCE_TYPE,
  OWNER_GENDER,
  OWNER_ID_TYPE,
  VENDOR_TYPE,
  vendorKycApi,
  vendorRegistrationApi,
  type ApiEvidenceType,
  type ApiVendorType,
  type KycFaceMatchResult,
  type KycIdCardExtraction,
} from '@/core/api';
import type { PickedFile } from '@/core/api/upload';
import { useWards } from '@/core/auth/useWards';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import {
  EVIDENCE_LABELS,
  evidenceFileProblem,
  parseVndAmount,
  requiredEvidence,
  useNewRegistrationStore,
} from '../new-registration-store';
import { submitRegistrationDraft } from '../submit-registration';
import { REGISTRATIONS_KEY, useRegistrations } from '../useRegistrations';

const go = (href: string) => router.push(href as Href);
const STEPS = ['Loại hình', 'Thông tin hộ', 'Chủ hộ', 'Giấy tờ'];

/* ------------------------------------------------------------------ frame */

/** "Bước n/4": four bars and the step names, at the top of every wizard step. */
function WizardProgress({ step }: { step: number }) {
  const editing = useNewRegistrationStore((s) => s.registrationId != null);
  const displayName = useNewRegistrationStore((s) => s.displayName);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < step ? colors.cta : colors.line }} />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>
        Bước {step}/4: {STEPS[step - 1]}
      </Text>
      {editing ? <Banner tone="info">Đang cập nhật hồ sơ {displayName}. Nộp lại sẽ gửi phường xét lần nữa.</Banner> : null}
    </View>
  );
}

function Question({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={[text.title2, { color: colors.ink }]}>
        {children}
      </Text>
      {hint ? <Text style={[text.callout, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

function SectionCard({ number, title, children, aside }: { number?: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {number != null ? (
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{number}</Text>
          </View>
        ) : null}
        <Text style={[text.headline, { flex: 1, color: colors.ink }]}>{title}</Text>
        {aside}
      </View>
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------ step 1 */

const TYPES: { value: ApiVendorType; label: string; description: string; icon: { sf: string; md: string } }[] = [
  {
    value: VENDOR_TYPE.itinerant,
    label: 'Bán hàng lưu động',
    description: 'Không có địa điểm cố định, chọn ô trống trên bản đồ vỉa hè.',
    icon: { sf: 'cart.fill', md: 'shopping_cart' },
  },
  {
    value: VENDOR_TYPE.fixedStorefront,
    label: 'Cửa hàng cố định',
    description: 'Có địa chỉ kinh doanh cố định, thuê ô liền kề mặt tiền.',
    icon: { sf: 'storefront.fill', md: 'storefront' },
  },
];

/** V04 (REG-01 step 1): how the household sells decides what the next steps ask (BR-07). */
export function RegistrationTypeStep() {
  const vendorType = useNewRegistrationStore((s) => s.vendorType);
  const registrationId = useNewRegistrationStore((s) => s.registrationId);
  const setField = useNewRegistrationStore((s) => s.setField);
  const { registrations } = useRegistrations();
  const pending = registrationId
    ? undefined
    : registrations.find((r) => r.registrationStatus === 'SUBMITTED' || r.registrationStatus === 'UNDER_REVIEW');
  const fixed = vendorType === VENDOR_TYPE.fixedStorefront;

  return (
    <Screen footer={<Button label="Tiếp tục" size={56} onPress={() => go('/vendor/home/registrations/new/details')} />}>
      <Stack.Screen options={{ title: registrationId ? 'Cập nhật hồ sơ' : 'Đăng ký kinh doanh' }} />
      <WizardProgress step={1} />
      <Question hint="Lựa chọn này quyết định các bước sau sẽ hỏi những gì.">Bạn bán theo cách nào?</Question>
      <View style={{ gap: 12 }} accessibilityRole="radiogroup">
        {TYPES.map((t) => {
          const on = t.value === vendorType;
          return (
            <PressableScale
              key={t.value}
              onPress={() => setField('vendorType', t.value)}
              accessibilityRole="radio"
              selected={on}
              accessibilityLabel={`${t.label}. ${t.description}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 16,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.cta : colors.line,
                backgroundColor: on ? colors.brandTint : colors.card,
              }}
            >
              <View style={{ width: 52, height: 52, borderRadius: 16, borderCurve: 'continuous', backgroundColor: on ? colors.cta : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={t.icon.sf} md={t.icon.md} size={25} color={on ? colors.white : colors.muted} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.ink }}>{t.label}</Text>
                <Text style={[text.footnote, { color: '#2B3640' }]}>{t.description}</Text>
              </View>
              <Icon sf={on ? 'checkmark.circle.fill' : 'circle'} md={on ? 'check_circle' : 'radio_button_unchecked'} size={24} color={on ? colors.cta : colors.line} />
            </PressableScale>
          );
        })}
      </View>

      <Banner
        tone={fixed ? 'warning' : 'success'}
        title={fixed ? 'Cần giấy phép kinh doanh' : 'Thường được miễn giấy phép kinh doanh'}
        action={{ label: 'Căn cứ pháp lý', onPress: () => go(`${LEGAL_ROUTES.basis}?section=kinh-doanh`) }}
      >
        {fixed
          ? 'Cửa hàng có địa điểm cố định cần giấy phép kinh doanh hộ. Nếu bán đồ ăn, thức uống thì cần thêm cam kết hoặc giấy ATTP.'
          : 'Bán hàng rong, quà vặt, lưu động (không có địa điểm cố định) thường được miễn đăng ký. Nếu bán đồ ăn, thức uống, bạn vẫn phải cam kết an toàn thực phẩm.'}
      </Banner>

      {pending ? (
        <Banner tone="warning" action={{ label: `Mở hồ sơ ${pending.displayName}`, onPress: () => go(`/vendor/home/registrations/${pending.registrationId}`) }}>
          {`Bạn đang có hồ sơ ${pending.displayName} chờ Phường xét. Muốn sửa hồ sơ đó, mở hồ sơ rồi chọn “Cập nhật hồ sơ”.`}
        </Banner>
      ) : null}

      <SectionCard title="Chuẩn bị trước">
        {requiredEvidence(vendorType).map((t) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon sf="checkmark.circle.fill" md="check_circle" size={18} color={colors.leaf} />
            <Text style={[text.callout, { color: colors.ink }]}>{EVIDENCE_LABELS[t]}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon sf="person.crop.square" md="portrait" size={18} color={colors.muted} />
          <Text style={[text.callout, { color: colors.muted }]}>Ảnh chân dung (không bắt buộc, để đối chiếu khuôn mặt)</Text>
        </View>
        <Text style={[text.footnote, { color: colors.muted }]}>Bản nháp được giữ trong lúc bạn làm. Thoát app giữa chừng sẽ mất bản nháp.</Text>
      </SectionCard>
    </Screen>
  );
}

/* ------------------------------------------------------------------ step 2 */

/** V05 (REG-01 step 2): name, managing ward, address (required for a fixed shop), position. */
export function RegistrationDetailsStep() {
  const draft = useNewRegistrationStore();
  const { wards, loading: wardsLoading } = useWards();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [wardSheet, setWardSheet] = useState(false);
  const [locating, setLocating] = useState(false);
  const needsAddress = draft.vendorType === VENDOR_TYPE.fixedStorefront;
  const ward = wards.find((w) => w.unitId === draft.wardUnitId);

  const submit = () => {
    const next: Record<string, string | undefined> = {};
    if (!draft.displayName.trim()) next.displayName = 'Vui lòng nhập tên hộ kinh doanh.';
    if (!draft.wardUnitId) next.ward = 'Vui lòng chọn phường/xã.';
    if (needsAddress && !draft.declaredAddress.trim()) next.address = 'Cửa hàng cố định cần địa chỉ kinh doanh.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    go('/vendor/home/registrations/new/owner');
  };

  const useHere = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        showToast('Chưa có quyền vị trí. Bạn có thể bỏ qua toạ độ.', 'info');
        return;
      }
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      draft.setField('addressLatitude', Number(fix.coords.latitude.toFixed(6)));
      draft.setField('addressLongitude', Number(fix.coords.longitude.toFixed(6)));
    } catch {
      showToast('Không lấy được vị trí. Thử lại sau.', 'error');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Screen footer={<Button label="Tiếp tục" size={56} onPress={submit} />}>
      <Stack.Screen options={{ title: 'Thông tin hộ kinh doanh' }} />
      <WizardProgress step={2} />
      <Question hint="Tên hiển thị trên biển hiệu và giấy phép.">Hộ kinh doanh của bạn</Question>
      <TextField
        label="Tên hộ kinh doanh"
        icon={{ sf: 'signpost.right.fill', md: 'signpost' }}
        value={draft.displayName}
        onChangeText={(v) => {
          draft.setField('displayName', v);
          setErrors((e) => ({ ...e, displayName: undefined }));
        }}
        maxLength={180}
        error={errors.displayName}
        placeholder="Ví dụ: Bánh mì Cô Hoa"
        hint={`${draft.displayName.length}/180 ký tự`}
      />
      {draft.displayName.trim() ? (
        <View style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.plate, borderWidth: 2, borderColor: colors.white, boxShadow: '0 0 0 2px #111C2B' }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 18, color: colors.white, letterSpacing: 0.5 }} numberOfLines={1}>
            {draft.displayName.trim().toUpperCase()}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Phường/xã quản lý</Text>
        <Pressable
          onPress={() => setWardSheet(true)}
          disabled={wardsLoading}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.control, borderWidth: errors.ward ? 1.5 : 1, borderColor: errors.ward ? colors.danger : colors.line, backgroundColor: colors.card }}
        >
          <Icon sf="building.columns.fill" md="account_balance" size={18} color={colors.muted} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: ward ? colors.ink : colors.muted }}>
            {ward ? ward.unitName : wardsLoading ? 'Đang tải…' : 'Chọn phường/xã'}
          </Text>
          <Icon sf="chevron.down" md="expand_more" size={14} color={colors.muted} />
        </Pressable>
        {errors.ward ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.ward}</Text> : (
          <Text style={[text.footnote, { color: colors.muted }]}>Hồ sơ được gửi tới cán bộ phường này xét duyệt.</Text>
        )}
      </View>

      <TextField
        label="Địa chỉ kinh doanh"
        optional={!needsAddress}
        icon={{ sf: 'mappin.and.ellipse', md: 'location_on' }}
        value={draft.declaredAddress}
        onChangeText={(v) => {
          draft.setField('declaredAddress', v);
          setErrors((e) => ({ ...e, address: undefined }));
        }}
        error={errors.address}
        placeholder="Số nhà, tên đường"
      />

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon sf="location.fill" md="my_location" size={18} color={colors.sign} />
          <Text style={[text.headline, { flex: 1, color: colors.ink }]}>Toạ độ (không bắt buộc)</Text>
        </View>
        <Text style={[text.footnote, { color: colors.muted }]}>
          Đứng tại nơi bán rồi bấm nút dưới đây. Phường dùng toạ độ để đối chiếu vị trí.
        </Text>
        {draft.addressLatitude != null && draft.addressLongitude != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[{ flex: 1, fontFamily: fonts.code, fontSize: 15, color: colors.ink }, tabular]}>
              {draft.addressLatitude}, {draft.addressLongitude}
            </Text>
            <Pressable
              onPress={() => {
                draft.setField('addressLatitude', null);
                draft.setField('addressLongitude', null);
              }}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>Xoá</Text>
            </Pressable>
          </View>
        ) : null}
        <Button label={locating ? 'Đang lấy vị trí…' : 'Dùng vị trí hiện tại'} variant="secondary" icon={{ sf: 'location.fill', md: 'my_location' }} loading={locating} onPress={useHere} />
      </Card>

      <Sheet visible={wardSheet} onClose={() => setWardSheet(false)} title="Phường/xã quản lý">
        {wards.map((w, i) => (
          <SheetOption
            key={w.unitId}
            title={w.unitName}
            subtitle={w.parentName ?? undefined}
            icon={{ sf: 'building.columns.fill', md: 'account_balance' }}
            selected={w.unitId === draft.wardUnitId}
            last={i === wards.length - 1}
            onPress={() => {
              draft.setField('wardUnitId', w.unitId);
              setErrors((e) => ({ ...e, ward: undefined }));
              setWardSheet(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

/* ------------------------------------------------------------------ photos */

type UploadState = 'uploading' | 'done' | 'error';

/** One document tile: the photo (or PDF mark), its upload state, retake/remove. */
function DocTile({
  label,
  type,
  required,
  onPick,
  state,
}: {
  label: string;
  type: ApiEvidenceType;
  required?: boolean;
  onPick: () => void;
  state?: UploadState;
}) {
  const item = useNewRegistrationStore((s) => s.evidence.find((e) => e.evidenceType === type));
  const remove = useNewRegistrationStore((s) => s.removeEvidence);
  const isPdf = item?.file?.type === 'application/pdf' || item?.uri.toLowerCase().endsWith('.pdf');
  return (
    <View style={{ flex: 1, minWidth: '46%', gap: 6 }}>
      <Pressable
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel={item ? `${label}: đã chọn. Bấm để chọn lại` : `Chọn ${label}`}
        style={{
          height: 118,
          borderRadius: 16,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: item ? 0 : 1.5,
          borderStyle: 'dashed',
          borderColor: required ? colors.cta : colors.line,
          backgroundColor: item ? colors.sunken : colors.brandTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item && !isPdf ? (
          <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : item && isPdf ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Icon sf="doc.richtext.fill" md="picture_as_pdf" size={30} color={colors.danger} />
            <Text style={[text.caption, { color: colors.ink }]} numberOfLines={1}>
              {item.file?.name ?? 'PDF'}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Icon sf="camera.fill" md="photo_camera" size={24} color={colors.primary} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.primary }}>Thêm ảnh</Text>
          </View>
        )}
        {state ? (
          <View style={{ position: 'absolute', right: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: state === 'error' ? colors.dangerTint : state === 'done' ? colors.leafTint : colors.white }}>
            {state === 'uploading' ? <ActivityIndicator size="small" color={colors.cta} /> : (
              <Icon sf={state === 'done' ? 'checkmark' : 'exclamationmark'} md={state === 'done' ? 'check' : 'priority_high'} size={11} color={state === 'done' ? colors.leaf : colors.danger} weight="bold" />
            )}
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: state === 'error' ? colors.onDanger : state === 'done' ? colors.onLeaf : colors.ink }}>
              {state === 'uploading' ? 'Đang tải' : state === 'done' ? 'Đã tải' : 'Lỗi'}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[text.footnote, { flex: 1, color: colors.ink, fontFamily: fonts.semibold }]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
        {item ? (
          <Pressable onPress={() => remove(type)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Bỏ ${label}`}>
            <Icon sf="trash" md="delete" size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Picks, checks and (optionally) uploads a document straight away (eKYC needs a stored URL). */
function useDocPicker(uploadNow: boolean) {
  const draft = useNewRegistrationStore();
  const { pick, sheet } = useFilePicker();
  const [state, setState] = useState<Partial<Record<ApiEvidenceType, UploadState>>>({});
  const [error, setError] = useState<string>();

  const choose = async (type: ApiEvidenceType, allowPdf = true) => {
    const file: PickedFile | null = await pick(EVIDENCE_LABELS[type], allowPdf);
    if (!file) return;
    const problem = evidenceFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(undefined);
    draft.addEvidence({ evidenceType: type, uri: file.uri, file, label: EVIDENCE_LABELS[type] });
    if (!uploadNow) return;
    setState((s) => ({ ...s, [type]: 'uploading' }));
    try {
      const uploaded = await vendorRegistrationApi.uploadEvidenceFile(file);
      draft.patchEvidence(type, { uploadedUrl: uploaded.fileUrl });
      setState((s) => ({ ...s, [type]: 'done' }));
    } catch (err) {
      setError(errorMessage(err));
      setState((s) => ({ ...s, [type]: 'error' }));
    }
  };
  return { choose, state, error, setError, sheet };
}

/* ------------------------------------------------------------------ step 3 */

type AiKey = 'ownerDateOfBirth' | 'ownerGender' | 'ownerNationality' | 'ownerEthnicity' | 'permanentAddress' | 'idIssuedDate' | 'idIssuedPlace';

function kycErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    const wait = err.retryAfterSeconds ? ` Vui lòng thử lại sau ${err.retryAfterSeconds} giây.` : ' Vui lòng thử lại sau ít phút.';
    return `Dịch vụ eKYC đang bận hoặc đã đạt giới hạn lượt quét.${wait} Bạn vẫn có thể nhập thông tin thủ công bên dưới và cán bộ phường sẽ đối chiếu giấy tờ.`;
  }
  return errorMessage(err);
}

/** V06 (REG-01 step 3): owner (Mẫu số 01), business, household members, food-safety commitment, with [AI] CCCD reading. */
export function RegistrationOwnerStep() {
  const draft = useNewRegistrationStore();
  const docs = useDocPicker(true);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [ai, setAi] = useState<Set<AiKey>>(() => new Set());
  const [scanning, setScanning] = useState(false);
  const [matching, setMatching] = useState(false);
  const [extraction, setExtraction] = useState<KycIdCardExtraction | null>(null);
  const [face, setFace] = useState<KycFaceMatchResult | null>(null);
  const front = draft.evidence.find((e) => e.evidenceType === EVIDENCE_TYPE.identityDocument);
  const back = draft.evidence.find((e) => e.evidenceType === EVIDENCE_TYPE.identityDocumentBack);
  const selfie = draft.evidence.find((e) => e.evidenceType === EVIDENCE_TYPE.portraitSelfie);

  const clearAi = (k: AiKey) =>
    setAi((cur) => {
      if (!cur.has(k)) return cur;
      const next = new Set(cur);
      next.delete(k);
      return next;
    });
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K], aiKey?: AiKey) => {
    draft.setField(key as never, value as never);
    setErrors((e) => ({ ...e, [key as string]: undefined }));
    if (aiKey) clearAi(aiKey);
  };

  const scan = async () => {
    if (!draft.biometricConsent) {
      docs.setError('Vui lòng đồng ý cho phép đối soát dữ liệu sinh trắc học trước khi quét CCCD.');
      return;
    }
    if (!front?.uploadedUrl) {
      docs.setError('Vui lòng tải ảnh mặt trước CCCD.');
      return;
    }
    setScanning(true);
    docs.setError(undefined);
    try {
      const r = await vendorKycApi.extractIdCard({ frontFileUrl: front.uploadedUrl, backFileUrl: back?.uploadedUrl ?? null, biometricConsent: true });
      setExtraction(r);
      const filled: AiKey[] = [];
      if (r.dateOfBirth) {
        draft.setField('ownerDateOfBirth', r.dateOfBirth);
        filled.push('ownerDateOfBirth');
      }
      if (r.gender) {
        draft.setField('ownerGender', r.gender);
        filled.push('ownerGender');
      }
      if (r.nationality) {
        draft.setField('ownerNationality', r.nationality);
        filled.push('ownerNationality');
      }
      if (r.ethnicity) {
        draft.setField('ownerEthnicity', r.ethnicity);
        filled.push('ownerEthnicity');
      }
      if (r.permanentAddress) {
        draft.setField('permanentAddress', r.permanentAddress);
        filled.push('permanentAddress');
      }
      if (r.idIssuedDate) {
        draft.setField('idIssuedDate', r.idIssuedDate);
        filled.push('idIssuedDate');
      }
      if (r.idIssuedPlace) {
        draft.setField('idIssuedPlace', r.idIssuedPlace);
        filled.push('idIssuedPlace');
      }
      setAi((cur) => new Set([...cur, ...filled]));
      showToast(r.isAiGenerated ? 'Đã đọc thông tin từ CCCD. Hãy kiểm tra lại từng trường.' : r.summary);
    } catch (err) {
      docs.setError(kycErrorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  const matchFace = async () => {
    if (!draft.biometricConsent) {
      docs.setError('Vui lòng đồng ý cho phép đối soát dữ liệu sinh trắc học trước khi đối chiếu khuôn mặt.');
      return;
    }
    if (!selfie?.uploadedUrl || !front?.uploadedUrl) {
      docs.setError('Cần cả ảnh chân dung và ảnh mặt trước CCCD để đối chiếu.');
      return;
    }
    setMatching(true);
    docs.setError(undefined);
    try {
      const r = await vendorKycApi.matchFace({ selfieFileUrl: selfie.uploadedUrl, idCardFrontFileUrl: front.uploadedUrl, biometricConsent: true });
      setFace(r);
      showToast(r.summary);
    } catch (err) {
      docs.setError(kycErrorMessage(err));
    } finally {
      setMatching(false);
    }
  };

  const submit = () => {
    const n: Record<string, string | undefined> = {};
    if (!draft.ownerDateOfBirth) n.ownerDateOfBirth = 'Vui lòng nhập ngày sinh của chủ hộ kinh doanh.';
    if (!draft.ownerGender) n.ownerGender = 'Vui lòng chọn giới tính.';
    if (!draft.ownerNationality.trim()) n.ownerNationality = 'Vui lòng nhập quốc tịch.';
    if (!draft.idType) n.idType = 'Vui lòng chọn loại giấy tờ pháp lý.';
    if (!draft.idIssuedDate) n.idIssuedDate = 'Vui lòng nhập ngày cấp.';
    if (!draft.idIssuedPlace.trim()) n.idIssuedPlace = 'Vui lòng nhập nơi cấp.';
    if (!draft.permanentAddress.trim()) n.permanentAddress = 'Vui lòng nhập địa chỉ thường trú theo CCCD.';
    if (!draft.businessLine.trim()) n.businessLine = 'Vui lòng nhập ngành, nghề kinh doanh.';
    if (!draft.capitalAmount.trim()) n.capitalAmount = 'Vui lòng nhập vốn kinh doanh.';
    if (!draft.laborCount.trim()) n.laborCount = 'Vui lòng nhập số lao động.';
    if (!draft.plannedStartDate) n.plannedStartDate = 'Vui lòng nhập ngày dự kiến bắt đầu hoạt động.';
    if (!draft.foodSafetyCommitment) n.foodSafetyCommitment = 'Vui lòng xác nhận cam kết an toàn thực phẩm.';
    setErrors(n);
    if (Object.values(n).some(Boolean)) {
      showToast('Còn vài thông tin chưa điền, xem các ô báo đỏ.', 'error');
      return;
    }
    go('/vendor/home/registrations/new/evidence');
  };

  const tag = (k: AiKey) => (ai.has(k) ? <AiTag label="đọc từ CCCD" /> : null);
  const capital = parseVndAmount(draft.capitalAmount);

  return (
    <Screen footer={<Button label="Tiếp tục" size={56} onPress={submit} />}>
      <Stack.Screen options={{ title: 'Chủ hộ kinh doanh' }} />
      <WizardProgress step={3} />

      {/* eKYC */}
      <View style={[aiPanel, { gap: 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon sf="sparkles" md="auto_awesome" size={18} color={colors.onMango} />
          <Text style={[text.headline, { flex: 1, color: colors.ink }]}>Quét CCCD để tự động điền</Text>
          <AiTag label="eKYC" />
        </View>
        <Text style={[text.footnote, { color: '#2B3640' }]}>
          Mặt trước có ngày sinh, giới tính, quốc tịch, địa chỉ; mặt sau có dân tộc, ngày cấp, nơi cấp. Thông tin đọc được chỉ là gợi ý, bạn kiểm tra và sửa lại trước khi nộp. Cán bộ phường vẫn đối chiếu giấy tờ.
        </Text>
        <Checkbox checked={draft.biometricConsent} onChange={(v) => draft.setField('biometricConsent', v)}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink }}>
            Tôi đồng ý cho StreetBiz dùng ảnh CCCD và ảnh chân dung để đọc thông tin và đối chiếu khuôn mặt (dữ liệu sinh trắc học).
          </Text>
        </Checkbox>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <DocTile label="CCCD mặt trước" type={EVIDENCE_TYPE.identityDocument} required onPick={() => void docs.choose(EVIDENCE_TYPE.identityDocument, false)} state={docs.state[EVIDENCE_TYPE.identityDocument]} />
          <DocTile label="CCCD mặt sau" type={EVIDENCE_TYPE.identityDocumentBack} required onPick={() => void docs.choose(EVIDENCE_TYPE.identityDocumentBack, false)} state={docs.state[EVIDENCE_TYPE.identityDocumentBack]} />
        </View>
        <Button label={scanning ? 'Đang đọc CCCD…' : 'Đọc thông tin từ CCCD'} icon={{ sf: 'text.viewfinder', md: 'document_scanner' }} loading={scanning} onPress={scan} disabled={!front?.uploadedUrl} />
        {extraction ? (
          <View style={{ gap: 6 }}>
            <Text style={[text.footnote, { color: '#2B3640' }]}>
              Độ tin cậy {extraction.confidencePercent}%{extraction.fullName ? `, tên trên thẻ: ${extraction.fullName}` : ''}.
            </Text>
            {extraction.needsManualVerification ? <Banner tone="warning">Ảnh chưa đủ rõ, hãy kiểm tra kỹ từng trường được điền.</Banner> : null}
            {extraction.warnings.map((w) => (
              <Text key={w} style={[text.footnote, { color: colors.onMango }]}>• {w}</Text>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <DocTile label="Ảnh chân dung" type={EVIDENCE_TYPE.portraitSelfie} onPick={() => void docs.choose(EVIDENCE_TYPE.portraitSelfie, false)} state={docs.state[EVIDENCE_TYPE.portraitSelfie]} />
          <View style={{ flex: 1, gap: 8 }}>
            <Button label="Đối chiếu khuôn mặt" variant="secondary" loading={matching} onPress={matchFace} disabled={!selfie?.uploadedUrl} />
            {face ? (
              <Text style={[text.footnote, { color: face.isMatch ? colors.onLeaf : colors.onDanger }]}>
                {face.isMatch ? 'Khớp' : 'Chưa khớp'}, tương đồng {face.similarityPercent}%. {face.summary}
              </Text>
            ) : null}
          </View>
        </View>
        {docs.error ? <Banner tone="danger">{docs.error}</Banner> : null}
      </View>

      <SectionCard number={1} title="Thông tin chủ hộ (theo CCCD)">
        <View style={{ gap: 4 }}>
          {tag('ownerDateOfBirth')}
          <DateField label="Ngày sinh" value={draft.ownerDateOfBirth} onChange={(v) => set('ownerDateOfBirth', v, 'ownerDateOfBirth')} error={errors.ownerDateOfBirth} maximumDate={new Date()} />
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Giới tính</Text>
            {tag('ownerGender')}
          </View>
          <Segments
            value={draft.ownerGender || ('' as never)}
            options={[
              { key: OWNER_GENDER.male, label: 'Nam' },
              { key: OWNER_GENDER.female, label: 'Nữ' },
              { key: OWNER_GENDER.other, label: 'Khác' },
            ]}
            onChange={(v) => set('ownerGender', v, 'ownerGender')}
          />
          {errors.ownerGender ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.ownerGender}</Text> : null}
        </View>
        <View style={{ gap: 4 }}>
          {tag('ownerEthnicity')}
          <TextField label="Dân tộc" optional value={draft.ownerEthnicity} onChangeText={(v) => set('ownerEthnicity', v, 'ownerEthnicity')} placeholder="Kinh" />
        </View>
        <View style={{ gap: 4 }}>
          {tag('ownerNationality')}
          <TextField label="Quốc tịch" value={draft.ownerNationality} onChangeText={(v) => set('ownerNationality', v, 'ownerNationality')} error={errors.ownerNationality} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Giấy tờ pháp lý</Text>
          <Segments
            value={draft.idType || ('' as never)}
            options={[
              { key: OWNER_ID_TYPE.citizenId, label: 'CCCD' },
              { key: OWNER_ID_TYPE.passport, label: 'Hộ chiếu' },
            ]}
            onChange={(v) => set('idType', v)}
          />
          {errors.idType ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.idType}</Text> : null}
        </View>
        <View style={{ gap: 4 }}>
          {tag('idIssuedDate')}
          <DateField label="Ngày cấp" value={draft.idIssuedDate} onChange={(v) => set('idIssuedDate', v, 'idIssuedDate')} error={errors.idIssuedDate} maximumDate={new Date()} />
        </View>
        <View style={{ gap: 4 }}>
          {tag('idIssuedPlace')}
          <TextField label="Nơi cấp" value={draft.idIssuedPlace} onChangeText={(v) => set('idIssuedPlace', v, 'idIssuedPlace')} error={errors.idIssuedPlace} placeholder="Cục Cảnh sát QLHC về TTXH" />
        </View>
        <View style={{ gap: 4 }}>
          {tag('permanentAddress')}
          <TextField label="Địa chỉ thường trú" value={draft.permanentAddress} onChangeText={(v) => set('permanentAddress', v, 'permanentAddress')} error={errors.permanentAddress} multiline />
        </View>
        <TextField label="Địa chỉ liên lạc" optional value={draft.contactAddress} onChangeText={(v) => set('contactAddress', v)} placeholder="Nếu khác địa chỉ thường trú" />
      </SectionCard>

      <SectionCard number={2} title="Ngành nghề và quy mô">
        <TextField label="Ngành, nghề kinh doanh" value={draft.businessLine} onChangeText={(v) => set('businessLine', v)} error={errors.businessLine} placeholder="Ví dụ: Bán bánh mì, nước giải khát" />
        <TextField label="Mã ngành" optional value={draft.businessLineCode} onChangeText={(v) => set('businessLineCode', v)} keyboardType="number-pad" placeholder="5610" />
        <TextField
          label="Vốn kinh doanh"
          value={draft.capitalAmount}
          onChangeText={(v) => set('capitalAmount', v.replace(/[^\d]/g, ''))}
          error={errors.capitalAmount}
          keyboardType="number-pad"
          trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>}
          hint={capital != null ? formatVnd(capital) : undefined}
        />
        <TextField label="Số lao động" value={draft.laborCount} onChangeText={(v) => set('laborCount', v.replace(/[^\d]/g, ''))} error={errors.laborCount} keyboardType="number-pad" />
        <DateField label="Ngày dự kiến bắt đầu" value={draft.plannedStartDate} onChange={(v) => set('plannedStartDate', v)} error={errors.plannedStartDate} />
      </SectionCard>

      <SectionCard
        number={3}
        title="Thành viên hộ gia đình góp vốn"
        aside={<Text style={[text.caption, { color: colors.muted }]}>Không bắt buộc</Text>}
      >
        {draft.householdMembers.map((m, i) => (
          <View key={i} style={{ gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.bg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[text.subhead, { flex: 1, color: colors.ink }]}>Thành viên {i + 1}</Text>
              <Pressable onPress={() => draft.removeHouseholdMember(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Bỏ thành viên ${i + 1}`}>
                <Icon sf="trash" md="delete" size={16} color={colors.danger} />
              </Pressable>
            </View>
            <TextField label="Họ tên" value={m.fullName} onChangeText={(v) => draft.updateHouseholdMember(i, { fullName: v })} />
            <DateField label="Ngày sinh" optional value={m.dateOfBirth} onChange={(v) => draft.updateHouseholdMember(i, { dateOfBirth: v })} maximumDate={new Date()} />
            <TextField label="Số CCCD" optional value={m.idNumber} onChangeText={(v) => draft.updateHouseholdMember(i, { idNumber: v })} keyboardType="number-pad" />
            <TextField label="Quan hệ với chủ hộ" optional value={m.relationshipToOwner} onChangeText={(v) => draft.updateHouseholdMember(i, { relationshipToOwner: v })} />
            <TextField label="Vốn góp" optional value={m.capitalContribution} onChangeText={(v) => draft.updateHouseholdMember(i, { capitalContribution: v.replace(/[^\d]/g, '') })} keyboardType="number-pad" />
          </View>
        ))}
        <Button label="Thêm thành viên" variant="secondary" icon={{ sf: 'person.badge.plus', md: 'person_add' }} onPress={draft.addHouseholdMember} />
      </SectionCard>

      <SectionCard number={4} title="Cam kết an toàn thực phẩm">
        <Checkbox checked={draft.foodSafetyCommitment} onChange={(v) => set('foodSafetyCommitment', v)} error={errors.foodSafetyCommitment}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.ink }}>
            Tôi cam kết bảo đảm điều kiện an toàn thực phẩm khi kinh doanh đồ ăn, thức uống, theo quy định cho hộ kinh doanh nhỏ lẻ.
          </Text>
        </Checkbox>
      </SectionCard>
      {docs.sheet}
    </Screen>
  );
}

/* ------------------------------------------------------------------ step 4 */

/** V07 (REG-01/02/04 step 4): the remaining documents, a check of everything, then submit. */
export function RegistrationEvidenceStep() {
  const draft = useNewRegistrationStore();
  const queryClient = useQueryClient();
  const { wards } = useWards();
  const docs = useDocPicker(false);
  const [phase, setPhase] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState<string>();
  const required = requiredEvidence(draft.vendorType);
  const missing = required.filter((t) => !draft.evidence.some((e) => e.evidenceType === t));
  const editing = draft.registrationId != null;
  const optional: ApiEvidenceType[] = [EVIDENCE_TYPE.addressProof, EVIDENCE_TYPE.other].filter(
    (t) => !required.includes(t as never),
  ) as ApiEvidenceType[];
  const ward = wards.find((w) => w.unitId === draft.wardUnitId);

  const submit = async () => {
    if (missing.length) {
      setError(`Còn thiếu: ${missing.map((t) => EVIDENCE_LABELS[t]).join(', ')}.`);
      return;
    }
    setError(undefined);
    setPhase('sending');
    try {
      const reg = await submitRegistrationDraft();
      await queryClient.invalidateQueries({ queryKey: REGISTRATIONS_KEY });
      draft.reset();
      showToast(editing ? 'Đã cập nhật và gửi lại hồ sơ.' : 'Đã nộp hồ sơ. Phường sẽ xét và báo cho bạn.');
      router.dismissTo('/vendor/home/registrations' as Href);
      router.push(`/vendor/home/registrations/${reg.registrationId}` as Href);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? errorMessage(err) : 'Không nộp được hồ sơ.');
    } finally {
      setPhase('idle');
    }
  };

  const summary: [string, string][] = [
    ['Loại hình', draft.vendorType === VENDOR_TYPE.fixedStorefront ? 'Cửa hàng cố định' : 'Bán hàng lưu động'],
    ['Tên hộ', draft.displayName || '—'],
    ['Phường/xã', ward?.unitName ?? '—'],
    ['Ngành nghề', draft.businessLine || '—'],
    ['Vốn', parseVndAmount(draft.capitalAmount) != null ? formatVnd(parseVndAmount(draft.capitalAmount)!) : '—'],
  ];

  return (
    <Screen
      footer={
        <Button
          label={phase === 'sending' ? 'Đang gửi hồ sơ…' : editing ? 'Cập nhật và gửi lại' : 'Nộp hồ sơ'}
          size={56}
          icon={{ sf: 'paperplane.fill', md: 'send' }}
          loading={phase === 'sending'}
          onPress={submit}
        />
      }
    >
      <Stack.Screen options={{ title: 'Giấy tờ và nộp hồ sơ' }} />
      <WizardProgress step={4} />
      <Question hint="Giấy tờ chụp rõ, đủ bốn góc. Ảnh CCCD đã chọn ở bước trước được dùng lại.">Giấy tờ kèm theo</Question>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[...required, ...optional].map((t) => (
          <DocTile key={t} label={EVIDENCE_LABELS[t]} type={t} required={required.includes(t)} onPick={() => void docs.choose(t)} />
        ))}
      </View>
      {docs.error ? <Banner tone="danger">{docs.error}</Banner> : null}

      <SectionCard title="Kiểm tra lại">
        {summary.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', gap: 12 }}>
            <Text style={[text.subhead, { width: 96, color: colors.muted, fontFamily: fonts.regular }]}>{k}</Text>
            <Text style={[text.subhead, { flex: 1, color: colors.ink }]}>{v}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          {(['type', 'details', 'owner'] as const).map((s, i) => (
            <Pressable key={s} onPress={() => go(`/vendor/home/registrations/new/${s}`)} hitSlop={6} accessibilityRole="link">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Sửa bước {i + 1}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>
      {missing.length ? (
        <Banner tone="warning">Còn thiếu: {missing.map((t) => EVIDENCE_LABELS[t]).join(', ')}.</Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {docs.sheet}
    </Screen>
  );
}
