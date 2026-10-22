import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { showToast } from '@/components/feedback/Toast';
import { AiTag, aiPanel } from '@/components/status/AiTag';
import { ApiError, errorMessage, EVIDENCE_TYPE, vendorKycApi, type KycFaceMatchResult, type KycIdCardExtraction } from '@/core/api';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { useNewRegistrationStore } from '../new-registration-store';
import { DocTile, useDocPicker } from './WizardParts';

/** Draft fields a CCCD reading fills (Mẫu số 01), each tagged [AI] until the person edits it. */
export type AiKey = 'ownerDateOfBirth' | 'ownerGender' | 'ownerNationality' | 'ownerEthnicity' | 'permanentAddress' | 'idIssuedDate' | 'idIssuedPlace';
export const AI_FIELDS: AiKey[] = ['ownerDateOfBirth', 'ownerGender', 'ownerNationality', 'ownerEthnicity', 'permanentAddress', 'idIssuedDate', 'idIssuedPlace'];

function kycErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    const wait = err.retryAfterSeconds ? ` Thử lại sau ${err.retryAfterSeconds} giây.` : ' Thử lại sau ít phút.';
    return `Dịch vụ eKYC đang bận hoặc hết lượt quét.${wait} Bạn vẫn nhập tay được, cán bộ phường sẽ đối chiếu giấy tờ.`;
  }
  return errorMessage(err);
}

/**
 * The [AI] CCCD panel of the owner step, shared with the voice registration: consent, both sides
 * of the card (uploaded at once, eKYC takes a stored URL), "Đọc thông tin từ CCCD" and the optional
 * portrait face match. The reading only fills the draft as suggestions; nothing is decided here.
 */
