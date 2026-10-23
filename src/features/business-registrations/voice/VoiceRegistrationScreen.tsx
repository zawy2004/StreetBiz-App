import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type ScrollView } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { ResultView } from '@/components/native/ResultView';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StepFooter, StepProgress } from '@/components/native/StepFlow';
import { AiTag } from '@/components/status/AiTag';
import { ApiError, errorMessage, EVIDENCE_TYPE, VENDOR_TYPE, type ApiEvidenceType } from '@/core/api';
import { useWards } from '@/core/auth/useWards';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { colors, fonts, radius, shadow, text } from '@/theme';
import { IdCardCapture } from '../components/IdCardCapture';
import { DocTile, goStep, returnToStep, useCloseFlow, useDocPicker } from '../components/WizardParts';
import { EVIDENCE_LABELS, useNewRegistrationStore } from '../new-registration-store';
import { REGISTRATIONS_KEY, useRegistrations } from '../useRegistrations';
import { buildCardGroups, missingRows, speakableGroup, type CardGroup, type CardRow, type EditTarget } from './confirm-card-model';
import { answerChoice, baseQuestionKey, cardFieldOf, confirmPin, greeting, skipQuestion, SOURCE_LABELS, suggestDisplayName, typedAnswer, type CardField, type FieldSource } from './interview-state';
import { InterviewTurn } from './InterviewParts';
import { fallbackNotice } from './live-interview';
import { LivePanel, LiveStart } from './LiveConversation';
import { discardClip } from './useClipRecorder';
import { canTalkLive, useLiveInterview } from './useLiveInterview';
import { useReadAloud } from './useReadAloud';
import { cardValues, copyInterviewToWizard, editedFields, fileAssistedRegistration } from './voice-filing';
import { voiceRegistrationApi } from './voice-registration-api';
import type { AssistAudio, AssistDraft, AssistTurnResult } from './voice-registration.types';
import { useVoiceSessionStore, type VoicePhase } from './voice-session-store';

const STEPS: { phases: VoicePhase[]; title: string }[] = [
  { phases: ['consent'], title: 'Nói để đăng ký' },
  { phases: ['identity'], title: 'Chụp căn cước' },
  { phases: ['interview', 'photos'], title: 'Kể cho trợ lý' },
  { phases: ['card', 'done'], title: 'Xem lại và nộp' },
];

const WIZARD_STEP = { 'owner-person': 'owner', 'owner-business': 'business', details: 'details' } as const;

/**
 * X01 "Kể chuyện là xong" on the phone: consent → CCCD (the wizard's own eKYC panel) → a short
 * interview by voice → optional stall photo → one confirm card → "Đúng, nộp", which files through
 * the wizard's own submit. The assistant only proposes; the step-by-step wizard is one tap away.
 */
export function VoiceRegistrationScreen() {
  const phase = useVoiceSessionStore((s) => s.phase);
  const active = useVoiceSessionStore((s) => s.active);
  const close = useCloseFlow();
  const closeButton = () => (
    <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Đóng, giữ phần đã kể" hitSlop={10} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.primary }}>Đóng</Text>
    </Pressable>
  );

  if (phase === 'done') return <DoneStep />;
  return (
    <>
      <Stack.Screen options={{ title: 'Nói để đăng ký', headerRight: closeButton }} />
      {!active ? <ConsentStep /> : phase === 'identity' ? <IdentityStep /> : phase === 'photos' ? <PhotoStep /> : phase === 'card' ? <CardStep /> : <InterviewStep />}
    </>
  );
}

function Progress({ phase, hint }: { phase: VoicePhase; hint?: string }) {
  const index = STEPS.findIndex((s) => s.phases.includes(phase));
  return <StepProgress step={index + 1} total={STEPS.length} title={STEPS[index]?.title ?? ''} hint={hint} />;
}

