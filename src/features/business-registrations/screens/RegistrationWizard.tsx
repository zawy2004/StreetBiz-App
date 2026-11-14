import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, Stack, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ScrollView } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { PressableScale } from '@/components/common/PressableScale';
import { Sheet } from '@/components/common/Sheet';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { WardPickerList } from '@/components/forms/WardPickerList';
import { ResultView } from '@/components/native/ResultView';
import { SegmentedControl } from '@/components/native/SegmentedControl';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StepFooter } from '@/components/native/StepFlow';
import { AiTag } from '@/components/status/AiTag';
import {
  ApiError,
  errorMessage,
  EVIDENCE_TYPE,
  OWNER_GENDER,
  OWNER_ID_TYPE,
  VENDOR_TYPE,
  type ApiEvidenceType,
  type ApiOwnerGender,
  type ApiOwnerIdType,
  type ApiVendorType,
} from '@/core/api';
import { useWards } from '@/core/auth/useWards';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass } from '@/ui';
import { formatVnd } from '@/utils/format';
import { AI_FIELDS, IdCardCapture, type AiKey } from '../components/IdCardCapture';
import { ControlLabel, DocTile, FieldGroup, goStep, PickerField, returnToStep, SignPreview, useCloseFlow, useDocPicker, WizardStep, type StepKey } from '../components/WizardParts';
import { EVIDENCE_LABELS, parseVndAmount, requiredEvidence, useNewRegistrationStore } from '../new-registration-store';
import { submitRegistrationDraft } from '../submit-registration';
import { REGISTRATIONS_KEY, useRegistrations } from '../useRegistrations';
import { VoiceEntry } from '../voice/VoiceEntry';
import { afterWizardFiled } from '../voice/voice-filing';

type Errors = Record<string, string | undefined>;

/**
 * Remembers where each group sits in the step's scroll view, so a failed "Tiếp tục" can bring
 * the first group with a problem into view (the web scrolled and focused the first bad field).
 */
function useScrollToProblem<K extends string>(order: K[]) {
  const scroll = useRef<ScrollView>(null);
  const ys = useRef<Partial<Record<K, number>>>({});
  const at = (key: K) => (y: number) => {
    ys.current[key] = y;
  };
  const reveal = (bad: Partial<Record<K, boolean>>) => {
    const first = order.find((k) => bad[k]);
    if (first == null) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    scroll.current?.scrollTo({ y: Math.max(0, (ys.current[first] ?? 0) - 12), animated: true });
  };
  return { scroll, at, reveal };
}

const legalBasis = (section: string) => router.push(`${LEGAL_ROUTES.basis}?section=${section}` as Href);

/* ------------------------------------------------------------------ 1 · type */

const TYPES: { value: ApiVendorType; label: string; description: string; icon: { sf: string; md: string } }[] = [
  { value: VENDOR_TYPE.itinerant, label: 'Bán hàng lưu động', description: 'Không có chỗ cố định, chọn ô trống trên bản đồ vỉa hè.', icon: { sf: 'cart.fill', md: 'shopping_cart' } },
  { value: VENDOR_TYPE.fixedStorefront, label: 'Cửa hàng cố định', description: 'Có địa chỉ kinh doanh, thuê ô liền kề mặt tiền.', icon: { sf: 'storefront.fill', md: 'storefront' } },
];

