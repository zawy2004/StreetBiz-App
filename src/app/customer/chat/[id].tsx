import dayjs from 'dayjs';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { StackHeader } from '@/components/layout/StackHeader';
import { useChat } from '@/features/chat/chat-store';
import { useMockDb } from '@/mocks/db';
import { layout, radius, spacing, typography, useTheme } from '@/theme';

export default function ChatThreadScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === id);
  const conversation = useChat((s) => s.conversations).find((c) => c.storefrontId === id);
  const { open, markRead, send } = useChat();
  const [text, setText] = useState('');
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    open(id);
    markRead(id);
  }, [id, open, markRead]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [conversation?.messages.length]);

  function submit() {
    if (!id || !text.trim()) return;
    send(id, text.trim());
    setText('');
  }

  return (
    <>
      <StackHeader title={store?.name ?? 'Tin nhắn'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.bg }]}>
        <ScrollView ref={scroller} contentContainerStyle={styles.messages}>
          <View style={[styles.day, { backgroundColor: colors.sunken }]}>
            <AppText variant="small" color="muted">Hôm nay</AppText>
          </View>
          {conversation?.messages.map((m) => {
            const mine = m.from === 'me';
            return (
              <View key={m.id} style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                <View style={[styles.bubble, { backgroundColor: mine ? colors.indigo : colors.card, borderColor: colors.border, borderWidth: mine ? 0 : 1 }]}>
                  <AppText color={mine ? 'onIndigo' : 'text'}>{m.text}</AppText>
                </View>
                <AppText variant="small" color="muted">{dayjs(m.at).format('HH:mm')}</AppText>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Nhập tin nhắn"
            placeholderTextColor={colors.muted}
            onSubmitEditing={submit}
            returnKeyType="send"
            style={[typography.bodyLg, styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg }]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Gửi" onPress={submit} style={[styles.send, { backgroundColor: colors.primary }]}>
            <Icon name="send" size={22} color="onPrimary" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  messages: { padding: layout.screenMargin, gap: spacing.md },
  day: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.chip },
  bubbleWrap: { gap: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.card },
  composer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: layout.screenMargin, paddingTop: spacing.md, borderTopWidth: 1 },
  input: { flex: 1, minHeight: layout.touch, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.lg },
  send: { width: layout.touch, height: layout.touch, borderRadius: layout.touch / 2, alignItems: 'center', justifyContent: 'center' },
});
