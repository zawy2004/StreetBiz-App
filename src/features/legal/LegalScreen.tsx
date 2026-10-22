import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { colors, fonts, radius, shadow, sign, space, tabular, text } from '@/theme';
import { LEGAL_BASIS, PRIVACY, SLOT_RULES, TERMS, type LegalDocument } from './legal-content';

const DOCS: Record<string, LegalDocument> = {
  terms: TERMS,
  privacy: PRIVACY,
  'slot-rules': SLOT_RULES,
  basis: LEGAL_BASIS,
};

/** Each document's symbol on its cover. */
const DOC_ICON: Record<string, { sf: string; md: string }> = {
  terms: { sf: 'doc.text.fill', md: 'description' },
  privacy: { sf: 'hand.raised.fill', md: 'privacy_tip' },
  'slot-rules': { sf: 'square.grid.3x3.fill', md: 'grid_view' },
  basis: { sf: 'building.columns.fill', md: 'account_balance' },
};

/**
 * L02–L05: the four static legal pages (screens/v5/shared-admin.md). A cover with the painted kerb,
 * the contents as a numbered list that jumps to a section, then each section under its number in
 * sign lettering. A link from a form can open a section directly (`?section=xu-phat`, the web's
 * `#xu-phat`) and closing this screen returns to the form untouched. The words are the documents'
 * own and are never shortened.
 */
export function LegalScreen() {
  const { doc, section } = useLocalSearchParams<{ doc: string; section?: string }>();
  const document = DOCS[doc] ?? TERMS;
  const icon = DOC_ICON[doc] ?? DOC_ICON.terms!;
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

      {/* The cover */}
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <KerbStrip height={8} segment={22} />
        <View style={{ padding: 20, gap: 10 }}>
          <View style={{ width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf={icon.sf} md={icon.md} size={24} color={colors.sign} />
          </View>
          <Text accessibilityRole="header" style={[text.title1, { color: colors.ink }]}>
            {document.title}
          </Text>
          <Text style={[text.callout, { color: '#2B3640' }]}>{document.summary}</Text>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.sunken }}>
            <Icon sf="calendar" md="event" size={13} color={colors.muted} />
            <Text style={[text.caption, tabular, { color: colors.muted }]}>Cập nhật ngày {document.updatedAt}</Text>
          </View>
        </View>
      </View>

      {/* Contents: a list that jumps to its section */}
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink, marginLeft: 4 }}>Mục lục</Text>
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {document.sections.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => scroll.current?.scrollTo({ y: (offsets.current[s.id] ?? 0) - 8, animated: true })}
              accessibilityRole="link"
              accessibilityLabel={`Mục ${i + 1}: ${s.title}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 52,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: pressed ? colors.pressed : section === s.id ? colors.kerbPaint : colors.card,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.separator,
              })}
            >
              <Text maxFontSizeMultiplier={1.4} style={[sign.price, { minWidth: 24, color: colors.primary }, tabular]}>{i + 1}</Text>
              <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{s.title}</Text>
              <Icon sf="chevron.down" md="expand_more" size={13} color={colors.muted} />
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
            borderWidth: section === s.id ? 2 : 0,
            borderColor: colors.cta,
            boxShadow: shadow.card,
          }}
        >
          <View style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text maxFontSizeMultiplier={1.3} style={[sign.title, { minWidth: 26, color: colors.primary }, tabular]}>
                {i + 1}
              </Text>
              <Text accessibilityRole="header" style={[text.title3, { flex: 1, color: colors.ink, fontFamily: fonts.heavy, paddingTop: 8 }]}>
                {s.title}
              </Text>
            </View>
            {s.paragraphs.map((p, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.brand, marginTop: 9 }} />
                <Text style={[text.body, { flex: 1, color: '#2B3640' }]}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
