import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { FilterChips } from '@/components/forms/FilterChips';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { radius, spacing, useTheme } from '@/theme';

const ANSWERS: Record<string, string> = {
  'Hạn nộp phí?': 'Phí thuê ô đóng trước ngày 15 hàng tháng. Quá hạn sẽ bị nhắc và có thể bị tạm ngưng giấy phép.',
  'Lối đi bộ tối thiểu?': 'Phải chừa lối đi bộ rộng tối thiểu 1,5 m. Bày hàng vượt vạch sơn sẽ bị lập biên bản.',
  'Cách gia hạn ô?': 'Vào Ô thuê, chọn hợp đồng, bấm Gia hạn rồi chọn thời gian. Phường sẽ duyệt yêu cầu.',
};

export default function VendorAssistantScreen() {
  const { colors } = useTheme();
  const [asked, setAsked] = useState<string[]>([]);

  return (
    <>
      <StackHeader title="Trợ lý" />
      <Screen>
        <Card style={[styles.note, { backgroundColor: colors.secondaryBg, borderColor: colors.secondary }]}>
          <AppText variant="labelSm" color="onSecondary">Gợi ý AI, chỉ để tham khảo</AppText>
        </Card>
        <Bubble text="Tôi giúp được gì về hồ sơ, phí hoặc quy định?" />
        {asked.map((q) => (
          <View key={q} style={{ gap: spacing.sm }}>
            <Bubble text={q} mine />
            <Bubble text={ANSWERS[q]!} />
          </View>
        ))}
        <FilterChips
          options={Object.keys(ANSWERS).map((q) => ({ value: q, label: q }))}
          selected={asked}
          onToggle={(q) => setAsked((a) => (a.includes(q) ? a : [...a, q]))}
        />
      </Screen>
    </>
  );
}

function Bubble({ text, mine }: { text: string; mine?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: mine ? colors.indigo : colors.card, borderColor: colors.border, borderWidth: mine ? 0 : 1 },
        ]}
      >
        <AppText color={mine ? 'onIndigo' : 'text'}>{text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderWidth: 1, padding: spacing.sm },
  bubble: { maxWidth: '85%', padding: spacing.md, borderRadius: radius.card },
});