/** "Bạn đang dùng trợ lý AI" (Luật 71/2025 Đ.44) + two separate consents, each optional. */
function ConsentStep() {
  const start = useVoiceSessionStore((s) => s.start);
  const { registrations, isLoading } = useRegistrations();
  const [voice, setVoice] = useState(true);
  const [biometric, setBiometric] = useState(true);
  // BR-09: the server refuses a second registration while one is SUBMITTED / UNDER_REVIEW.
  const pending = registrations.find((r) => r.registrationStatus === 'SUBMITTED' || r.registrationStatus === 'UNDER_REVIEW');
  const needsInfo = registrations.find((r) => r.registrationStatus === 'MORE_INFORMATION_REQUIRED');
  const blocking = pending ?? needsInfo;

  const begin = () => {
    // A new registration: never carry over a half-finished wizard draft (it would turn "create" into "update").
    const wizard = useNewRegistrationStore.getState();
    wizard.reset();
    wizard.setField('biometricConsent', biometric);
    void Haptics.selectionAsync();
    start(voice);
  };

  return (
    <Screen
      gap={22}
      contentStyle={{ paddingHorizontal: 20 }}
      footer={
        <StepFooter
          extra={
            <Pressable onPress={() => returnToStep('type')} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.primary }}>Tự điền từng bước</Text>
            </Pressable>
          }
          next={{ label: 'Bắt đầu', icon: { sf: 'mic.fill', md: 'mic' }, onPress: begin, disabled: isLoading || !!pending }}
        />
      }
    >
      <Progress phase="consent" />
      <View style={{ gap: 14, padding: 20, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.kerbPaint, borderWidth: 1, borderColor: colors.brandTint }}>
        <AiTag label="Bạn đang dùng trợ lý AI" />
        <Text style={{ fontFamily: fonts.heavy, fontSize: 24, lineHeight: 30, color: colors.ink }}>Chụp căn cước, kể 5–7 câu, xem lại rồi nộp.</Text>
        <Text style={[text.callout, { color: colors.ink }]}>
          Trợ lý nghe giọng bạn để điền hồ sơ đăng ký kinh doanh. Ghi âm không được lưu: chuyển thành chữ xong là xoá. Hồ sơ chỉ được nộp khi chính bạn bấm “Đúng, nộp”.
        </Text>
        {[
          { sf: 'person.text.rectangle', md: 'badge', t: 'Chụp 2 mặt căn cước' },
          { sf: 'mic.fill', md: 'mic', t: 'Trả lời vài câu hỏi' },
          { sf: 'checkmark.seal.fill', md: 'verified', t: 'Xem thẻ, bấm nộp' },
        ].map((s, i) => (
          <View key={s.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.white }}>{i + 1}</Text>
            </View>
            <Icon sf={s.sf} md={s.md} size={18} color={colors.primary} />
            <Text style={[text.headline, { color: colors.ink }]}>{s.t}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 14, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, color: colors.ink }}>
          Bạn đồng ý cho trợ lý
        </Text>
        <Checkbox checked={voice} onChange={setVoice}>
          <Text style={[text.callout, { color: colors.ink }]}>
            <Text style={{ fontFamily: fonts.bold }}>Ghi âm giọng nói</Text> để chuyển thành chữ và điền hồ sơ. Không đồng ý thì bạn gõ câu trả lời.
          </Text>
        </Checkbox>
        <Checkbox checked={biometric} onChange={setBiometric}>
          <Text style={[text.callout, { color: colors.ink }]}>
            <Text style={{ fontFamily: fonts.bold }}>Đọc ảnh căn cước và so khuôn mặt</Text> để tự điền phần chủ hộ. Không đồng ý thì bạn tự nhập phần đó.{' '}
            <Text onPress={() => router.push(`${LEGAL_ROUTES.basis}?section=du-lieu` as Href)} accessibilityRole="link" style={{ fontFamily: fonts.semibold, color: colors.primary, textDecorationLine: 'underline' }}>
              Căn cứ
            </Text>
          </Text>
        </Checkbox>
      </View>

      {blocking ? (
        <StatusHeader
          tone="pending"
          title={pending ? `Hồ sơ ${pending.displayName} đang chờ phường xét` : `Hồ sơ ${needsInfo!.displayName} cần bổ sung`}
          detail={pending ? 'Mỗi người chỉ có một hồ sơ đang chờ. Muốn sửa thì mở hồ sơ đó.' : 'Nên bổ sung hồ sơ đó thay vì làm hồ sơ mới.'}
          action={{
            label: 'Mở hồ sơ',
            onPress: () => router.push(`/vendor/home/registrations/${blocking.registrationId}` as Href),
          }}
        />
      ) : null}
    </Screen>
  );
}

