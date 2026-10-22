import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { StatusHeader } from '@/components/native/StatusHeader';
import { colors, fonts, radius, shadow, text } from '@/theme';
import { useVoiceSessionStore } from './voice-session-store';

export const VOICE_HREF = '/register-business/voice';

/**
 * "Nói để đăng ký": the faster door into registration, on the wizard's first step. Hidden while
 * the wizard is already editing a voice draft (the banner below leads back instead).
 */
export function VoiceEntry() {
  const editingVoiceDraft = useVoiceSessionStore((s) => s.active && s.handedOff);
  if (editingVoiceDraft) return null;
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        router.push(VOICE_HREF as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel="Nói để đăng ký. Chụp căn cước rồi kể vài câu, trợ lý AI điền giúp."
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.ctaPressed : colors.cta, boxShadow: shadow.glow })}
    >
      <View style={{ width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }}>
        <Icon sf="mic.fill" md="mic" size={28} color={colors.white} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 24, color: colors.white }}>Nói để đăng ký</Text>
        <Text style={[text.footnote, { color: 'rgba(255,255,255,0.9)' }]}>Nhanh, không cần gõ. Chụp căn cước rồi kể vài câu, trợ lý AI điền giúp.</Text>
      </View>
      <Icon sf="chevron.right" md="chevron_right" size={16} color={colors.white} />
    </Pressable>
  );
}

/** On the wizard steps "Sửa" opens from the voice confirm card: the way back to the card. */
export function VoiceReturnBanner() {
  const active = useVoiceSessionStore((s) => s.active && s.handedOff);
  const setPhase = useVoiceSessionStore((s) => s.setPhase);
  if (!active) return null;
  return (
    <StatusHeader
      tone="pending"
      icon={{ sf: 'mic.fill', md: 'mic' }}
      title="Đang sửa hồ sơ soạn bằng giọng nói"
      detail="Sửa xong thì quay lại thẻ xác nhận để nộp."
      action={{
        label: 'Quay lại thẻ xác nhận',
        onPress: () => {
          setPhase('card');
          router.dismissTo(VOICE_HREF as Href);
        },
      }}
    />
  );
}
