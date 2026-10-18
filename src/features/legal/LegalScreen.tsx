import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { KerbStrip } from '@/components/common/KerbStrip';
import { colors, fonts, radius, space, text } from '@/theme';
import { LEGAL_BASIS, PRIVACY, SLOT_RULES, TERMS, type LegalDocument } from './legal-content';

const DOCS: Record<string, LegalDocument> = {
  terms: TERMS,
  privacy: PRIVACY,
  'slot-rules': SLOT_RULES,
  basis: LEGAL_BASIS,
};

/**
 * L02–L05: the four static legal pages. The contents chips jump to a section; a link from a
 * form can open a section directly (`?section=xu-phat`, the web's `#xu-phat`) and closing
 * this screen returns to the form untouched (the web opened a new tab for that).
 */
export function LegalScreen() {
  const { doc, section } = useLocalSearchParams<{ doc: string; section?: string }>();
  const document = DOCS[doc] ?? TERMS;
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const jumped = useRef(false);

  return (
    <ScrollView
      ref={scroll}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingBottom: 48, gap: 18 }}
    >
      <Stack.Screen options={{ title: document.title }} />
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={[text.largeTitle, { fontSize: 28, lineHeight: 35, color: colors.ink }]}>
          {document.title}
        </Text>
        <Text style={[text.callout, { color: colors.muted }]}>{document.summary}</Text>
        <Text style={[text.footnote, { color: colors.muted }]}>Cập nhật ngày {document.updatedAt}</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>Mục lục</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {document.sections.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => scroll.current?.scrollTo({ y: (offsets.current[s.id] ?? 0) - 8, animated: true })}
              accessibilityRole="link"
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: pressed ? colors.brandTint : colors.card,
                borderWidth: 1,
                borderColor: colors.line,
              })}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink }}>
                {i + 1}. {s.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {document.sections.map((s, i) => (
        <View
          key={s.id}
          onLayout={(e) => {
            offsets.current[s.id] = e.nativeEvent.layout.y;
            if (!jumped.current && section === s.id) {
              jumped.current = true;
              scroll.current?.scrollTo({ y: e.nativeEvent.layout.y - 8, animated: false });
            }
          }}
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            overflow: 'hidden',
            borderWidth: section === s.id ? 1.5 : 0,
            borderColor: colors.cta,
          }}
        >
          {i === 0 ? <KerbStrip height={4} segment={18} /> : null}
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={[text.title3, { color: colors.ink }]}>
              {i + 1}. {s.title}
            </Text>
            {s.paragraphs.map((p, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 9 }} />
                <Text style={[text.body, { flex: 1, color: '#2B3640' }]}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