/** CCCD through the wizard's own eKYC panel; the reading greets the vendor by name. */
function IdentityStep() {
  const setKyc = useVoiceSessionStore((s) => s.setKyc);
  const setPhase = useVoiceSessionStore((s) => s.setPhase);
  const kyc = useVoiceSessionStore((s) => s.kyc);
  const salutation = useVoiceSessionStore((s) => s.draft.salutation ?? 'bạn');
  const evidence = useNewRegistrationStore((s) => s.evidence);
  const has = (t: ApiEvidenceType) => evidence.some((e) => e.evidenceType === t);
  const ready = has(EVIDENCE_TYPE.identityDocument) && has(EVIDENCE_TYPE.identityDocumentBack);

  return (
    <Screen
      gap={22}
      contentStyle={{ paddingHorizontal: 20 }}
      footer={<StepFooter extra={!ready ? <Text style={[text.footnote, { textAlign: 'center', color: colors.muted }]}>Chụp đủ 2 mặt căn cước để tiếp tục. Đọc thông tin là tuỳ chọn.</Text> : undefined} next={{ label: 'Tiếp tục, bắt đầu kể', icon: { sf: 'mic.fill', md: 'mic' }, disabled: !ready, onPress: () => setPhase('interview') }} />}
    >
      <Progress phase="identity" hint="Ảnh căn cước đi kèm hồ sơ để phường đối chiếu." />
      <IdCardCapture onFilled={(_, result) => setKyc(result)} />
      {kyc?.fullName ? <Text style={{ fontFamily: fonts.heavy, fontSize: 24, lineHeight: 30, color: colors.primary }}>{greeting(salutation, kyc.fullName)}!</Text> : null}
    </Screen>
  );
}

