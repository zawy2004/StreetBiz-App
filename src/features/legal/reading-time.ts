import type { LegalBlock, LegalDocument } from './legal-content';

/** Words in a block, to estimate reading time. */
function blockWords(block: LegalBlock): number {
  const text =
    block.kind === 'p'
      ? block.text
      : block.kind === 'note'
        ? `${block.title} ${block.text}`
        : block.kind === 'table'
          ? [...block.head, ...block.rows.flat()].join(' ')
          : block.items.join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** About 200 words a minute in Vietnamese; never less than one. */
export function readingMinutes(doc: LegalDocument): number {
  const words =
    doc.highlights.join(' ').split(/\s+/).length +
    doc.sections.reduce((sum, s) => sum + s.blocks.reduce((n, b) => n + blockWords(b), 0), 0);
  return Math.max(1, Math.round(words / 200));
}
