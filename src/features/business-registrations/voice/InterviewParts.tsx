import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { LeafletMap } from '@/components/map/LeafletMap';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { formatHours, formatStartDate, isConfirmed } from './interview-state';
import { useClipRecorder } from './useClipRecorder';
import type { useReadAloud } from './useReadAloud';
import type { AssistAudio, AssistDraft, AssistQuestion, AssistSlotPreview } from './voice-registration.types';

type Pin = { latitude: number; longitude: number };

export type InterviewProps = {
  question: AssistQuestion;
  draft: AssistDraft;
  busy: boolean;
  transcript: string | null;
  warnings: string[];
  location: { label: string; latitude: number; longitude: number } | null;
  slotPreview: AssistSlotPreview[];
  wardName: (unitId: number | null | undefined) => string | null;
  aiDown: boolean;
  voiceConsent: boolean;
  typing: boolean;
  onTypingChange: (typing: boolean) => void;
  reader: ReturnType<typeof useReadAloud>;
  autoRead: boolean;
  onVoice: (clip: AssistAudio) => void;
  onText: (text: string) => void;
  onChoice: (value: string) => void;
  /** MANUAL input: returns an error message, or undefined when the value was taken. */
  onTyped: (text: string) => string | undefined;
  onPin: (pin: Pin) => void;
  onSkip: () => void;
  onWizard: () => void;
};

/**
 * One interview turn on the phone: the question in big type (read aloud), one way to answer it,
 * what the assistant heard, and the registration filling up underneath.
 */
export function InterviewTurn(props: InterviewProps) {
  const { question, reader, autoRead } = props;
  const lastRead = useRef('');
  useEffect(() => {
    if (!autoRead || lastRead.current === question.text) return;
    lastRead.current = question.text;
    reader.speak(question.text);
  }, [autoRead, question.text, reader]);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 18, padding: 20, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 24, lineHeight: 31, letterSpacing: -0.2, color: colors.ink }}>
            {question.text}
          </Text>
          <Pressable
            onPress={() => (reader.speaking ? reader.stop() : reader.speak(question.text))}
            accessibilityRole="button"
            accessibilityLabel={reader.speaking ? 'Dừng đọc' : 'Đọc lại câu hỏi'}
            hitSlop={8}
            style={({ pressed }) => ({ width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.sticker : colors.mangoTint })}
          >
            <Icon sf={reader.speaking ? 'stop.fill' : 'speaker.wave.2.fill'} md={reader.speaking ? 'stop' : 'volume_up'} size={22} color={colors.onMango} />
          </Pressable>
        </View>
        {/* Keyed by the question: a new question starts with an empty box and a fresh pin. */}
        <Answer key={question.key} {...props} />
        {props.transcript ? (
          <View style={{ padding: 12, borderRadius: radius.control, backgroundColor: colors.sunken }}>
            <Text style={[text.footnote, { color: colors.muted }]}>Trợ lý nghe được</Text>
            <Text style={[text.callout, { color: colors.ink }]}>“{props.transcript}”</Text>
          </View>
        ) : null}
        {props.warnings.length > 0 && !props.busy
          ? props.warnings.map((w) => (
              <View key={w} style={{ flexDirection: 'row', gap: 8 }}>
                <Icon sf="info.circle.fill" md="info" size={16} color={colors.onMango} style={{ marginTop: 2 }} />
                <Text style={[text.footnote, { flex: 1, color: colors.onMango, fontFamily: fonts.semibold }]}>{w}</Text>
              </View>
            ))
          : null}
      </View>
      <GrowingFile draft={props.draft} location={props.location} wardName={props.wardName} />
      {props.slotPreview.length > 0 ? <SlotPreviewList slots={props.slotPreview} /> : null}
    </View>
  );
}

function Answer(props: InterviewProps) {
  const { question, busy } = props;
  if (question.input === 'MAP') return <PinConfirm {...props} />;
  if (question.input === 'CHOICE' || question.input === 'CONFIRM') {
    const confirm = question.input === 'CONFIRM';
    return (
      <View style={{ gap: 10 }}>
        {question.choices.map((c, i) => (
          <Button
            key={c.value}
            label={c.label}
            size={56}
            variant={confirm && i === 0 ? 'primary' : 'secondary'}
            icon={confirm ? (i === 0 ? { sf: 'checkmark', md: 'check' } : { sf: 'arrow.counterclockwise', md: 'replay' }) : undefined}
            loading={busy && i === 0}
            disabled={busy}
            onPress={() => {
              void Haptics.selectionAsync();
              props.onChoice(c.value);
            }}
          />
        ))}
      </View>
    );
  }
  if (question.input === 'MANUAL') return <ManualAnswer {...props} />;
  return <VoiceAnswer {...props} />;
}

