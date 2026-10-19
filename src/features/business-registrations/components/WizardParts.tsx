import { Image } from 'expo-image';
import { router, Stack, useNavigation, type Href } from 'expo-router';
import { useState, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ScrollView } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StepProgress } from '@/components/native/StepFlow';
import { errorMessage, vendorRegistrationApi, type ApiEvidenceType } from '@/core/api';
import type { PickedFile } from '@/core/api/upload';
import { colors, fonts, radius, text } from '@/theme';
import { EVIDENCE_LABELS, evidenceFileProblem, useNewRegistrationStore } from '../new-registration-store';

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
 * One step of the flow: the native header ("Đăng ký kinh doanh", Đóng), where the person is
 * (Bước n/5 and the step's question), an editing note when updating a filed registration, the
 * step's groups, and the forward action pinned in thumb reach.
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
      <Text style={{ fontFamily: fonts.medium, fontSize: 17, color: colors.primary }}>Đóng</Text>
    </Pressable>
  );
  return (
    <Screen gap={22} footer={footer} scrollRef={scrollRef}>
      <Stack.Screen options={{ title: editing ? 'Cập nhật hồ sơ' : 'Đăng ký kinh doanh', headerLeft: first ? closeButton : undefined, headerRight: first ? undefined : closeButton }} />
      <StepProgress step={ORDER.indexOf(step) + 1} total={ORDER.length} title={STEP_NAMES[step]} hint={hint} />
      {editing ? <StatusHeader tone="neutral" icon={{ sf: 'pencil', md: 'edit' }} title={`Đang cập nhật hồ sơ ${name}`} detail="Gửi lại sẽ chuyển phường xét lần nữa." /> : null}
      {children}
    </Screen>
  );
}

/** A titled group of fields on the grey ground (the form's sections, Settings style). */
export function FieldGroup({ title, note, children, onLayout }: { title?: string; note?: string; children: ReactNode; onLayout?: (y: number) => void }) {
  return (
    <View style={{ gap: 12 }} onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}>
      {title ? (
        <View style={{ gap: 2, marginHorizontal: 4 }}>
          <Text accessibilityRole="header" style={[text.headline, { color: colors.ink }]}>
            {title}
          </Text>
          {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
        </View>
      ) : null}
      <View style={{ gap: 16, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>{children}</View>
    </View>
  );
}

/** Label + red message under a non-text control (segments, a picker row). */
export function ControlLabel({ label, tag, error, children }: { label: string; tag?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{label}</Text>
        {tag}
      </View>
      {children}
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon sf="exclamationmark.circle.fill" md="error" size={14} color={colors.danger} />
          <Text style={[text.footnote, { color: colors.onDanger }]}>{error}</Text>
        </View>
      ) : null}
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
        height: thumb ? 72 : 112,
        borderRadius: thumb ? 14 : radius.photo,
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
        <Icon sf="doc.richtext.fill" md="picture_as_pdf" size={28} color={colors.danger} />
      ) : (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Icon sf="camera.fill" md="photo_camera" size={thumb ? 20 : 24} color={missing ? colors.danger : colors.primary} />
          {thumb ? null : <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: missing ? colors.onDanger : colors.primary }}>Chụp hoặc chọn</Text>}
        </View>
      )}
      {shown ? (
        <View style={{ position: 'absolute', right: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: shown === 'error' ? colors.dangerTint : shown === 'done' ? colors.leafTint : colors.white }}>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 }}>
        <Text style={[text.footnote, { flex: 1, color: missing ? colors.onDanger : colors.ink, fontFamily: fonts.semibold }]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
        {item ? (
          <Pressable onPress={() => remove(type)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Bỏ ${label}`}>
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
