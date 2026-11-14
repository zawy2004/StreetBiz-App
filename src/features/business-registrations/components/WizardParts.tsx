import { Image } from 'expo-image';
import { router, Stack, useNavigation, type Href } from 'expo-router';
import { useState, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ScrollView } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StepProgress } from '@/components/native/StepFlow';
import { errorMessage, vendorRegistrationApi, type ApiEvidenceType } from '@/core/api';
import type { PickedFile } from '@/core/api/upload';
import { colors, fonts, radius, shadow, sign, text } from '@/theme';
import { EVIDENCE_LABELS, evidenceFileProblem, useNewRegistrationStore } from '../new-registration-store';
import { VoiceReturnBanner } from '../voice/VoiceEntry';

/** The registration flow is a modal stack above the vendor's tabs (`src/app/register-business`). */
export const FLOW = '/register-business';
export const STEP_HREF = {
  type: FLOW,
  details: `${FLOW}/details`,
  owner: `${FLOW}/owner`,
  business: `${FLOW}/business`,
  documents: `${FLOW}/documents`,
} as const;
export type StepKey = keyof typeof STEP_HREF;
const STEP_NAMES: Record<StepKey, string> = {
  type: 'Bạn bán theo cách nào?',
  details: 'Hộ kinh doanh của bạn',
  owner: 'Chủ hộ và CCCD',
  business: 'Ngành nghề và cam kết',
  documents: 'Giấy tờ và nộp hồ sơ',
};
const ORDER: StepKey[] = ['type', 'details', 'owner', 'business', 'documents'];

export const goStep = (s: StepKey) => router.push(STEP_HREF[s] as Href);
/** Back to an earlier step already in the flow's stack (the review's "Sửa"), without stacking a copy. */
export const returnToStep = (s: StepKey) => router.dismissTo(STEP_HREF[s] as Href);

/** Closes the whole flow (the modal); the draft stays in memory so it can be resumed. */
export function useCloseFlow() {
  const navigation = useNavigation();
  return () => navigation.getParent()?.goBack();
}

/**
 * One step of the flow (v5): the native header ("Đăng ký kinh doanh", Đóng), where the person is
 * (Bước n/5, the step's question), an editing note when updating a filed registration, the
 * step's groups, and the forward action pinned in thumb reach (`StepFooter`).
 */
export function WizardStep({
  step,
  hint,
  footer,
  scrollRef,
  children,
}: {
  step: StepKey;
  hint?: string;
  footer: ReactNode;
  scrollRef?: Ref<ScrollView>;
  children: ReactNode;
}) {
  const close = useCloseFlow();
  const editing = useNewRegistrationStore((s) => s.registrationId != null);
  const name = useNewRegistrationStore((s) => s.displayName);
  const first = step === 'type';
  const closeButton = () => (
    <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Đóng, giữ bản nháp" hitSlop={10} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: first ? 0 : 12, paddingRight: first ? 16 : 0 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.primary }}>Đóng</Text>
    </Pressable>
  );
  return (
    <Screen gap={24} footer={footer} scrollRef={scrollRef} contentStyle={{ paddingHorizontal: 20 }}>
      <Stack.Screen options={{ title: editing ? 'Cập nhật hồ sơ' : 'Đăng ký kinh doanh', headerLeft: first ? closeButton : undefined, headerRight: first ? undefined : closeButton }} />
      <StepProgress step={ORDER.indexOf(step) + 1} total={ORDER.length} title={STEP_NAMES[step]} hint={hint} />
      {editing ? <StatusHeader tone="neutral" icon={{ sf: 'pencil', md: 'edit' }} title={`Đang cập nhật hồ sơ ${name}`} detail="Gửi lại sẽ chuyển phường xét lần nữa." /> : null}
      <VoiceReturnBanner />
      {children}
    </Screen>
  );
}

/** A titled group of fields: a heavy title over one white card (radius 22, resting shadow). */
export function FieldGroup({ title, note, children, onLayout }: { title?: string; note?: string; children: ReactNode; onLayout?: (y: number) => void }) {
  return (
    <View style={{ gap: 12 }} onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}>
      {title ? (
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.ink }}>
            {title}
          </Text>
          {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
        </View>
      ) : null}
      <View style={{ gap: 18, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>{children}</View>
    </View>
  );
}

/** Label + red message under a non-text control (segments, a picker row), in the TextField's voice. */
export function ControlLabel({ label, tag, error, children }: { label: string; tag?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>{label}</Text>
        {tag}
      </View>
      {children}
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Icon sf="exclamationmark.circle.fill" md="error" size={14} color={colors.danger} style={{ marginTop: 2 }} />
          <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A choice that opens a sheet (the managing ward), drawn exactly like the v5 `TextField`: a
 * filled 56 pt box, red wash when wrong, a spinner while its options load.
 */
export function PickerField({
  value,
  placeholder,
  icon,
  loading,
  error,
  onPress,
  accessibilityLabel,
}: {
  value?: string;
  placeholder: string;
  icon: { sf: string; md: string };
  loading?: boolean;
  error?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: error ? colors.danger : 'transparent',
        backgroundColor: error ? colors.dangerTint : pressed ? colors.brandTint : colors.sunken,
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={18} color={error ? colors.danger : value ? colors.primary : colors.muted} />
      <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: value ? colors.ink : colors.muted }}>{value ?? placeholder}</Text>
      {loading ? <ActivityIndicator size="small" color={colors.cta} /> : <Icon sf="chevron.down" md="expand_more" size={14} color={colors.muted} />}
    </Pressable>
  );
}

