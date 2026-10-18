import { Fragment, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors, fonts, text } from '@/theme';

/**
 * The assistant writes light Markdown (headings, lists, bold, small tables). The web renders
 * it with react-markdown; the app has no Markdown library on the approved list, so this
 * reads the same subset into native text. Links and images are shown as plain text, never
 * followed or loaded, exactly like the web (`a` → span, `img` → nothing).
 */
type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string; depth: number }
  | { kind: 'ordered'; text: string; marker: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'rule' };

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let table: string[][] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
    if (table.length) blocks.push({ kind: 'table', rows: table });
    table = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (paragraph.length) {
        blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
        paragraph = [];
      }
      // The |---|---| separator row only marks the header; it carries nothing.
      if (!/^\s*\|?\s*:?-{2,}/.test(line)) table.push(line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      continue;
    }
    if (table.length) flush();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1]! });
    } else if (bullet) {
      flush();
      blocks.push({ kind: 'bullet', text: bullet[2]!, depth: Math.min(2, Math.floor(bullet[1]!.length / 2)) });
    } else if (ordered) {
      flush();
      blocks.push({ kind: 'ordered', text: ordered[2]!, marker: `${ordered[1]}.` });
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/** **bold**, *italic* / _italic_, `code`, [label](url) → label. */
function inline(source: string, color: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]*\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let key = 0;
  for (const match of source.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push(source.slice(last, at));
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      out.push(<Text key={key++} style={{ fontFamily: fonts.bold, color }}>{token.slice(2, -2)}</Text>);
    } else if (token.startsWith('`')) {
      out.push(<Text key={key++} style={{ fontFamily: fonts.code, color }}>{token.slice(1, -1)}</Text>);
    } else if (token.startsWith('[')) {
      out.push(token.slice(1, token.indexOf(']')));
    } else {
      out.push(<Text key={key++} style={{ fontStyle: 'italic', color }}>{token.slice(1, -1)}</Text>);
    }
    last = at + token.length;
  }
  if (last < source.length) out.push(source.slice(last));
  return out;
}

export function AnswerText({ markdown, color = colors.ink }: { markdown: string; color?: string }) {
  const blocks = parse(markdown);
  const body = [text.body, { color }];
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text key={i} selectable accessibilityRole="header" style={[text.headline, { color, marginTop: i ? 4 : 0 }]}>
                {inline(b.text, color)}
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={i} selectable style={body}>
                {inline(b.text, color)}
              </Text>
            );
          case 'bullet':
          case 'ordered':
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: b.kind === 'bullet' ? b.depth * 16 : 0 }}>
                <Text style={[body, { fontFamily: fonts.bold, color: colors.primary, minWidth: b.kind === 'ordered' ? 20 : 10 }]}>
                  {b.kind === 'ordered' ? b.marker : '•'}
                </Text>
                <Text selectable style={[body, { flex: 1 }]}>
                  {inline(b.text, color)}
                </Text>
              </View>
            );
          case 'rule':
            return <View key={i} style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />;
          case 'table': {
            const [head, ...rows] = b.rows;
            // A phone is too narrow for columns: each row reads as "Header: value" lines.
            return (
              <View key={i} style={{ gap: 6 }}>
                {(rows.length ? rows : [head!]).map((row, r) => (
                  <View key={r} style={{ padding: 10, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.sunken, gap: 2 }}>
                    {row.map((cell, c) => (
                      <Fragment key={c}>
                        <Text selectable style={[text.footnote, { color }]}>
                          {rows.length && head?.[c] ? <Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>{`${head[c]}: `}</Text> : null}
                          {inline(cell, color)}
                        </Text>
                      </Fragment>
                    ))}
                  </View>
                ))}
              </View>
            );
          }
        }
      })}
    </View>
  );
}
