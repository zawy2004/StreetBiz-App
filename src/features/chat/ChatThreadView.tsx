import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { layout, radius, spacing, typography, useTheme } from '@/theme';
import { formatTime } from '@/utils/format';

import type { ThreadMessage } from './use-chat';

type Props = {
  messages: ThreadMessage[];
  onSend: (text: string) => Promise<unknown> | void;
  sending?: boolean;
  /** Short reply suggestions above the composer. */
  quickReplies?: string[];
};

/** Bubbles plus composer; data comes from `useThread`, so it works for both sides and both modes. */
export function ChatThreadView({ messages, onSend, sending, quickReplies = [] }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  function submit(body = text) {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setText('');
    void Promise.resolve(onSend(trimmed)).catch(() => setText(trimmed));
  }

  const canSend = Boolean(text.trim()) && !sending;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView ref={scroller} contentContainerStyle={styles.messages}>
        <View style={[styles.day, { backgroundColor: colors.sunken }]}>
          <AppText variant="caption" color="muted">Tin nhắn gần đây</AppText>
        </View>
        {messages.length === 0 ? (
          <AppText color="muted" align="center">Bắt đầu cuộc trò chuyện, quán thường trả lời trong vài phút.</AppText>
        ) : null}
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubbleWrap, { alignItems: m.mine ? 'flex-end' : 'flex-start' }]}>
            <View
              style={[
                styles.bubble,
                m.mine
                  ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomLeftRadius: 6 },
              ]}
            >
              <AppText color={m.mine ? 'onPrimary' : 'text'}>{m.text}</AppText>
            </View>
            <AppText variant="caption" color="muted">{formatTime(m.at)}</AppText>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {quickReplies.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
            {quickReplies.map((q) => (
              <Pressable
                key={q}
                accessibilityRole="button"
                onPress={() => submit(q)}
                style={({ pressed }) => [styles.quickChip, { borderColor: colors.border, backgroundColor: pressed ? colors.sunken : colors.card }]}
              >
                <AppText variant="labelSm">{q}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Nhập tin nhắn"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
            onSubmitEditing={() => submit()}
            returnKeyType="send"
            maxLength={2000}
            accessibilityLabel="Nội dung tin nhắn"
            style={[typography.bodyLg, styles.input, { color: colors.text, backgroundColor: colors.sunken }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi"
            disabled={!canSend}
            onPress={() => submit()}
            style={[styles.send, { backgroundColor: canSend ? colors.primary : colors.sunken }]}
          >
            <Icon name="send" size={20} color={canSend ? 'onPrimary' : 'muted'} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  messages: { padding: layout.screenMargin, gap: spacing.md },
  day: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  bubbleWrap: { gap: 3 },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2, borderRadius: 20 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.sm },
  quick: { gap: spacing.sm, paddingHorizontal: layout.screenMargin },
  quickChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: layout.screenMargin },
  input: { flex: 1, minHeight: layout.touch, borderRadius: radius.full, paddingHorizontal: spacing.lg, outlineStyle: 'none' as never },
  send: { width: layout.touch, height: layout.touch, borderRadius: layout.touch / 2, alignItems: 'center', justifyContent: 'center' },
});