/**
 * The household's own shop sign, painted live as the name is typed: street-orange board, the
 * name in white sign lettering, the painted kerb under it. Blank, it waits in pale paper.
 */
export function SignPreview({ name }: { name: string }) {
  const named = name.trim();
  return (
    <View
      accessible
      accessibilityLabel={`Biển hiệu: ${named || 'chưa có tên'}`}
      style={{ borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: named ? colors.brand : colors.kerbPaint, borderWidth: named ? 0 : 1.5, borderStyle: 'dashed', borderColor: colors.brandTint, boxShadow: named ? shadow.glow : undefined }}
    >
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: named ? colors.white : colors.muted }}>Biển hiệu của bạn</Text>
        <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={[sign.title, { color: named ? colors.white : colors.line }]}>
          {named ? named.toLocaleUpperCase('vi-VN') : 'TÊN HỘ KINH DOANH'}
        </Text>
      </View>
      <KerbStrip height={8} segment={22} />
    </View>
  );
}

export type UploadState = 'uploading' | 'done' | 'error';

/** One document: the photo (or PDF mark) with its upload state; tap to choose or retake. */
export function DocTile({
  label,
  type,
  required,
  missing,
  onPick,
  state,
  size = 'half',
}: {
  label: string;
  type: ApiEvidenceType;
  required?: boolean;
  /** Required and still empty after the person tried to go on. */
  missing?: boolean;
  onPick: () => void;
  state?: UploadState;
  size?: 'half' | 'thumb';
}) {
  const item = useNewRegistrationStore((s) => s.evidence.find((e) => e.evidenceType === type));
  const remove = useNewRegistrationStore((s) => s.removeEvidence);
  const isPdf = item?.file?.type === 'application/pdf' || item?.uri.toLowerCase().endsWith('.pdf');
  const thumb = size === 'thumb';
  // A photo uploaded on an earlier step shows as saved here too.
  const shown: UploadState | undefined = state ?? (item?.uploadedUrl ? 'done' : undefined);
  const box = (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={item ? `${label}: đã chọn. Bấm để chọn lại` : `Chọn ${label}${required ? ', bắt buộc' : ''}`}
      style={({ pressed }) => ({
        width: thumb ? 72 : '100%',
        height: thumb ? 72 : undefined,
        aspectRatio: thumb ? undefined : 1.58,
        borderRadius: thumb ? radius.control : radius.photo,
        borderCurve: 'continuous',
        overflow: 'hidden',
        borderWidth: item ? 0 : 1.5,
        borderStyle: 'dashed',
        borderColor: missing ? colors.danger : required ? colors.cta : colors.line,
        backgroundColor: item ? colors.sunken : missing ? colors.dangerTint : pressed ? colors.brandTint : colors.kerbPaint,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {item && !isPdf ? (
        <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : item && isPdf ? (
        <Icon sf="doc.richtext.fill" md="picture_as_pdf" size={30} color={colors.danger} />
      ) : (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ width: thumb ? 36 : 44, height: thumb ? 36 : 44, borderRadius: radius.full, backgroundColor: missing ? colors.white : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="camera.fill" md="photo_camera" size={thumb ? 17 : 20} color={missing ? colors.danger : colors.primary} />
          </View>
          {thumb ? null : <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: missing ? colors.onDanger : colors.primary }}>Chụp hoặc chọn</Text>}
        </View>
      )}
      {shown ? (
        <View style={{ position: 'absolute', right: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, backgroundColor: shown === 'error' ? colors.dangerTint : shown === 'done' ? colors.leafTint : colors.white }}>
          {shown === 'uploading' ? (
            <ActivityIndicator size="small" color={colors.cta} />
          ) : (
            <Icon sf={shown === 'done' ? 'checkmark' : 'exclamationmark'} md={shown === 'done' ? 'check' : 'priority_high'} size={11} color={shown === 'done' ? colors.leaf : colors.danger} weight="bold" />
          )}
          {thumb ? null : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: shown === 'error' ? colors.onDanger : shown === 'done' ? colors.onLeaf : colors.ink }}>
              {shown === 'uploading' ? 'Đang tải' : shown === 'done' ? 'Đã lưu' : 'Lỗi'}
            </Text>
          )}
        </View>
      ) : null}
    </Pressable>
  );
  if (thumb) return box;
  return (
    <View style={{ flexBasis: '46%', flexGrow: 1, gap: 6 }}>
      {box}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 }}>
        <Text style={[text.footnote, { flex: 1, color: missing ? colors.onDanger : colors.ink, fontFamily: fonts.bold }]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
        {item ? (
          <Pressable onPress={() => remove(type)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Bỏ ${label}`} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="trash" md="delete" size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Picks, checks and (optionally) uploads a document straight away (eKYC needs a stored URL). */
export function useDocPicker(uploadNow: boolean) {
  const addEvidence = useNewRegistrationStore((s) => s.addEvidence);
  const patchEvidence = useNewRegistrationStore((s) => s.patchEvidence);
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
    addEvidence({ evidenceType: type, uri: file.uri, file, label: EVIDENCE_LABELS[type] });
    if (!uploadNow) return;
    setState((s) => ({ ...s, [type]: 'uploading' }));
    try {
      const uploaded = await vendorRegistrationApi.uploadEvidenceFile(file);
      patchEvidence(type, { uploadedUrl: uploaded.fileUrl });
      setState((s) => ({ ...s, [type]: 'done' }));
    } catch (err) {
      setError(errorMessage(err));
      setState((s) => ({ ...s, [type]: 'error' }));
    }
  };
  return { choose, state, error, setError, sheet };
}