/** The microphone: tap to talk, tap again to send; "Gõ thay" types the same answer. */
function VoiceAnswer(props: InterviewProps) {
  const { busy, reader } = props;
  const typing = props.typing || !props.voiceConsent;
  const [text_, setText] = useState('');
  const recorder = useClipRecorder((clip) => {
    if (clip) props.onVoice(clip);
  });
  const recording = recorder.state === 'recording';
  // While recording, a soft ring breathes around the button (the state, not decoration).
  const ring = useAnimatedStyle(() => ({
    opacity: recording ? withRepeat(withTiming(0.15, { duration: 700 }), -1, true) : 0,
    transform: [{ scale: recording ? withRepeat(withTiming(1.25, { duration: 700 }), -1, true) : 1 }],
  }));


  if (props.aiDown) {
    return (
      <View accessibilityRole="alert" style={{ gap: 12, padding: 16, borderRadius: radius.control, backgroundColor: colors.mangoTint }}>
        <Text style={[text.subhead, { color: colors.onMango }]}>Trợ lý AI đang bận nên chưa nghe được. Phần bạn đã kể vẫn được giữ, điền tiếp bằng tay nhé.</Text>
        <Button label="Điền tiếp bằng tay" onPress={props.onWizard} />
      </View>
    );
  }

  const toggle = () => {
    if (recording) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      recorder.stop();
      return;
    }
    reader.stop();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void recorder.start();
  };

  return (
    <View style={{ gap: 14, alignItems: 'center' }}>
      {!typing ? (
        <>
          <View style={{ width: 128, height: 128, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: colors.cta }, ring]} />
            <Pressable
              onPress={toggle}
              disabled={busy || recorder.state === 'requesting'}
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Dừng và gửi câu trả lời' : 'Bấm để nói'}
              accessibilityState={{ selected: recording, busy }}
              style={({ pressed }) => ({ width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.ctaPressed : colors.cta, boxShadow: shadow.glow, opacity: busy ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
            >
              {busy ? <ActivityIndicator color={colors.white} size="large" /> : <Icon sf={recording ? 'stop.fill' : 'mic.fill'} md={recording ? 'stop' : 'mic'} size={44} color={colors.white} />}
            </Pressable>
          </View>
          <Text accessibilityLiveRegion="polite" style={[text.headline, { textAlign: 'center', color: colors.ink }]}>
            {busy ? 'Trợ lý đang nghe lại lời bạn…' : recording ? `Đang nghe… bấm lần nữa để gửi (còn ${recorder.maxSeconds - recorder.elapsed} giây)` : recorder.state === 'requesting' ? 'Đang mở micro…' : 'Bấm vào micro rồi nói'}
          </Text>
          {recorder.error ? <Text style={[text.footnote, { textAlign: 'center', color: colors.onDanger }]}>{recorder.error}</Text> : null}
        </>
      ) : (
        <View style={{ alignSelf: 'stretch', gap: 12 }}>
          <TextField label="Gõ câu trả lời" value={text_} onChangeText={setText} placeholder={TYPED_EXAMPLES[props.question.key] ?? TYPED_EXAMPLES.OPENING} multiline maxLength={500} />
          <Button
            label="Gửi"
            loading={busy}
            disabled={!text_.trim() || busy}
            onPress={() => {
              props.onText(text_);
              setText('');
            }}
          />
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {props.voiceConsent ? (
          <LinkButton
            label={typing ? 'Nói thay' : 'Gõ thay'}
            icon={typing ? { sf: 'mic', md: 'mic' } : { sf: 'keyboard', md: 'keyboard' }}
            disabled={busy || recording}
            onPress={() => {
              recorder.cancel();
              props.onTypingChange(!typing);
            }}
          />
        ) : null}
        {props.question.skippable ? <LinkButton label="Bỏ qua" disabled={busy || recording} onPress={props.onSkip} /> : null}
      </View>
    </View>
  );
}

/** After two misheard answers: a plain field for exactly this value, taken as typed (no AI). */
function ManualAnswer(props: InterviewProps) {
  const field = props.question.field;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const amount = field === 'capitalAmount' && value ? Number(value.replace(/[^\d]/g, '')) : null;

  return (
    <View style={{ gap: 12 }}>
      {field === 'plannedStartDate' ? (
        <DateField label="Ngày bắt đầu bán" value={value} onChange={setValue} error={error} minimumDate={new Date()} />
      ) : (
        <TextField
          label={MANUAL_LABELS[field ?? ''] ?? 'Câu trả lời'}
          value={value}
          onChangeText={(v) => setValue(field === 'capitalAmount' || field === 'laborCount' ? v.replace(/[^\d]/g, '') : v)}
          keyboardType={field === 'capitalAmount' || field === 'laborCount' ? 'number-pad' : 'default'}
          placeholder={MANUAL_PLACEHOLDERS[field ?? '']}
          error={error}
          trailing={field === 'capitalAmount' ? <Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text> : undefined}
        />
      )}
      {amount ? <Text style={[sign.price, tabular, { color: colors.primary }]}>{formatVnd(amount)}</Text> : null}
      <Button label="Xong" loading={props.busy} disabled={!value.trim() || props.busy} onPress={() => setError(props.onTyped(value))} />
    </View>
  );
}

/** "Đúng chỗ này chưa?": the spot as a pin; a tap on the map moves it. */
function PinConfirm(props: InterviewProps) {
  const initial = props.draft.latitude != null && props.draft.longitude != null ? { latitude: props.draft.latitude, longitude: props.draft.longitude } : null;
  const [pin, setPin] = useState<Pin | null>(initial);
  const moved = !!pin && !!initial && (pin.latitude !== initial.latitude || pin.longitude !== initial.longitude);

  return (
    <View style={{ gap: 12 }}>
      <LeafletMap
        center={pin ? [pin.latitude, pin.longitude] : [16.0607, 108.2155]}
        zoom={pin ? 18 : 15}
        markers={pin ? [{ id: 'spot', latitude: pin.latitude, longitude: pin.longitude, label: 'Chỗ bán', fill: colors.cta, ink: colors.white, selected: true }] : []}
        onMapPress={(latitude, longitude) => {
          void Haptics.selectionAsync();
          setPin({ latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 });
        }}
        style={{ height: 280, borderRadius: radius.photo, overflow: 'hidden' }}
      />
      <Text style={[text.footnote, { color: colors.muted }]}>
        {moved ? 'Bạn đã dời ghim. Bấm "Đúng chỗ này" để dùng vị trí mới.' : props.location ? `Trợ lý tìm thấy: ${props.location.label}. Chạm vào bản đồ để dời ghim nếu lệch.` : 'Chạm vào bản đồ để đặt ghim ở chỗ bạn hay đứng bán.'}
      </Text>
      <Button label="Đúng chỗ này" icon={{ sf: 'checkmark', md: 'check' }} disabled={!pin || props.busy} loading={props.busy} onPress={() => pin && props.onPin(pin)} />
      <LinkButton label="Bỏ qua" disabled={props.busy} onPress={props.onSkip} />
    </View>
  );
}

function LinkButton({ label, icon, disabled, onPress }: { label: string; icon?: { sf: string; md: string }; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: pressed ? colors.brandTint : 'transparent', opacity: disabled ? 0.45 : 1 })}
    >
      {icon ? <Icon sf={icon.sf} md={icon.md} size={17} color={colors.primary} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.primary }}>{label}</Text>
    </Pressable>
  );
}