function InterviewStep() {
  const session = useVoiceSessionStore();
  const { wards } = useWards();
  const reader = useReadAloud();
  const [busy, setBusy] = useState(false);
  const [aiDown, setAiDown] = useState(false);
  const [error, setError] = useState<string>();
  const [autoRead, setAutoRead] = useState(true);
  const [typing, setTyping] = useState(false);
  // X01 v2: talk continuously when this Expo Go can stream the microphone; tap-to-talk is the fallback.
  const [liveCapable] = useState(canTalkLive);
  const [mode, setMode] = useState<'live' | 'turn'>(() => (session.voiceConsent && liveCapable ? 'live' : 'turn'));
  const [liveNotice, setLiveNotice] = useState<string>();
  const scroll = useRef<ScrollView>(null);
  const inFlight = useRef(false);

  const wardName = useCallback((unitId: number | null | undefined) => wards.find((w) => w.unitId === unitId)?.unitName ?? null, [wards]);

  /** The planner has nothing left to ask: name the shop and move on to the photo. */
  const finishInterview = useCallback((result: AssistTurnResult) => {
    const now = useVoiceSessionStore.getState();
    if (!now.displayName) now.setDisplayName(suggestDisplayName(result.draft.businessLine, now.draft.salutation ?? 'bạn', now.kyc?.fullName));
    now.setPhase('photos');
  }, []);

  // Done while talking: let the assistant finish its last sentence before the screen moves on,
  // but never wait long for it.
  const finishing = useRef<{ result: AssistTurnResult; timer: ReturnType<typeof setTimeout> } | null>(null);
  const finishTalking = useCallback(() => {
    const pending = finishing.current;
    if (!pending) return;
    finishing.current = null;
    clearTimeout(pending.timer);
    finishInterview(pending.result);
  }, [finishInterview]);
  useEffect(() => () => clearTimeout(finishing.current?.timer), []);

  const live = useLiveInterview({
    onAssist: (result, cause) => {
      useVoiceSessionStore.getState().applyTurn(result, cause === 'voice');
      if (cause === 'voice') void Haptics.notificationAsync(result.proposals.length ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      scroll.current?.scrollTo({ y: 0, animated: true });
      if (result.done && !finishing.current) finishing.current = { result, timer: setTimeout(finishTalking, 8000) };
    },
    onTurnComplete: finishTalking,
    onStopped: (reason, message) => {
      if (finishing.current) {
        finishTalking();
        return;
      }
      // A finished interview has left this screen; anything else carries on with tap-to-talk.
      if (useVoiceSessionStore.getState().phase !== 'interview') return;
      setMode('turn');
      setLiveNotice(message ?? fallbackNotice(reason));
    },
  });
  const talking = mode === 'live' && live.active;

  const send = useCallback(
    async (draft: AssistDraft, answer?: { text?: string; audio?: AssistAudio }) => {
      // One turn at a time: a double tap must not spend two calls of the vendor's rate limit.
      if (inFlight.current) return;
      inFlight.current = true;
      const s = useVoiceSessionStore.getState();
      setBusy(true);
      setError(undefined);
      try {
        const result = await voiceRegistrationApi.turn({ questionKey: baseQuestionKey(s.question), draft, text: answer?.text, audio: answer?.audio, voiceConsent: s.voiceConsent });
        s.applyTurn(result, !!answer);
        if (answer) void Haptics.notificationAsync(result.proposals.length ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
        scroll.current?.scrollTo({ y: 0, animated: true });
        if (result.done) finishInterview(result);
      } catch (err) {
        if (err instanceof ApiError && (err.code === 'ai_unavailable' || err.status === 503)) setAiDown(true);
        else if (err instanceof ApiError && err.status === 429) setError('Bạn thao tác hơi nhanh. Chờ một chút rồi thử lại, hoặc điền tiếp bằng tay.');
        else setError(errorMessage(err));
      } finally {
        // The recording was only needed for this one request.
        discardClip(answer?.audio);
        inFlight.current = false;
        setBusy(false);
      }
    },
    [finishInterview],
  );

  // First question in tap-to-talk (and after the app dropped it). Deferred a tick so a remount
  // cancels it instead of asking twice. The live conversation gets its first question when it starts.
  useEffect(() => {
    if (mode !== 'turn' || session.question || error || aiDown) return;
    const timer = setTimeout(() => void send(useVoiceSessionStore.getState().draft), 0);
    return () => clearTimeout(timer);
  }, [mode, session.question, error, aiDown, send]);

  const toWizard = () => {
    copyInterviewToWizard();
    returnToStep('type');
  };
  const startLive = () => {
    reader.stop();
    setLiveNotice(undefined);
    void live.start(session.draft, session.voiceConsent);
  };
  const afterTap = (draft: AssistDraft, sources?: Partial<Record<CardField, FieldSource>>) => {
    session.setDraft(draft, sources);
    if (talking) live.sendDraft(draft);
    else void send(draft);
  };
  const question = session.question;

  return (
    <Screen gap={18} scrollRef={scroll} contentStyle={{ paddingHorizontal: 20 }}>
      <Progress phase="interview" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <AiTag label="Bạn đang nói chuyện với trợ lý AI" />
        {mode === 'turn' && liveCapable && session.voiceConsent ? (
          <Pressable
            onPress={() => {
              setLiveNotice(undefined);
              setMode('live');
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Icon sf="waveform" md="graphic_eq" size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Trò chuyện</Text>
          </Pressable>
        ) : null}
        {mode === 'turn' && reader.supported ? (
          <Pressable
            onPress={() => {
              reader.stop();
              setAutoRead((v) => !v);
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: autoRead }}
            accessibilityLabel="Tự đọc câu hỏi"
            hitSlop={8}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Icon sf={autoRead ? 'speaker.wave.2.fill' : 'speaker.slash.fill'} md={autoRead ? 'volume_up' : 'volume_off'} size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{autoRead ? 'Đang đọc to' : 'Đọc to: tắt'}</Text>
          </Pressable>
        ) : null}
      </View>

      {liveNotice ? (
        <View accessibilityRole="alert" style={{ padding: 14, borderRadius: radius.control, backgroundColor: colors.mangoTint }}>
          <Text style={[text.footnote, { color: colors.onMango, fontFamily: fonts.semibold }]}>{liveNotice}</Text>
        </View>
      ) : null}

      {error ? (
        <View accessibilityRole="alert" style={{ gap: 10, padding: 14, borderRadius: radius.control, backgroundColor: colors.dangerTint }}>
          <Text style={[text.footnote, { color: colors.onDanger }]}>{error}</Text>
          {!question ? <Button label="Thử lại" variant="secondary" onPress={() => void send(session.draft)} /> : null}
        </View>
      ) : null}

      {mode === 'live' && !live.active ? <LiveStart question={question?.text ?? null} onStart={startLive} onTapToTalk={() => setMode('turn')} /> : null}
      {talking ? (
        <LivePanel status={live.status} captions={live.captions} notice={live.notice} muted={live.muted} onMute={live.setMuted} onInterrupt={live.interrupt} onStop={live.end} />
      ) : null}

      {question && (mode === 'turn' || talking) ? (
        <InterviewTurn
          question={question}
          draft={session.draft}
          busy={talking ? live.pending : busy}
          transcript={session.transcript}
          warnings={session.warnings}
          location={session.location}
          slotPreview={session.slotPreview}
          wardName={wardName}
          aiDown={aiDown}
          voiceConsent={session.voiceConsent}
          typing={typing}
          onTypingChange={setTyping}
          reader={reader}
          autoRead={autoRead}
          live={talking}
          onVoice={(audio) => void send(session.draft, { audio })}
          onText={(t) => {
            if (talking) live.sendText(t);
            else void send(session.draft, { text: t });
          }}
          onChoice={(value) => {
            const field = question.input === 'CONFIRM' ? null : cardFieldOf(question.field);
            afterTap(answerChoice(session.draft, question, value), field ? { [field]: 'CHOSEN' } : undefined);
          }}
          onTyped={(t) => {
            const typed = typedAnswer(session.draft, question, t);
            if ('error' in typed) return typed.error;
            const field = cardFieldOf(question.field);
            afterTap(typed.draft, field ? { [field]: 'TYPED' } : undefined);
            return undefined;
          }}
          onPin={(pin) => afterTap(confirmPin(session.draft, pin.latitude, pin.longitude))}
          onSkip={() => afterTap(skipQuestion(session.draft, question))}
          onWizard={toWizard}
        />
      ) : mode === 'turn' && aiDown ? (
        <View style={{ gap: 12, padding: 16, borderRadius: radius.control, backgroundColor: colors.mangoTint }}>
          <Text style={[text.subhead, { color: colors.onMango }]}>Trợ lý AI đang bận. Bạn điền tiếp bằng tay nhé.</Text>
          <Button label="Điền tiếp bằng tay" onPress={toWizard} />
        </View>
      ) : mode === 'turn' ? (
        <View style={{ height: 220, borderRadius: radius.pass, backgroundColor: colors.sunken }} accessibilityLabel="Đang chuẩn bị câu hỏi" />
      ) : null}

      <Pressable onPress={toWizard} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>Điền từng bước thay vì nói</Text>
      </Pressable>
    </Screen>
  );
}

/** Optional photo of the cart or stall (OTHER); a fixed storefront also needs its licence. */
function PhotoStep() {
  const setPhase = useVoiceSessionStore((s) => s.setPhase);
  const vendorType = useVoiceSessionStore((s) => s.draft.vendorType);
  const handedOff = useVoiceSessionStore((s) => s.handedOff);
  const wizardType = useNewRegistrationStore((s) => s.vendorType);
  const docs = useDocPicker(false);
  const fixed = (handedOff ? wizardType : vendorType) === VENDOR_TYPE.fixedStorefront;

  return (
    <Screen gap={22} contentStyle={{ paddingHorizontal: 20 }} footer={<StepFooter next={{ label: 'Xem thẻ xác nhận', onPress: () => setPhase('card') }} />}>
      <Progress phase="photos" hint="Chụp xe hoặc quầy của bạn để phường dễ xét. Không bắt buộc." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <DocTile label="Ảnh xe hoặc quầy" type={EVIDENCE_TYPE.other} onPick={() => void docs.choose(EVIDENCE_TYPE.other, false)} />
        {fixed ? <DocTile label={EVIDENCE_LABELS.BUSINESS_LICENSE} type={EVIDENCE_TYPE.businessLicense} required onPick={() => void docs.choose(EVIDENCE_TYPE.businessLicense)} /> : null}
      </View>
      {docs.error ? <Text style={[text.footnote, { color: colors.onDanger }]}>{docs.error}</Text> : null}
      {docs.sheet}
    </Screen>
  );
}

function CardStep() {
  const queryClient = useQueryClient();
  const session = useVoiceSessionStore();
  const wizard = useNewRegistrationStore();
  const { wards } = useWards();
  const reader = useReadAloud();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  usePreventRemove(submitting, () => showToast('Đang gửi hồ sơ, chờ một chút.', 'info'));

  // Both stores are subscribed above, so this recomputes whenever either changes.
  const values = useMemo(() => cardValues(), [session, wizard]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(
    () => buildCardGroups({ values, session, evidence: wizard.evidence.map((e) => e.evidenceType), wardName: wards.find((w) => w.unitId === values.wardUnitId)?.unitName ?? null, edited: editedFields() }),
    [values, session, wizard.evidence, wards],
  );
  const missing = missingRows(groups);
  const foodSafety = !!values.foodSafetyCommitment;
  const blocked = missing.length > 0 || !foodSafety;

  const edit = (target: EditTarget) => {
    reader.stop();
    if (target === 'photos') return session.setPhase('photos');
    copyInterviewToWizard();
    goStep(WIZARD_STEP[target]);
  };
  const setFoodSafety = (v: boolean) => (session.handedOff ? wizard.setField('foodSafetyCommitment', v) : session.setFoodSafety(v));

  const submit = async () => {
    reader.stop();
    setSubmitting(true);
    setError(undefined);
    try {
      const nearbySlots = useVoiceSessionStore.getState().slotPreview.length;
      const { registration, labelled } = await fileAssistedRegistration();
      void queryClient.invalidateQueries({ queryKey: REGISTRATIONS_KEY });
      useNewRegistrationStore.getState().reset();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useVoiceSessionStore.getState().finish({ registrationId: registration.registrationId, displayName: registration.displayName, nearbySlots, labelled });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      gap={18}
      contentStyle={{ paddingHorizontal: 20 }}
      footer={
        <StepFooter
          extra={
            error ? (
              <Text accessibilityRole="alert" style={[text.footnote, { color: colors.onDanger }]}>
                {error}
              </Text>
            ) : blocked ? (
              <Text style={[text.footnote, { color: colors.onMango, fontFamily: fonts.semibold }]}>
                {missing.length ? `Còn thiếu: ${missing.map((r) => r.label.charAt(0).toLocaleLowerCase('vi-VN') + r.label.slice(1)).join(', ')}. Bấm Sửa ở nhóm đó.` : 'Đánh dấu cam kết an toàn thực phẩm để nộp.'}
              </Text>
            ) : undefined
          }
          next={{ label: submitting ? 'Đang nộp…' : 'Đúng, nộp', icon: { sf: 'paperplane.fill', md: 'send' }, onPress: () => void submit(), disabled: blocked || submitting, loading: submitting }}
        />
      }
    >
      <Progress phase="card" />
      <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.control, backgroundColor: colors.mangoTint }}>
        <Icon sf="sparkles" md="auto_awesome" size={18} color={colors.onMango} />
        <Text style={[text.footnote, { flex: 1, color: colors.onMango }]}>
          <Text style={{ fontFamily: fonts.bold }}>[AI]</Text> Trợ lý soạn từ lời bạn kể và ảnh căn cước. Kiểm tra từng dòng. Hồ sơ chỉ gửi tới phường khi bạn bấm “Đúng, nộp”.
        </Text>
      </View>
      {groups.map((g) => (
        <GroupCard key={g.key} group={g} onEdit={edit} onSpeak={() => reader.speak(speakableGroup(g))} />
      ))}
      <View style={{ gap: 12, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, color: colors.ink }}>
          Cam kết
        </Text>
        <Checkbox checked={foodSafety} onChange={setFoodSafety}>
          <Text style={[text.callout, { color: colors.ink }]}>Tôi cam kết bảo đảm điều kiện an toàn thực phẩm khi kinh doanh đồ ăn, thức uống, theo quy định cho hộ kinh doanh nhỏ lẻ.</Text>
        </Checkbox>
      </View>
    </Screen>
  );
}

const CHIP: Record<FieldSource, { bg: string; fg: string }> = {
  VOICE: { bg: colors.mangoTint, fg: colors.onMango },
  CCCD: { bg: colors.signTint, fg: colors.sign },
  TYPED: { bg: colors.sunken, fg: colors.ink },
  CHOSEN: { bg: colors.sunken, fg: colors.ink },
  DEFAULT: { bg: colors.sunken, fg: colors.muted },
  EDITED: { bg: colors.leafTint, fg: colors.onLeaf },
};

function GroupCard({ group, onEdit, onSpeak }: { group: CardGroup; onEdit: (t: EditTarget) => void; onSpeak: () => void }) {
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}>
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 18, color: colors.ink }}>
          {group.title}
        </Text>
        <Pressable onPress={onSpeak} accessibilityRole="button" accessibilityLabel={`Đọc nhóm ${group.title}`} hitSlop={6} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.sticker : colors.mangoTint })}>
          <Icon sf="speaker.wave.2.fill" md="volume_up" size={18} color={colors.onMango} />
        </Pressable>
        <Pressable onPress={() => onEdit(group.edit)} accessibilityRole="button" accessibilityLabel={`Sửa ${group.title}`} hitSlop={6} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, backgroundColor: pressed ? colors.brandTint : colors.sunken })}>
          <Icon sf="pencil" md="edit" size={15} color={colors.primary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary }}>Sửa</Text>
        </Pressable>
      </View>
      {group.rows.map((r, i) => (
        <Row key={r.key} row={r} first={i === 0} />
      ))}
    </View>
  );
}

