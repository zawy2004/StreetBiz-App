/** Lower case, no accents, đ → d, single spaces: "Phường Hòa Cường" → "phuong hoa cuong". */
export function foldVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const UNIT_KIND = /^(phuong|xa|dac khu) /;

/**
 * Wards matching what the person types, accents optional, by the start of a word; names that
 * start with it come first ("an" → An Hải before Hội An, never Hòa Vang). "Phường"/"Xã" are ignored.
 */
export function searchWards<T extends { unitName: string }>(wards: readonly T[], query: string, limit = 6): T[] {
  const q = foldVietnamese(query).replace(UNIT_KIND, '');
  if (!q) return [];
  return wards
    .map((ward) => {
      const name = foldVietnamese(ward.unitName).replace(UNIT_KIND, '');
      return { ward, rank: name.startsWith(q) ? 0 : ` ${name}`.includes(` ${q}`) ? 1 : -1 };
    })
    .filter((s) => s.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((s) => s.ward);
}
