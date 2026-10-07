import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { FilterChips } from '@/components/forms/FilterChips';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { apiPost } from '@/core/api/client';
import { errorMessage } from '@/core/api/problem';
import { isLiveApi } from '@/core/config/env';
import { radius, spacing, useTheme } from '@/theme';

/** Canned answers for the demo data; live questions go to the backend's AI assistant. */
const ANSWERS: Record<string, string> = {
  'Hạn nộp phí?': 'Phí thuê ô đóng trước ngày 15 hàng tháng. Quá hạn sẽ bị nhắc và có thể bị tạm ngưng giấy phép.',
  'Lối đi bộ tối thiểu?': 'Phải chừa lối đi bộ rộng tối thiểu 1,5 m. Bày hàng vượt vạch sơn sẽ bị lập biên bản.',
  'Cách gia hạn ô?': 'Vào Ô thuê, chọn hợp đồng, bấm Gia hạn rồi chọn thời gian. Phường sẽ duyệt yêu cầu.',
};

type Turn = { q: string; a?: string; error?: boolean };

/** AI-01: compliance Q&A for vendors. Answers are advisory, never a ruling. */
export default function VendorAssistantScreen() {
  const { colors } = useTheme();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    setTurns((t) => [...t, { q }]);
    if (!isLiveApi) {
      setTurns((t) => t.map((x) => (x.q === q && !x.a ? { ...x, a: ANSWERS[q] ?? 'Câu này trợ lý demo chưa có sẵn trả lời; hãy hỏi cán bộ phường.' } : x)));
      return;
    }
    setBusy(true);
    try {
      // Spends real LLM credits and is rate limited per account: only on an explicit question.
      const r = await apiPost<{ answer: string }>('/ward/ai/vendor-assistant', { question: q, context: null });
      setTurns((t) => t.map((x) => (x.q === q && !x.a ? { ...x, a: r.answer } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.q === q && !x.a ? { ...x, a: errorMessage(e), error: true } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StackHeader title="Trợ lý" />
      <Screen
        footer={
          <View style={styles.composer}>
            <View style={styles.flex}>
              <TextField placeholder="Hỏi về phí, giấy phép, quy định…" value={text} onChangeText={setText} onSubmitEditing={() => void ask(text)} returnKeyType="send" />
            </View>
            <Button label="Hỏi" fullWidth={false} loading={busy} disabled={!text.trim()} onPress={() => void ask(text)} />
          </View>
        }
      >
        <Card style={[styles.note, { backgroundColor: colors.secondaryBg, borderColor: colors.secondary }]}>
          <AppText variant="labelSm" color="onSecondary">Gợi ý AI, chỉ để tham khảo. Quy định chính thức do phường quyết định.</AppText>
        </Card>
        <Bubble text="Tôi giúp được gì về hồ sơ, phí hoặc quy định?" />
        {turns.map((t, i) => (
          <View key={`${t.q}-${i}`} style={{ gap: spacing.sm }}>
            <Bubble text={t.q} mine />
            {t.a ? <Bubble text={t.a} error={t.error} /> : <ActivityIndicator color={colors.primary} style={styles.loader} />}
          </View>
        ))}
        <FilterChips options={Object.keys(ANSWERS).map((q) => ({ value: q, label: q }))} selected={[]} onToggle={(q) => void ask(q)} />
      </Screen>
    </>
  );
}

function Bubble({ text, mine, error }: { text: string; mine?: boolean; error?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary }
            : { backgroundColor: error ? colors.errorBg : colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 },
        ]}
      >
        <AppText color={mine ? 'onPrimary' : error ? 'onError' : 'text'}>{text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderWidth: 1, padding: spacing.sm },
  bubble: { maxWidth: '85%', padding: spacing.md, borderRadius: radius.card },
  loader: { alignSelf: 'flex-start', marginLeft: spacing.md },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