export function IdCardCapture({
  onFilled,
  filledCount,
}: {
  /** The fields the reading just wrote into the draft, and the reading itself. */
  onFilled?: (keys: AiKey[], result: KycIdCardExtraction) => void;
  /** How many [AI] fields the owner form still shows (it drops as the person edits them). */
  filledCount?: number;
}) {
  const draft = useNewRegistrationStore();
  const docs = useDocPicker(true);
  const [scanning, setScanning] = useState(false);
  const [matching, setMatching] = useState(false);
  const [extraction, setExtraction] = useState<KycIdCardExtraction | null>(null);
  const [lastFilled, setLastFilled] = useState(0);
  const [face, setFace] = useState<KycFaceMatchResult | null>(null);
  const [consentShake, setConsentShake] = useState(false);
  const front = draft.evidence.find((e) => e.evidenceType === EVIDENCE_TYPE.identityDocument);
  const back = draft.evidence.find((e) => e.evidenceType === EVIDENCE_TYPE.identityDocumentBack);
  const selfie = draft.evidence.find((e) => e.evidenceType === EVIDENCE_TYPE.portraitSelfie);

  const needConsent = (what: string) => {
    docs.setError(`Đánh dấu đồng ý ở trên trước khi ${what}.`);
    setConsentShake(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const scan = async () => {
    if (!draft.biometricConsent) return needConsent('đọc CCCD');
    if (!front?.uploadedUrl) return docs.setError('Chụp hoặc chọn ảnh mặt trước CCCD.');
    setScanning(true);
    docs.setError(undefined);
    try {
      const r = await vendorKycApi.extractIdCard({ frontFileUrl: front.uploadedUrl, backFileUrl: back?.uploadedUrl ?? null, biometricConsent: true });
      setExtraction(r);
      const values: Partial<Record<AiKey, string | null>> = {
        ownerDateOfBirth: r.dateOfBirth,
        ownerGender: r.gender,
        ownerNationality: r.nationality,
        ownerEthnicity: r.ethnicity,
        permanentAddress: r.permanentAddress,
        idIssuedDate: r.idIssuedDate,
        idIssuedPlace: r.idIssuedPlace,
      };
      const filled = AI_FIELDS.filter((k) => values[k]);
      filled.forEach((k) => draft.setField(k as never, values[k] as never));
      setLastFilled(filled.length);
      onFilled?.(filled, r);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!r.isAiGenerated) showToast(r.summary);
    } catch (err) {
      docs.setError(kycErrorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  const matchFace = async () => {
    if (!draft.biometricConsent) return needConsent('đối chiếu khuôn mặt');
    if (!selfie?.uploadedUrl || !front?.uploadedUrl) return docs.setError('Cần ảnh chân dung và ảnh mặt trước CCCD để đối chiếu.');
    setMatching(true);
    docs.setError(undefined);
    try {
      setFace(await vendorKycApi.matchFace({ selfieFileUrl: selfie.uploadedUrl, idCardFrontFileUrl: front.uploadedUrl, biometricConsent: true }));
    } catch (err) {
      docs.setError(kycErrorMessage(err));
    } finally {
      setMatching(false);
    }
  };

  return (
    <>
      <View style={{ ...aiPanel, gap: 16, padding: 18, borderRadius: radius.card }}>
        <View style={{ gap: 6 }}>
          <AiTag label="Không bắt buộc" />
          <Text style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>Quét CCCD để điền nhanh</Text>
          <Text style={[text.footnote, { color: colors.onMango }]}>Chỉ là gợi ý: bạn kiểm tra lại từng ô. Cán bộ phường vẫn đối chiếu CCCD gốc.</Text>
        </View>
        <View style={consentShake && !draft.biometricConsent ? { padding: 8, margin: -8, borderRadius: radius.control, backgroundColor: colors.dangerTint } : undefined}>
          <Checkbox
            checked={draft.biometricConsent}
            onChange={(v) => {
              draft.setField('biometricConsent', v);
              if (v) {
                setConsentShake(false);
                docs.setError(undefined);
              }
            }}
          >
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink }}>
              Tôi đồng ý cho StreetBiz dùng ảnh CCCD và ảnh chân dung để đọc thông tin và đối chiếu khuôn mặt (dữ liệu sinh trắc học).{' '}
              <Text onPress={() => router.push(`${LEGAL_ROUTES.basis}?section=du-lieu` as Href)} accessibilityRole="link" style={{ fontFamily: fonts.semibold, color: colors.primary, textDecorationLine: 'underline' }}>
                Căn cứ
              </Text>
            </Text>
          </Checkbox>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <DocTile label="CCCD mặt trước" type={EVIDENCE_TYPE.identityDocument} required onPick={() => void docs.choose(EVIDENCE_TYPE.identityDocument, false)} state={docs.state[EVIDENCE_TYPE.identityDocument]} />
          <DocTile label="CCCD mặt sau" type={EVIDENCE_TYPE.identityDocumentBack} required onPick={() => void docs.choose(EVIDENCE_TYPE.identityDocumentBack, false)} state={docs.state[EVIDENCE_TYPE.identityDocumentBack]} />
        </View>
        {extraction ? (
          <View style={{ gap: 4 }}>
            {extraction.fullName ? <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{extraction.fullName}</Text> : null}
            <Text style={[text.subhead, { color: colors.ink }, tabular]}>
              Đã điền {filledCount ?? lastFilled} ô, tin cậy {extraction.confidencePercent}%
            </Text>
            {extraction.needsManualVerification ? <Text style={[text.footnote, { color: colors.onMango }]}>Ảnh chưa đủ rõ, kiểm tra kỹ các ô có nhãn [AI].</Text> : null}
            {extraction.warnings.map((w) => (
              <Text key={w} style={[text.footnote, { color: colors.onMango }]}>
                • {w}
              </Text>
            ))}
          </View>
        ) : null}
        <Button
          label={scanning ? 'Đang đọc CCCD…' : extraction ? 'Đọc lại CCCD' : 'Đọc thông tin từ CCCD'}
          variant="secondary"
          icon={{ sf: 'text.viewfinder', md: 'document_scanner' }}
          loading={scanning}
          disabled={scanning || !front?.uploadedUrl}
          onPress={() => void scan()}
          accessibilityHint={front?.uploadedUrl ? undefined : 'Cần ảnh mặt trước CCCD đã tải xong'}
        />
        <View style={{ height: 1, backgroundColor: 'rgba(107,65,0,0.15)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <DocTile size="thumb" label="Ảnh chân dung" type={EVIDENCE_TYPE.portraitSelfie} onPick={() => void docs.choose(EVIDENCE_TYPE.portraitSelfie, false)} state={docs.state[EVIDENCE_TYPE.portraitSelfie]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.subhead, { color: colors.ink }]}>Ảnh chân dung</Text>
            <Text style={[text.footnote, tabular, { color: face ? (face.isMatch ? colors.onLeaf : colors.onDanger) : colors.muted, fontFamily: face ? fonts.bold : fonts.regular }]}>
              {face ? `${face.isMatch ? 'Khớp' : 'Chưa khớp'}, giống ${face.similarityPercent}%` : selfie ? 'Bấm Đối chiếu để so với CCCD' : 'Không bắt buộc, để đối chiếu khuôn mặt'}
            </Text>
          </View>
          {selfie ? (
            <Pressable
              onPress={() => void matchFace()}
              disabled={matching || !selfie.uploadedUrl}
              accessibilityRole="button"
              accessibilityLabel="Đối chiếu khuôn mặt với CCCD"
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.sticker : colors.white, borderWidth: 1.5, borderColor: colors.sticker, opacity: !selfie.uploadedUrl ? 0.45 : 1 })}
            >
              {matching ? <ActivityIndicator size="small" color={colors.cta} /> : <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: colors.onMango }}>Đối chiếu</Text>}
            </Pressable>
          ) : null}
        </View>
        {face ? <Text style={[text.footnote, { color: colors.onMango }]}>{face.summary}</Text> : null}
        {docs.error ? (
          <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.control, backgroundColor: colors.dangerTint }}>
            <Icon sf="exclamationmark.circle.fill" md="error" size={16} color={colors.danger} />
            <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{docs.error}</Text>
          </View>
        ) : null}
      </View>
      {docs.sheet}
    </>
  );
}