function Row({ row, first }: { row: CardRow; first: boolean }) {
  const missing = row.value === null;
  const tint = missing && row.required ? colors.dangerTint : row.warn ? colors.mangoTint : undefined;
  return (
    <View
      accessible
      accessibilityLabel={`${row.label}: ${row.value ?? (row.required ? 'còn thiếu' : 'không có')}${row.source ? `, ${SOURCE_LABELS[row.source]}` : ''}${row.warn ? ', kiểm tra kỹ' : ''}`}
      style={{ gap: 4, paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.separator, backgroundColor: tint }}
    >
      <Text style={[text.footnote, { color: colors.muted }]}>{row.label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, color: missing ? (row.required ? colors.onDanger : colors.muted) : colors.ink }}>{row.value ?? (row.required ? 'Còn thiếu' : '—')}</Text>
      {row.source || row.note ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {row.source ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: CHIP[row.source].bg }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: CHIP[row.source].fg }}>{SOURCE_LABELS[row.source]}</Text>
            </View>
          ) : null}
          {row.warn && !missing ? <Text style={[text.caption, { color: colors.onMango }]}>Kiểm tra kỹ dòng này</Text> : null}
          {row.note ? <Text style={[text.footnote, { color: colors.muted }]}>{row.note}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function DoneStep() {
  const result = useVoiceSessionStore((s) => s.result);
  const clear = useVoiceSessionStore((s) => s.clear);
  const close = useCloseFlow();
  if (!result) return null;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ResultView
        title={`Đã nộp hồ sơ ${result.displayName}`}
        body={`Phường xét trong khoảng 3 ngày làm việc.${result.nearbySlots > 0 ? ` Có ${result.nearbySlots} ô trống gần chỗ bạn, bạn xin ô sau khi được duyệt.` : ''}${result.labelled ? '' : ' (Chưa ghi được dấu "soạn bằng trợ lý"; hồ sơ vẫn đã nộp.)'}`}
        primary={{
          label: 'Xem hồ sơ',
          onPress: () => {
            clear();
            close();
            router.push(`/vendor/home/registrations/${result.registrationId}` as Href);
          },
        }}
        secondary={{
          label: 'Về trang chủ',
          onPress: () => {
            clear();
            close();
          },
        }}
      />
    </>
  );
}