const TYPED_EXAMPLES: Record<string, string> = {
  OPENING: 'Ví dụ: Bán bún bò gần chợ Cồn, sáng 6 giờ tới 10 giờ',
  BUSINESS_LINE: 'Ví dụ: Bún bò, bánh mì',
  LOCATION: 'Ví dụ: Gần chợ Hàn, đường Bạch Đằng',
  ADDRESS: 'Ví dụ: 12 Lê Duẩn',
  CAPITAL: 'Ví dụ: Ba chục triệu',
  LABOR: 'Ví dụ: Hai vợ chồng',
  START_DATE: 'Ví dụ: Thứ Hai tuần sau',
  CART_WIDTH: 'Ví dụ: Một mét hai',
};
const MANUAL_LABELS: Record<string, string> = {
  businessLine: 'Món hoặc mặt hàng bạn bán',
  declaredAddress: 'Địa chỉ cửa hàng',
  capitalAmount: 'Vốn ban đầu',
  laborCount: 'Số người cùng bán, tính cả bạn',
};
const MANUAL_PLACEHOLDERS: Record<string, string> = {
  businessLine: 'Bún bò, bánh mì',
  declaredAddress: '12 Lê Duẩn',
  capitalAmount: '30000000',
  laborCount: '2',
};

/** The registration filling up as the vendor talks: one tile per field heard so far. */
function GrowingFile({ draft, location, wardName }: Pick<InterviewProps, 'draft' | 'location' | 'wardName'>) {
  const waiting = (f: 'capitalAmount' | 'laborCount' | 'plannedStartDate') => !isConfirmed(draft, f);
  const tiles: { key: string; label: string; value: string | null; pending?: boolean }[] = [
    { key: 'businessLine', label: 'Món bán', value: draft.businessLine ?? null },
    { key: 'vendorType', label: 'Cách bán', value: draft.vendorType ? (draft.vendorType === 'FIXED_STOREFRONT' ? 'Cửa hàng cố định' : 'Xe đẩy, gánh, bán rong') : null },
    { key: 'hours', label: 'Giờ bán', value: formatHours(draft.hours) || null },
    { key: 'location', label: 'Chỗ bán', value: draft.locationSkipped ? 'Chọn sau' : (location?.label ?? draft.locationText ?? null), pending: !draft.locationConfirmed && !draft.locationSkipped && draft.latitude != null },
    { key: 'ward', label: 'Phường', value: wardName(draft.wardUnitId) },
    ...(draft.vendorType === 'FIXED_STOREFRONT' ? [{ key: 'declaredAddress', label: 'Địa chỉ', value: draft.declaredAddress ?? null }] : []),
    { key: 'capitalAmount', label: 'Vốn', value: draft.capitalAmount != null ? formatVnd(draft.capitalAmount) : null, pending: draft.capitalAmount != null && waiting('capitalAmount') },
    { key: 'laborCount', label: 'Số người', value: draft.laborCount != null ? `${draft.laborCount} người` : null, pending: draft.laborCount != null && waiting('laborCount') },
    { key: 'plannedStartDate', label: 'Bắt đầu bán', value: formatStartDate(draft.plannedStartDate) || null, pending: !!draft.plannedStartDate && waiting('plannedStartDate') },
  ];
  const filled = tiles.filter((t) => t.value).length;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, color: colors.ink }}>
          Hồ sơ của bạn
        </Text>
        <Text style={[text.subhead, tabular, { color: colors.muted }]}>
          {filled}/{tiles.length} mục
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tiles.map((t) => (
          <View
            key={t.key}
            accessible
            accessibilityLabel={`${t.label}: ${t.value ?? 'chưa có'}${t.pending ? ', chờ bạn xác nhận' : ''}`}
            style={{ flexBasis: '47%', flexGrow: 1, minHeight: 64, justifyContent: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: t.value ? (t.pending ? colors.mangoTint : colors.brandTint) : colors.sunken }}
          >
            <Text style={[text.caption, { color: colors.muted }]}>{t.label.toLocaleUpperCase('vi-VN')}</Text>
            <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: t.value ? colors.ink : colors.line }}>
              {t.value ?? '—'}
            </Text>
            {t.value && t.pending ? <Text style={[text.caption, { color: colors.onMango }]}>chờ bạn xác nhận</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Up to three free slots near the spot -- a preview only; applying waits for approval (BR-16). */
function SlotPreviewList({ slots }: { slots: AssistSlotPreview[] }) {
  return (
    <View style={{ gap: 10, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>
        {slots.length} ô trống gần chỗ bạn bán
      </Text>
      <Text style={[text.footnote, { color: colors.onLeaf }]}>Chỉ để xem trước. Bạn xin ô sau khi hồ sơ được phường duyệt.</Text>
      {slots.map((s) => (
        <View key={s.slotId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.control, backgroundColor: colors.card }}>
          <Text style={[sign.plate, { color: colors.ink }]}>{s.slotCode}</Text>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[text.subhead, { color: colors.ink }]}>
              {s.zoneName}
            </Text>
            <Text style={[text.footnote, tabular, { color: colors.muted }]}>
              {s.widthMeters != null && s.lengthMeters != null ? `${s.widthMeters} × ${s.lengthMeters} m · ` : ''}
              {formatVnd(s.monthlyPrice)}/tháng{s.fitsCart === true ? ' · vừa xe' : s.fitsCart === false ? ' · hẹp hơn xe' : ''}
            </Text>
          </View>
          <Text style={[text.subhead, tabular, { color: colors.muted }]}>~{Math.round(s.distanceMeters)} m</Text>
        </View>
      ))}
    </View>
  );
}
