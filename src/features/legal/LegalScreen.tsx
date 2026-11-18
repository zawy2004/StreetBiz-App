import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { colors, fonts, radius, shadow, sign, space, tabular, text } from '@/theme';
import { LEGAL_BASIS, LEGAL_PAGES, PRIVACY, SLOT_RULES, TERMS, type LegalBlock, type LegalDocument } from './legal-content';
import { readingMinutes } from './reading-time';

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

const NOTE_TONE = {
  info: { wash: colors.signTint, ink: colors.sign, sf: 'info.circle.fill', md: 'info' },
  warn: { wash: colors.dangerTint, ink: colors.danger, sf: 'exclamationmark.triangle.fill', md: 'warning' },
} as const;

/** One block of a section: paragraph, bullets, numbered steps, a table (as stacked rows) or a note. */
function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'p':
      return <Text style={[text.body, { color: '#2B3640' }]}>{block.text}</Text>;
    case 'list':
      return (
        <View style={{ gap: 8 }}>
          {block.items.map((item) => (
            <View key={item} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.brand, marginTop: 9 }} />
              <Text style={[text.body, { flex: 1, color: '#2B3640' }]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'steps':
      return (
        <View style={{ gap: 10 }}>
          {block.items.map((item, i) => (
            <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: radius.full, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <Text accessibilityElementsHidden style={[text.caption, tabular, { color: colors.white }]}>{i + 1}</Text>
              </View>
              <Text style={[text.body, { flex: 1, color: '#2B3640' }]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'table':
      // A phone has no room for columns: each row becomes a card whose first cell is its title.
      return (
        <View style={{ gap: 8 }}>
          {block.rows.map((row) => (
            <View key={row[0]} accessible style={{ borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.sunken, padding: 12, gap: 6 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 15, lineHeight: 20, color: colors.ink }}>{row[0]}</Text>
              {row.slice(1).map((cell, i) => (
                <View key={block.head[i + 1]} style={{ gap: 1 }}>
                  <Text style={[text.caption, { color: colors.muted }]}>{block.head[i + 1]}</Text>
                  <Text style={[text.callout, { color: '#2B3640' }]}>{cell}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    case 'note': {
      const tone = NOTE_TONE[block.tone];
      return (
        <View accessible accessibilityLabel={`${block.title}. ${block.text}`} style={{ flexDirection: 'row', gap: 10, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: tone.wash, padding: 12 }}>
          <Icon sf={tone.sf} md={tone.md} size={20} color={tone.ink} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 15, lineHeight: 20, color: tone.ink }}>{block.title}</Text>
            <Text style={[text.callout, { color: colors.ink }]}>{block.text}</Text>
          </View>
        </View>
      );
    }
  }
}

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
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
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
            <Text style={[text.caption, tabular, { color: colors.muted }]}>
              Cập nhật ngày {document.updatedAt} · Đọc khoảng {readingMinutes(document)} phút
            </Text>
          </View>
        </View>
      </View>

      {/* The points not to miss */}
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint, padding: 16, gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.onLeaf }}>Tóm tắt nhanh</Text>
        {document.highlights.map((point) => (
          <View key={point} style={{ flexDirection: 'row', gap: 10 }}>
            <Icon sf="checkmark.circle.fill" md="check_circle" size={18} color={colors.leaf} />
            <Text style={[text.callout, { flex: 1, color: colors.ink }]}>{point}</Text>
          </View>
        ))}
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
            {s.blocks.map((block, j) => (
              <Block key={`${s.id}-${j}`} block={block} />
            ))}
          </View>
        </View>
      ))}

      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink, marginLeft: 4 }}>Xem thêm</Text>
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {LEGAL_PAGES.filter((page) => page.title !== document.title).map((page, i) => (
            <Pressable
              key={page.to}
              onPress={() => router.replace(page.to as Href)}
              accessibilityRole="link"
              accessibilityLabel={page.title}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator })}
            >
              <Icon sf="doc.text" md="description" size={18} color={colors.primary} />
              <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{page.title}</Text>
              <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