/** V04 (REG-01, step 1/5): how the household sells decides what the next steps ask (BR-07). */
export function RegistrationTypeStep() {
  const vendorType = useNewRegistrationStore((s) => s.vendorType);
  const registrationId = useNewRegistrationStore((s) => s.registrationId);
  const setField = useNewRegistrationStore((s) => s.setField);
  const close = useCloseFlow();
  const { registrations } = useRegistrations();
  const pending = registrationId ? undefined : registrations.find((r) => r.registrationStatus === 'SUBMITTED' || r.registrationStatus === 'UNDER_REVIEW');
  const fixed = vendorType === VENDOR_TYPE.fixedStorefront;

  return (
    <WizardStep step="type" hint="Lựa chọn này quyết định các bước sau hỏi gì." footer={<StepFooter next={{ label: 'Tiếp tục', onPress: () => goStep('details') }} />}>
      {registrationId ? null : <VoiceEntry />}
      {pending ? (
        <StatusHeader
          tone="pending"
          title={`Hồ sơ ${pending.displayName} đang chờ phường xét`}
          detail="Muốn sửa hồ sơ đó, mở hồ sơ rồi chọn Cập nhật hồ sơ."
          action={{
            label: 'Mở hồ sơ',
            onPress: () => {
              close();
              router.push(`/vendor/home/registrations/${pending.registrationId}` as Href);
            },
          }}
        />
      ) : null}
      <View style={{ gap: 12 }} accessibilityRole="radiogroup">
        {TYPES.map((t) => {
          const on = t.value === vendorType;
          return (
            <PressableScale
              key={t.value}
              onPress={() => {
                if (!on) void Haptics.selectionAsync();
                setField('vendorType', t.value);
              }}
              accessibilityRole="radio"
              selected={on}
              accessibilityLabel={`${t.label}. ${t.description}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, minHeight: 104, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 2, borderColor: on ? colors.cta : 'transparent', backgroundColor: on ? colors.kerbPaint : colors.card, boxShadow: on ? shadow.glow : shadow.card }}
            >
              <View style={{ width: 60, height: 60, borderRadius: radius.full, backgroundColor: on ? colors.cta : colors.brandTint, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
                <Icon sf={t.icon.sf} md={t.icon.md} size={27} color={on ? colors.white : colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 17.5, lineHeight: 23, color: colors.ink }}>{t.label}</Text>
                <Text style={[text.footnote, { color: colors.muted }]}>{t.description}</Text>
              </View>
              <Icon sf={on ? 'checkmark.circle.fill' : 'circle'} md={on ? 'check_circle' : 'radio_button_unchecked'} size={26} color={on ? colors.cta : colors.line} />
            </PressableScale>
          );
        })}
      </View>

      <StatusHeader
        tone={fixed ? 'pending' : 'ok'}
        icon={{ sf: 'building.columns.fill', md: 'account_balance' }}
        title={fixed ? 'Cần giấy phép kinh doanh' : 'Thường được miễn giấy phép kinh doanh'}
        detail={fixed ? 'Bán đồ ăn, thức uống thì thêm cam kết an toàn thực phẩm.' : 'Bán đồ ăn, thức uống vẫn phải cam kết an toàn thực phẩm.'}
        action={{ label: 'Căn cứ pháp lý', onPress: () => legalBasis('kinh-doanh') }}
      />

      <ListGroup title="Chuẩn bị trước" footer="Đóng giữa chừng vẫn giữ bản nháp. Thoát hẳn ứng dụng thì bản nháp mất.">
        {requiredEvidence(vendorType).map((t) => (
          <ListRow key={t} title={EVIDENCE_LABELS[t]} subtitle="Bắt buộc" icon={{ sf: t === EVIDENCE_TYPE.businessLicense ? 'doc.text.fill' : 'person.text.rectangle', md: t === EVIDENCE_TYPE.businessLicense ? 'description' : 'badge' }} chevron={false} />
        ))}
        <ListRow title="Ảnh chân dung" subtitle="Không bắt buộc, để đối chiếu khuôn mặt" icon={{ sf: 'person.crop.square', md: 'portrait' }} tint={colors.muted} tileColor={colors.sunken} chevron={false} />
      </ListGroup>
    </WizardStep>
  );
}

/* ------------------------------------------------------------------ 2 · details */

type DetailsKey = 'name' | 'ward' | 'address';

/** V05 (REG-01, step 2/5): the sign's name, the managing ward, the address (required for a shop), the position. */
export function RegistrationDetailsStep() {
  const draft = useNewRegistrationStore();
  const { wards, loading: wardsLoading, error: wardsError, refetch } = useWards();
  const [errors, setErrors] = useState<Errors>({});
  const [wardSheet, setWardSheet] = useState(false);
  const [locating, setLocating] = useState(false);
  const needsAddress = draft.vendorType === VENDOR_TYPE.fixedStorefront;
  const ward = wards.find((w) => w.unitId === draft.wardUnitId);
  const place = useScrollToProblem<DetailsKey>(['name', 'ward', 'address']);

  const submit = () => {
    const next: Errors = {};
    if (!draft.displayName.trim()) next.displayName = 'Nhập tên hộ kinh doanh.';
    if (!draft.wardUnitId) next.ward = 'Chọn phường/xã quản lý.';
    if (needsAddress && !draft.declaredAddress.trim()) next.address = 'Cửa hàng cố định cần địa chỉ kinh doanh.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return place.reveal({ name: !!next.displayName, ward: !!next.ward, address: !!next.address });
    goStep('owner');
  };

  const locateHere = async () => {
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showToast('Không lấy được vị trí. Thử lại sau.', 'error');
    } finally {
      setLocating(false);
    }
  };
  const hasPoint = draft.addressLatitude != null && draft.addressLongitude != null;

  return (
    <WizardStep step="details" hint="Tên này in trên biển hiệu và giấy phép." scrollRef={place.scroll} footer={<StepFooter next={{ label: 'Tiếp tục', onPress: submit }} />}>
      {/* The household's sign, painted as the name is typed */}
      <SignPreview name={draft.displayName} />
      <FieldGroup title="Tên trên biển hiệu" onLayout={place.at('name')}>
        <TextField
          label="Tên hộ kinh doanh"
          value={draft.displayName}
          onChangeText={(v) => {
            draft.setField('displayName', v);
            setErrors((e) => ({ ...e, displayName: undefined }));
          }}
          maxLength={180}
          error={errors.displayName}
          placeholder="Ví dụ: Bánh mì Cô Hoa"
          hint={`${draft.displayName.length}/180 ký tự`}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </FieldGroup>

      <FieldGroup title="Nơi quản lý và địa điểm" onLayout={place.at('ward')}>
        <ControlLabel label="Phường/xã quản lý" error={errors.ward ?? wardsError}>
          <PickerField
            onPress={() => (wardsError ? void refetch() : setWardSheet(true))}
            loading={wardsLoading}
            error={!!errors.ward}
            accessibilityLabel={`Phường/xã quản lý: ${ward?.unitName ?? 'chưa chọn'}`}
            icon={{ sf: 'building.columns.fill', md: 'account_balance' }}
            value={ward?.unitName}
            placeholder={wardsLoading ? 'Đang tải danh sách…' : wardsError ? 'Bấm để tải lại' : 'Chọn phường/xã'}
          />
        </ControlLabel>
        <View onLayout={(e) => place.at('address')(e.nativeEvent.layout.y)}>
          <TextField
            label="Địa chỉ kinh doanh"
            optional={!needsAddress}
            value={draft.declaredAddress}
            onChangeText={(v) => {
              draft.setField('declaredAddress', v);
              setErrors((e) => ({ ...e, address: undefined }));
            }}
            error={errors.address}
            placeholder="Số nhà, tên đường"
            autoCapitalize="words"
          />
        </View>
      </FieldGroup>

      <ListGroup title="Vị trí bán" footer="Đứng tại chỗ bán rồi lấy vị trí. Phường dùng để đối chiếu địa điểm.">
        <ListRow
          title={hasPoint ? `${draft.addressLatitude}, ${draft.addressLongitude}` : 'Dùng vị trí hiện tại'}
          subtitle={hasPoint ? 'Bấm để lấy lại' : 'Không bắt buộc'}
          icon={{ sf: hasPoint ? 'mappin.circle.fill' : 'location.fill', md: hasPoint ? 'where_to_vote' : 'my_location' }}
          tint={hasPoint ? colors.white : colors.primary}
          tileColor={hasPoint ? colors.cta : colors.brandTint}
          onPress={() => void locateHere()}
          disabled={locating}
          chevron={false}
          accessory={
            locating ? (
              <ActivityIndicator color={colors.cta} />
            ) : hasPoint ? (
              <Pressable
                onPress={() => {
                  draft.setField('addressLatitude', null);
                  draft.setField('addressLongitude', null);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Xoá toạ độ"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.primary }}>Xoá</Text>
              </Pressable>
            ) : undefined
          }
        />
      </ListGroup>

      <Sheet visible={wardSheet} onClose={() => setWardSheet(false)} title="Phường/xã quản lý" subtitle="Hồ sơ tới cán bộ phường này xét duyệt.">
        <WardPickerList
          wards={wards}
          selectedId={draft.wardUnitId}
          icon={{ sf: 'building.columns.fill', md: 'account_balance' }}
          onPick={(w) => {
            draft.setField('wardUnitId', w.unitId);
            setErrors((e) => ({ ...e, ward: undefined }));
            setWardSheet(false);
          }}
        />
      </Sheet>
    </WizardStep>
  );
}

/* ------------------------------------------------------------------ 3 · owner + CCCD */

/**
 * V06 (REG-01, step 3/5): the owner as on the CCCD (Mẫu số 01). Scanning the card with [AI]
 * only fills fields that are empty-able suggestions, each tagged [AI] until the person edits it.
 */
export function RegistrationOwnerStep() {
  const draft = useNewRegistrationStore();
  const [errors, setErrors] = useState<Errors>({});
  const [ai, setAi] = useState<Set<AiKey>>(() => new Set());
  const place = useScrollToProblem<'owner' | 'card'>(['owner']);

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

  const submit = () => {
    const n: Errors = {};
    if (!draft.ownerDateOfBirth) n.ownerDateOfBirth = 'Chọn ngày sinh của chủ hộ.';
    if (!draft.ownerGender) n.ownerGender = 'Chọn giới tính.';
    if (!draft.ownerNationality.trim()) n.ownerNationality = 'Nhập quốc tịch.';
    if (!draft.idType) n.idType = 'Chọn loại giấy tờ.';
    if (!draft.idIssuedDate) n.idIssuedDate = 'Chọn ngày cấp.';
    if (!draft.idIssuedPlace.trim()) n.idIssuedPlace = 'Nhập nơi cấp.';
    if (!draft.permanentAddress.trim()) n.permanentAddress = 'Nhập địa chỉ thường trú theo CCCD.';
    setErrors(n);
    if (Object.values(n).some(Boolean)) return place.reveal({ owner: true });
    goStep('business');
  };

  const tag = (k: AiKey) => (ai.has(k) ? <AiTag label="đọc từ CCCD" /> : null);
  const filledCount = AI_FIELDS.filter((k) => ai.has(k)).length;

  return (
    <WizardStep step="owner" hint="Điền đúng như trên CCCD của chủ hộ." scrollRef={place.scroll} footer={<StepFooter next={{ label: 'Tiếp tục', onPress: submit }} />}>
      {/* [AI] scan: optional help, never required to go on */}
      <IdCardCapture
        filledCount={filledCount}
        onFilled={(filled) => {
          setAi((cur) => new Set([...cur, ...filled]));
          setErrors((e) => ({ ...e, ...Object.fromEntries(filled.map((k) => [k, undefined])) }));
        }}
      />

      <FieldGroup title="Thông tin chủ hộ" note="Theo Mẫu số 01, khớp với CCCD." onLayout={place.at('owner')}>
        <View style={{ gap: 6 }}>
          {tag('ownerDateOfBirth')}
          <DateField label="Ngày sinh" value={draft.ownerDateOfBirth} onChange={(v) => set('ownerDateOfBirth', v, 'ownerDateOfBirth')} error={errors.ownerDateOfBirth} maximumDate={new Date()} />
        </View>
        <ControlLabel label="Giới tính" tag={tag('ownerGender')} error={errors.ownerGender}>
          <SegmentedControl<ApiOwnerGender>
            value={draft.ownerGender || null}
            options={[
              { key: OWNER_GENDER.male, label: 'Nam' },
              { key: OWNER_GENDER.female, label: 'Nữ' },
              { key: OWNER_GENDER.other, label: 'Khác' },
            ]}
            onChange={(v) => set('ownerGender', v, 'ownerGender')}
          />
        </ControlLabel>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            {tag('ownerEthnicity')}
            <TextField label="Dân tộc" optional value={draft.ownerEthnicity} onChangeText={(v) => set('ownerEthnicity', v, 'ownerEthnicity')} placeholder="Kinh" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {tag('ownerNationality')}
            <TextField label="Quốc tịch" value={draft.ownerNationality} onChangeText={(v) => set('ownerNationality', v, 'ownerNationality')} error={errors.ownerNationality} />
          </View>
        </View>
        <ControlLabel label="Giấy tờ pháp lý" error={errors.idType}>
          <SegmentedControl<ApiOwnerIdType>
            value={draft.idType || null}
            options={[
              { key: OWNER_ID_TYPE.citizenId, label: 'CCCD gắn chip' },
              { key: OWNER_ID_TYPE.passport, label: 'Hộ chiếu' },
            ]}
            onChange={(v) => set('idType', v)}
          />
        </ControlLabel>
        <View style={{ gap: 6 }}>
          {tag('idIssuedDate')}
          <DateField label="Ngày cấp" value={draft.idIssuedDate} onChange={(v) => set('idIssuedDate', v, 'idIssuedDate')} error={errors.idIssuedDate} maximumDate={new Date()} />
        </View>
        <View style={{ gap: 6 }}>
          {tag('idIssuedPlace')}
          <TextField label="Nơi cấp" value={draft.idIssuedPlace} onChangeText={(v) => set('idIssuedPlace', v, 'idIssuedPlace')} error={errors.idIssuedPlace} placeholder="Cục Cảnh sát QLHC về TTXH" />
        </View>
        <View style={{ gap: 6 }}>
          {tag('permanentAddress')}
          <TextField label="Địa chỉ thường trú" value={draft.permanentAddress} onChangeText={(v) => set('permanentAddress', v, 'permanentAddress')} error={errors.permanentAddress} multiline />
        </View>
        <TextField label="Chỗ ở hiện tại" optional value={draft.contactAddress} onChangeText={(v) => set('contactAddress', v)} placeholder="Nếu khác địa chỉ thường trú" />
      </FieldGroup>
    </WizardStep>
  );
}

/* ------------------------------------------------------------------ 4 · business */

/** V06 (REG-01, step 4/5): business line and size, household members who contribute, the food-safety commitment. */
export function RegistrationBusinessStep() {
  const draft = useNewRegistrationStore();
  const [errors, setErrors] = useState<Errors>({});
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const place = useScrollToProblem<'business' | 'commit'>(['business', 'commit']);
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    draft.setField(key as never, value as never);
    setErrors((e) => ({ ...e, [key as string]: undefined }));
  };
  const capital = parseVndAmount(draft.capitalAmount);

  const submit = () => {
    const n: Errors = {};
    if (!draft.businessLine.trim()) n.businessLine = 'Nhập ngành, nghề kinh doanh.';
    if (!draft.capitalAmount.trim()) n.capitalAmount = 'Nhập vốn kinh doanh.';
    if (!draft.laborCount.trim()) n.laborCount = 'Nhập số lao động.';
    if (!draft.plannedStartDate) n.plannedStartDate = 'Chọn ngày dự kiến bắt đầu.';
    if (!draft.foodSafetyCommitment) n.foodSafetyCommitment = 'Đánh dấu cam kết an toàn thực phẩm.';
    setErrors(n);
    if (Object.values(n).some(Boolean)) return place.reveal({ business: !!(n.businessLine || n.capitalAmount || n.laborCount || n.plannedStartDate), commit: !!n.foodSafetyCommitment });
    goStep('documents');
  };

  return (
    <WizardStep step="business" hint="Quy mô hộ kinh doanh theo Mẫu số 01." scrollRef={place.scroll} footer={<StepFooter next={{ label: 'Tiếp tục', onPress: submit }} />}>
      <FieldGroup title="Ngành nghề và quy mô" onLayout={place.at('business')}>
        <TextField label="Ngành, nghề kinh doanh" value={draft.businessLine} onChangeText={(v) => set('businessLine', v)} error={errors.businessLine} placeholder="Ví dụ: Bán bánh mì, nước giải khát" />
        <TextField label="Mã ngành" optional value={draft.businessLineCode} onChangeText={(v) => set('businessLineCode', v)} keyboardType="number-pad" placeholder="5610" />
        <TextField
          label="Vốn kinh doanh"
          value={draft.capitalAmount}
          onChangeText={(v) => set('capitalAmount', v.replace(/[^\d]/g, ''))}
          error={errors.capitalAmount}
          keyboardType="number-pad"
          trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>}
          hint={capital != null ? undefined : 'Số tiền, không dấu chấm'}
        />
        {capital != null && !errors.capitalAmount ? (
          // The capital read back as the figure it is, in sign lettering
          <View accessible accessibilityLabel={`Vốn kinh doanh ${formatVnd(capital)}`} style={{ marginTop: -8, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={[sign.title, tabular, { flexShrink: 1, color: colors.primary }]}>
              {formatVnd(capital)}
            </Text>
            <Text style={[text.footnote, { color: colors.muted }]}>vốn</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Số lao động" value={draft.laborCount} onChangeText={(v) => set('laborCount', v.replace(/[^\d]/g, ''))} error={errors.laborCount} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1.3 }}>
            <DateField label="Dự kiến bắt đầu" value={draft.plannedStartDate} onChange={(v) => set('plannedStartDate', v)} error={errors.plannedStartDate} />
          </View>
        </View>
      </FieldGroup>

      <View style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.ink }}>
            Thành viên hộ góp vốn
          </Text>
          <Text style={[text.footnote, { color: colors.muted }]}>Không bắt buộc.</Text>
        </View>
        {draft.householdMembers.length > 0 ? (
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden', boxShadow: shadow.card }}>
            {draft.householdMembers.map((m, i) => {
              const open = openIdx === i;
              return (
                <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                  <ListRow
                    title={m.fullName.trim() || `Thành viên ${i + 1}`}
                    subtitle={[m.relationshipToOwner, m.capitalContribution ? formatVnd(parseVndAmount(m.capitalContribution) ?? 0) : null].filter(Boolean).join(', ') || 'Chưa điền'}
                    icon={{ sf: 'person.fill', md: 'person' }}
                    onPress={() => setOpenIdx(open ? null : i)}
                    chevron={false}
                    accessory={<Icon sf={open ? 'chevron.up' : 'chevron.down'} md={open ? 'expand_less' : 'expand_more'} size={14} color={colors.muted} />}
                  />
                  {open ? (
                    <View style={{ gap: 14, paddingHorizontal: 16, paddingBottom: 16 }}>
                      <TextField label="Họ tên" value={m.fullName} onChangeText={(v) => draft.updateHouseholdMember(i, { fullName: v })} autoCapitalize="words" />
                      <TextField label="Quan hệ với chủ hộ" optional value={m.relationshipToOwner} onChangeText={(v) => draft.updateHouseholdMember(i, { relationshipToOwner: v })} placeholder="Ví dụ: Vợ, Con" />
                      <DateField label="Ngày sinh" optional value={m.dateOfBirth} onChange={(v) => draft.updateHouseholdMember(i, { dateOfBirth: v })} maximumDate={new Date()} />
                      <TextField label="Số CCCD" optional value={m.idNumber} onChangeText={(v) => draft.updateHouseholdMember(i, { idNumber: v.replace(/[^\d]/g, '') })} keyboardType="number-pad" maxLength={12} />
                      <TextField label="Vốn góp" optional value={m.capitalContribution} onChangeText={(v) => draft.updateHouseholdMember(i, { capitalContribution: v.replace(/[^\d]/g, '') })} keyboardType="number-pad" trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>} />
                      <Pressable
                        onPress={() => {
                          draft.removeHouseholdMember(i);
                          setOpenIdx(null);
                        }}
                        accessibilityRole="button"
                        style={{ alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <Icon sf="trash" md="delete" size={16} color={colors.danger} />
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.danger }}>Bỏ thành viên này</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        <Button
          label="Thêm thành viên"
          variant="secondary"
          icon={{ sf: 'person.badge.plus', md: 'person_add' }}
          onPress={() => {
            draft.addHouseholdMember();
            setOpenIdx(draft.householdMembers.length);
          }}
        />
      </View>

      <FieldGroup title="Cam kết an toàn thực phẩm" onLayout={place.at('commit')}>
        <Checkbox checked={draft.foodSafetyCommitment} onChange={(v) => set('foodSafetyCommitment', v)} error={errors.foodSafetyCommitment}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.ink }}>
            Tôi cam kết bảo đảm điều kiện an toàn thực phẩm khi kinh doanh đồ ăn, thức uống, theo quy định cho hộ kinh doanh nhỏ lẻ.
          </Text>
        </Checkbox>
      </FieldGroup>
    </WizardStep>
  );
}

/* ------------------------------------------------------------------ 5 · documents + review + submit */

/** V07 (REG-01/02/04, step 5/5): the remaining documents, a last look at everything, then submit. */
export function RegistrationDocumentsStep() {
  const draft = useNewRegistrationStore();
  const queryClient = useQueryClient();
  const close = useCloseFlow();
  const { wards } = useWards();
  const docs = useDocPicker(false);
  const [sending, setSending] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ id: number; edited: boolean; ward: string } | null>(null);
  const required = requiredEvidence(draft.vendorType);
  const missing = required.filter((t) => !draft.evidence.some((e) => e.evidenceType === t));
  const editing = draft.registrationId != null;
  const optional = ([EVIDENCE_TYPE.addressProof, EVIDENCE_TYPE.other] as ApiEvidenceType[]).filter((t) => !required.includes(t));
  const ward = wards.find((w) => w.unitId === draft.wardUnitId);

  usePreventRemove(sending, () => showToast('Đang gửi hồ sơ, chờ một chút.', 'info'));

  if (done) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ResultView
          title={done.edited ? 'Đã gửi lại hồ sơ' : 'Đã nộp hồ sơ'}
          body={`${done.ward} sẽ xét và báo kết quả cho bạn qua thông báo.`}
          primary={{
            label: 'Xem hồ sơ',
            onPress: () => {
              close();
              router.push(`/vendor/home/registrations/${done.id}` as Href);
            },
          }}
          secondary={{ label: 'Về trang chủ', onPress: close }}
        />
      </>
    );
  }

  const submit = async () => {
    setTried(true);
    if (!editing && missing.length) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(`Còn thiếu ${missing.map((t) => EVIDENCE_LABELS[t].toLowerCase()).join(' và ')}.`);
      return;
    }
    setError(undefined);
    setSending(true);
    try {
      const reg = await submitRegistrationDraft();
      // Began as a voice interview? Keep the officer's [AI] label (no-op otherwise).
      await afterWizardFiled(reg);
      void queryClient.invalidateQueries({ queryKey: REGISTRATIONS_KEY });
      const result = { id: reg.registrationId, edited: editing, ward: ward?.unitName ?? 'Phường' };
      draft.reset();
      setDone(result);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Only once the application exists can a retry duplicate it; say that the retry is safe.
      const created = useNewRegistrationStore.getState().createdRegistrationId != null;
      setError(`${err instanceof ApiError || err instanceof Error ? errorMessage(err) : 'Không nộp được hồ sơ.'}${created ? ' Hồ sơ đã được tạo: bấm nộp lần nữa để gửi nốt giấy tờ, không bị tạo hai lần.' : ''}`);
    } finally {
      setSending(false);
    }
  };

  const ownerMissing = [draft.ownerDateOfBirth, draft.ownerGender, draft.ownerNationality.trim(), draft.idType, draft.idIssuedDate, draft.idIssuedPlace.trim(), draft.permanentAddress.trim()].filter((v) => !v).length;
  const capital = parseVndAmount(draft.capitalAmount);
  const members = draft.householdMembers.filter((m) => m.fullName.trim()).length;
  const review: { title: string; value: string; step: StepKey; warn?: boolean }[] = [
    { title: 'Loại hình', value: draft.vendorType === VENDOR_TYPE.fixedStorefront ? 'Cửa hàng cố định' : 'Lưu động', step: 'type' },
    { title: 'Tên hộ', value: draft.displayName.trim() || 'Chưa điền', step: 'details', warn: !draft.displayName.trim() },
    { title: 'Phường/xã', value: ward?.unitName ?? 'Chưa chọn', step: 'details', warn: !ward },
    { title: 'Chủ hộ', value: ownerMissing ? `Thiếu ${ownerMissing} mục` : 'Đủ 7/7 mục', step: 'owner', warn: ownerMissing > 0 },
    { title: 'Ngành nghề', value: draft.businessLine.trim() || 'Chưa điền', step: 'business', warn: !draft.businessLine.trim() },
    { title: 'Vốn', value: capital != null ? formatVnd(capital) : 'Chưa điền', step: 'business', warn: capital == null },
    { title: 'Thành viên hộ', value: members ? `${members} người` : 'Không có', step: 'business' },
    { title: 'Cam kết ATTP', value: draft.foodSafetyCommitment ? 'Đã cam kết' : 'Chưa cam kết', step: 'business', warn: !draft.foodSafetyCommitment },
  ];

  return (
    <WizardStep
      step="documents"
      hint={editing ? 'Giấy tờ đã nộp vẫn được giữ. Chỉ thêm nếu phường yêu cầu.' : 'Ảnh rõ, đủ bốn góc. JPG, PNG, WEBP hoặc PDF, tối đa 5 MB.'}
      footer={
        <StepFooter
          extra={
            error ? (
              <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: radius.control, backgroundColor: colors.dangerTint }}>
                <Icon sf="exclamationmark.circle.fill" md="error" size={16} color={colors.danger} style={{ marginTop: 1 }} />
                <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{error}</Text>
              </View>
            ) : undefined
          }
          next={{ label: sending ? 'Đang gửi hồ sơ…' : editing ? 'Cập nhật và gửi lại' : 'Nộp hồ sơ', onPress: () => void submit(), loading: sending, disabled: sending }}
        />
      }
    >
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.ink }}>
          Giấy tờ
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[...required, ...optional].map((t) => (
            <DocTile key={t} label={EVIDENCE_LABELS[t]} type={t} required={required.includes(t)} missing={tried && !editing && missing.includes(t as never)} onPick={() => void docs.choose(t)} />
          ))}
        </View>
        {docs.error ? <Text style={[text.footnote, { color: colors.onDanger }]}>{docs.error}</Text> : null}
      </View>

      {/* The application as the slip that goes to the ward: the sign's name on top, every answer under the tear line */}
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.ink }}>
          Xem lại trước khi nộp
        </Text>
        <Pass
          head={
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Tờ khai gửi {ward?.unitName ?? 'phường'}</Text>
              <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={[sign.title, { color: draft.displayName.trim() ? colors.ink : colors.line }]}>
                {(draft.displayName.trim() || 'Chưa có tên').toLocaleUpperCase('vi-VN')}
              </Text>
            </View>
          }
          stub={
            <View style={{ marginHorizontal: -20, marginBottom: -18 }}>
              {review.map((r, i) => (
                <Pressable
                  key={r.title}
                  onPress={() => returnToStep(r.step)}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.title}: ${r.value}${r.warn ? ', cần xem lại' : ''}. Sửa`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: pressed ? colors.pressed : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator })}
                >
                  <Text style={[text.subhead, { width: '36%', fontFamily: fonts.regular, color: colors.muted }]}>{r.title}</Text>
                  <Text style={[text.subhead, tabular, { flex: 1, textAlign: 'right', color: r.warn ? colors.onMango : colors.ink }]}>{r.value}</Text>
                  {r.warn ? <Icon sf="exclamationmark.circle.fill" md="error" size={16} color={colors.mango} /> : null}
                  <Icon sf="chevron.right" md="chevron_right" size={12} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          }
        />
        <Text style={[text.footnote, { color: colors.muted }]}>Mục còn thiếu vẫn nộp được; phường có thể yêu cầu bổ sung.</Text>
      </View>
      {docs.sheet}
    </WizardStep>
  );
}
