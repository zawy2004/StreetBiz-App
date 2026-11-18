import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius, shadow, text } from '@/theme';
import type { LiveCaption, LiveStatus } from './live-interview';

const STATUS_TEXT: Record<LiveStatus, string> = {
  idle: 'Sẵn sàng',
  connecting: 'Đang kết nối với trợ lý…',
  listening: 'Trợ lý đang nghe — cứ nói',
  thinking: 'Trợ lý đang ghi lại…',
  speaking: 'Trợ lý đang nói',
  muted: 'Đã tắt micro',
  reconnecting: 'Đang nối lại…',
  ended: 'Đã dừng',
};

/** Before the conversation: one tap opens the microphone. */
export function LiveStart({ question, onStart, onTapToTalk }: { question: string | null; onStart: () => void; onTapToTalk: () => void }) {
  return (
    <View style={{ gap: 16, padding: 20, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cta, boxShadow: shadow.glow }}>
          <Icon sf="waveform" md="graphic_eq" size={26} color={colors.white} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={[text.title2, { color: colors.ink }]}>
            Trò chuyện với trợ lý
          </Text>
          <Text style={[text.callout, { color: colors.muted }]}>
            Bấm bắt đầu, trợ lý chào và hỏi; bạn trả lời như nói chuyện. Số tiền, ngày, bản đồ vẫn hiện trên màn hình để bạn bấm xác nhận.
          </Text>
          {question ? <Text style={[text.footnote, { color: colors.muted }]}>Câu đang hỏi: “{question}”</Text> : null}
        </View>
      </View>
      <Button
        label="Bắt đầu trò chuyện"
        size={56}
        icon={{ sf: 'mic.fill', md: 'mic' }}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onStart();
        }}
      />
      <Pressable onPress={onTapToTalk} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>Bấm để nói từng câu</Text>
      </Pressable>
    </View>
  );
}

/**
 * While talking: who has the floor, the last lines of both sides (the assistant's marked [AI],
 * BR-42), and the controls -- microphone, cut in, stop. The phone cannot listen while it speaks,
 * so "Ngắt lời" is how the vendor takes the floor early.
 */
export function LivePanel({
  status,
  captions,
  notice,
  muted,
  onMute,
  onInterrupt,
  onStop,
}: {
  status: LiveStatus;
  captions: LiveCaption[];
  notice: string;
  muted: boolean;
  onMute: (muted: boolean) => void;
  onInterrupt: () => void;
  onStop: () => void;
}) {
  const speaking = status === 'speaking';
  const listening = status === 'listening';
  const ring = useAnimatedStyle(() => ({
    opacity: speaking || listening ? withRepeat(withTiming(0.12, { duration: 800 }), -1, true) : 0,
    transform: [{ scale: speaking || listening ? withRepeat(withTiming(1.3, { duration: 800 }), -1, true) : 1 }],
  }));

  return (
    <View accessibilityLabel="Trò chuyện với trợ lý" style={{ gap: 14, padding: 18, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.mangoTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: speaking ? colors.leaf : colors.cta }, ring]} />
          <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: muted ? colors.muted : speaking ? colors.leaf : colors.cta }}>
            <Icon sf={muted ? 'mic.slash.fill' : speaking ? 'waveform' : 'mic.fill'} md={muted ? 'mic_off' : speaking ? 'graphic_eq' : 'mic'} size={24} color={colors.white} />
          </View>
        </View>
        <Text accessibilityLiveRegion="polite" style={[text.headline, { flex: 1, color: colors.ink }]}>
          {STATUS_TEXT[status]}
        </Text>
      </View>

      {captions.length > 0 ? (
        <View style={{ gap: 8 }}>
          {captions.map((c) => (
            <View
              key={c.id}
              style={{
                alignSelf: c.who === 'vendor' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.control,
                backgroundColor: c.who === 'vendor' ? colors.card : colors.sticker,
              }}
            >
              <Text style={[text.caption, { color: colors.muted }]}>{c.who === 'vendor' ? 'Bạn' : '[AI] Trợ lý'}</Text>
              <Text style={[text.callout, { color: colors.ink }]}>{c.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {notice ? <Text style={[text.footnote, { color: colors.onMango, fontFamily: fonts.semibold }]}>{notice}</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {speaking ? (
          <Button label="Ngắt lời" variant="secondary" icon={{ sf: 'hand.raised.fill', md: 'front_hand' }} onPress={onInterrupt} style={{ flexGrow: 1 }} />
        ) : (
          <Button
            label={muted ? 'Bật micro' : 'Tắt micro'}
            variant="secondary"
            icon={muted ? { sf: 'mic.fill', md: 'mic' } : { sf: 'mic.slash.fill', md: 'mic_off' }}
            onPress={() => onMute(!muted)}
            style={{ flexGrow: 1 }}
          />
        )}
        <Button label="Dừng" variant="secondary" icon={{ sf: 'stop.fill', md: 'stop' }} onPress={onStop} style={{ flexGrow: 1 }} />
      </View>
    </View>
  );
}
