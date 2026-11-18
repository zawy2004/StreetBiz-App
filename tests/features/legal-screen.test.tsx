import { fireEvent, render, screen } from '@testing-library/react-native';

import { LegalScreen } from '@/features/legal/LegalScreen';
import { LEGAL_BASIS, PRIVACY, SLOT_COMMITMENTS, SLOT_RULES, TERMS, type LegalDocument } from '@/features/legal/legal-content';
import { readingMinutes } from '@/features/legal/reading-time';
import { router } from 'expo-router';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

const DOCS: [string, string, LegalDocument][] = [
  ['terms', 'Điều khoản sử dụng', TERMS],
  ['privacy', 'Chính sách bảo mật', PRIVACY],
  ['slot-rules', 'Quy định thuê ô vỉa hè', SLOT_RULES],
  ['basis', 'Căn cứ pháp lý', LEGAL_BASIS],
];

describe('legal screen', () => {
  it.each(DOCS)('%s shows its title, the quick summary and the reading time', async (doc, title, content) => {
    mockParams = { doc };
    await render(<LegalScreen />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText('Tóm tắt nhanh')).toBeTruthy();
    for (const point of content.highlights) expect(screen.getByText(point)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Đọc khoảng ${readingMinutes(content)} phút`))).toBeTruthy();
  });

  it('turns a table row into a card with its labelled cells', async () => {
    mockParams = { doc: 'terms' };
    await render(<LegalScreen />);

    expect(screen.getByText('Phí thuê ô')).toBeTruthy();
    expect(screen.getAllByText('Trả cho ai').length).toBeGreaterThan(0);
    expect(screen.getByText('Kho bạc Nhà nước')).toBeTruthy();
  });

  it('keeps both rental commitments on the slot rules page', async () => {
    mockParams = { doc: 'slot-rules' };
    await render(<LegalScreen />);

    for (const commitment of SLOT_COMMITMENTS) expect(screen.getByText(commitment)).toBeTruthy();
  });

  it('links the other three pages at the bottom and opens one', async () => {
    mockParams = { doc: 'privacy' };
    await render(<LegalScreen />);

    expect(screen.queryByLabelText('Chính sách bảo mật')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Điều khoản sử dụng'));
    expect(router.replace).toHaveBeenCalledWith('/legal/terms');
    expect(screen.getByLabelText('Quy định thuê ô vỉa hè')).toBeTruthy();
    expect(screen.getByLabelText('Căn cứ pháp lý')).toBeTruthy();
  });
});

describe('legal content', () => {
  it.each(DOCS)('%s has unique section ids, a dd/mm/yyyy date and tables with complete rows', (_doc, _title, content) => {
    const ids = content.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(content.updatedAt).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    for (const section of content.sections) {
      for (const block of section.blocks) {
        if (block.kind !== 'table') continue;
        for (const row of block.rows) expect(row).toHaveLength(block.head.length);
        expect(new Set(block.rows.map((r) => r[0])).size).toBe(block.rows.length);
      }
    }
  });

  it('keeps the section ids other screens link to', () => {
    expect(SLOT_RULES.sections.map((s) => s.id)).toContain('bao-gia');
    expect(LEGAL_BASIS.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['tuyen', 'duyet-ho-so', 'cap-phuong', 'kinh-doanh', 'du-lieu', 'xu-phat']),
    );
  });

  it('never leaves a note to the authors in the public text', () => {
    expect(JSON.stringify([TERMS, PRIVACY, SLOT_RULES, LEGAL_BASIS])).not.toMatch(/cần cập nhật|TODO|sẽ cập nhật|khi ban hành/i);
  });
});
